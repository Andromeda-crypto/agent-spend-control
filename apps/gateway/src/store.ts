import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Policy, Purchase, allowed, canonical } from '../../../packages/policy/src/index.js';
import { Confirmed, type Adapter } from '../../../packages/adapters/index.js';
export interface DB { query(sql: string, params?: any[]): Promise<{ rows: any[] }> }
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export const credential = () => randomBytes(32).toString('base64url');

/** Internal repository: callers must wrap every operation in a transaction. */
export class Store {
  constructor(private db: DB) {}

  async create(owner: string, raw: unknown) {
    const policy = Policy.parse(raw), agent = credential(), task = randomUUID();
    const workspace = (await this.db.query(`INSERT INTO workspaces(id,owner_hash) VALUES ($1,$2)
      ON CONFLICT(owner_hash) DO UPDATE SET owner_hash=EXCLUDED.owner_hash RETURNING id`,
      [randomUUID(), hash(owner)])).rows[0].id;
    await this.db.query('INSERT INTO tasks(id,workspace_id,agent_hash,policy) VALUES ($1,$2,$3,$4)', [task, workspace, hash(agent), policy]);
    return { task, agent };
  }

  private async lockedTask(id: string) {
    const t = (await this.db.query(`SELECT t.*, w.owner_hash FROM tasks t JOIN workspaces w ON w.id=t.workspace_id
      WHERE t.id=$1 FOR UPDATE OF t`, [id])).rows[0];
    if (!t) throw new Error('unauthorized');
    return t;
  }

  async task(id: string, token: string, owner = false) {
    const t = await this.lockedTask(id);
    if (hash(token) !== (owner ? t.owner_hash : t.agent_hash)) throw new Error('unauthorized');
    return t;
  }

  private async event(id: string, state: string, detail: unknown = {}) {
    await this.db.query('INSERT INTO events(request_id,state,detail) VALUES ($1,$2,$3)', [id, state, detail]);
  }

  private async request(task: string, id: string) {
    const r = (await this.db.query('SELECT * FROM requests WHERE id=$1 AND task_id=$2 FOR UPDATE', [id, task])).rows[0];
    if (!r) throw new Error('not_found');
    return r;
  }

  private requestView(r: any) {
    return { id: r.id, state: r.state, payload: Purchase.parse(r.payload), policyVersion: r.version };
  }

  async reserve(task: string, token: string, key: string, raw: unknown) {
    const payload = Purchase.parse(raw), t = await this.task(task, token);
    const old = (await this.db.query('SELECT * FROM requests WHERE task_id=$1 AND key=$2', [task, key])).rows[0];
    if (old) {
      if (canonical(old.payload) !== canonical(payload)) throw new Error('idempotency_conflict');
      return this.requestView(old);
    }
    allowed(Policy.parse(t.policy), payload, t.spent, t.reserved, t.calls_used + t.calls_reserved, t.paused, t.revoked);
    const state = BigInt(payload.amount) > BigInt(t.policy.approvalAbove) ? 'approval' : 'reserved';
    const id = randomUUID();
    await this.db.query('INSERT INTO requests(id,task_id,key,payload,version,state) VALUES($1,$2,$3,$4,$5,$6)', [id, task, key, payload, t.version, state]);
    if (state === 'reserved') await this.add(task, payload.amount, 1);
    await this.event(id, state);
    return { id, state, payload, policyVersion: t.version };
  }

  private async add(task: string, amount: string, direction: number) {
    await this.db.query('UPDATE tasks SET reserved=reserved+$2::bigint,calls_reserved=calls_reserved+$3 WHERE id=$1',
      [task, (BigInt(amount) * BigInt(direction)).toString(), direction]);
  }

  async approve(task: string, id: string, token: string) {
    const t = await this.task(task, token, true), r = await this.request(task, id);
    if (r.state === 'reserved' && r.approved_by === t.workspace_id && r.version === t.version) return this.requestView(r);
    if (r.state !== 'approval' || r.version !== t.version) throw new Error('invalid_state');
    allowed(Policy.parse(t.policy), r.payload, t.spent, t.reserved, t.calls_used + t.calls_reserved, t.paused, t.revoked);
    await this.add(task, r.payload.amount, 1);
    await this.db.query("UPDATE requests SET state='reserved',approved_by=$2 WHERE id=$1", [id, t.workspace_id]);
    const payloadHash = hash(canonical(r.payload));
    await this.db.query('INSERT INTO approvals(request_id,workspace_id,policy_version,payload_hash) VALUES($1,$2,$3,$4)',
      [id, t.workspace_id, t.version, payloadHash]);
    await this.event(id, 'reserved', { reason: 'owner_approved', policyVersion: t.version, payloadHash });
    return this.requestView({ ...r, state: 'reserved' });
  }

  private async cancel(r: any, reason: string) {
    if (r.state === 'reserved') await this.add(r.task_id, r.payload.amount, -1);
    await this.db.query("UPDATE requests SET state='cancelled' WHERE id=$1", [r.id]);
    await this.event(r.id, 'cancelled', { reason });
  }

  async control(task: string, token: string, action: 'pause' | 'revoke' | 'resume') {
    const t = await this.task(task, token, true);
    if (action === 'resume') {
      if (t.revoked) throw new Error('task_inactive');
      await this.db.query('UPDATE tasks SET paused=false WHERE id=$1', [task]);
    } else {
      await this.db.query(`UPDATE tasks SET ${action === 'pause' ? 'paused' : 'revoked'}=true WHERE id=$1`, [task]);
      const pending = (await this.db.query("SELECT * FROM requests WHERE task_id=$1 AND state IN ('approval','reserved')", [task])).rows;
      for (const r of pending) await this.cancel(r, action);
    }
    return { task, action };
  }

  async editPolicy(task: string, token: string, expectedVersion: number, raw: unknown) {
    const policy = Policy.parse(raw), t = await this.task(task, token, true);
    if (t.version !== expectedVersion) throw new Error('policy_version_conflict');
    if (BigInt(policy.budget) < BigInt(t.spent) + BigInt(t.reserved) || policy.calls < t.calls_used + t.calls_reserved)
      throw new Error('policy_below_committed_usage');
    const pending = (await this.db.query("SELECT * FROM requests WHERE task_id=$1 AND state IN ('approval','reserved')", [task])).rows;
    for (const r of pending) await this.cancel(r, 'policy_changed');
    await this.db.query('UPDATE tasks SET policy=$2,version=version+1 WHERE id=$1', [task, policy]);
    return { task, policyVersion: t.version + 1 };
  }

  async snapshot(task: string, token: string) {
    const t = await this.lockedTask(task);
    if (![t.owner_hash, t.agent_hash].includes(hash(token))) throw new Error('unauthorized');
    const requests = (await this.db.query('SELECT * FROM requests WHERE task_id=$1 ORDER BY created_at,id', [task])).rows;
    const usage = (await this.db.query(`SELECT request_id,charged_amount::text,calls,delivery,receipt FROM usage
      WHERE task_id=$1 ORDER BY recorded_at,request_id`, [task])).rows;
    const events = (await this.db.query(`SELECT e.request_id,e.state,e.detail,e.created_at FROM events e
      JOIN requests r ON r.id=e.request_id WHERE r.task_id=$1 ORDER BY e.id`, [task])).rows;
    return {
      task, policy: Policy.parse(t.policy), policyVersion: t.version, paused: t.paused, revoked: t.revoked,
      available: (BigInt(t.policy.budget) - BigInt(t.spent) - BigInt(t.reserved)).toString(),
      spent: String(t.spent), reserved: String(t.reserved), callsLeft: t.policy.calls - t.calls_used - t.calls_reserved,
      requests: requests.map(r => this.requestView(r)), usage,
      events: events.map(e => ({ ...e, created_at: new Date(e.created_at).toISOString() })),
    };
  }

  /** Worker-only: no HTTP route or agent authority can dispatch or settle. */
  async dispatch(task: string, id: string, adapter?: Adapter) {
    const t = await this.lockedTask(task), r = await this.request(task, id);
    if (r.state !== 'reserved') return null;
    try {
      if (r.version !== t.version) throw new Error('policy_version_conflict');
      allowed(Policy.parse(t.policy), r.payload, t.spent, (BigInt(t.reserved) - BigInt(r.payload.amount)).toString(),
        t.calls_used + t.calls_reserved - 1, t.paused, t.revoked);
      if (BigInt(r.payload.amount) > BigInt(t.policy.approvalAbove)) {
        const approval = (await this.db.query('SELECT * FROM approvals WHERE request_id=$1', [id])).rows[0];
        if (!approval || approval.workspace_id !== t.workspace_id || approval.policy_version !== t.version
          || approval.payload_hash !== hash(canonical(r.payload))) throw new Error('approval_required');
      }
      if (!adapter || adapter.provider !== r.payload.provider || adapter.tool !== r.payload.tool || adapter.recipient !== r.payload.recipient)
        throw new Error('adapter_unavailable');
      if (adapter.quote(Purchase.parse(r.payload)) !== r.payload.amount) throw new Error('quote_mismatch');
    } catch (error) {
      await this.cancel(r, error instanceof Error ? error.message : 'dispatch_rejected');
      return null;
    }
    const dispatchId = randomUUID();
    await this.db.query("UPDATE requests SET state='dispatched',dispatch_id=$2,adapter_version=$3 WHERE id=$1", [id, dispatchId, adapter.version]);
    await this.event(id, 'dispatched', { dispatchId, adapterVersion: adapter.version });
    return { task, id, dispatchId, adapterVersion: adapter.version, payload: Purchase.parse(r.payload) };
  }

  async settle(task: string, id: string, dispatchId: string, raw: unknown) {
    const outcome = Confirmed.parse(raw);
    await this.lockedTask(task);
    const r = await this.request(task, id);
    if (r.dispatch_id !== dispatchId) throw new Error('dispatch_conflict');
    const old = (await this.db.query('SELECT * FROM usage WHERE request_id=$1', [id])).rows[0];
    if (old) {
      if (String(old.charged_amount) !== outcome.chargedAmount || old.calls !== outcome.calls || old.delivery !== outcome.delivery || canonical(old.receipt) !== canonical(outcome.receipt))
        throw new Error('settlement_conflict');
      return;
    }
    if (r.state !== 'dispatched') throw new Error('invalid_state');
    if (BigInt(outcome.chargedAmount) > BigInt(r.payload.amount)) throw new Error('provider_exceeded_reservation');
    await this.add(task, r.payload.amount, -1);
    await this.db.query('UPDATE tasks SET spent=spent+$2::bigint,calls_used=calls_used+$3 WHERE id=$1', [task, outcome.chargedAmount, outcome.calls]);
    await this.db.query(`INSERT INTO usage(request_id,task_id,reserved_amount,charged_amount,calls,delivery,receipt)
      VALUES($1,$2,$3,$4,$5,$6,$7)`, [id, task, r.payload.amount, outcome.chargedAmount, outcome.calls, outcome.delivery, outcome.receipt]);
    const state = outcome.delivery === 'delivered' ? 'succeeded' : 'failed';
    await this.db.query('UPDATE requests SET state=$2,receipt=$3 WHERE id=$1', [id, state, outcome.receipt]);
    await this.event(id, state, { chargedAmount: outcome.chargedAmount, calls: outcome.calls, delivery: outcome.delivery });
  }
}
