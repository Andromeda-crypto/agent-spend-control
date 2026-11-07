import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { DB } from './store.js';
import { hash, credential } from './store.js';

export class Identity {
  constructor(private db: DB) {}
  async owner(token: string, create = false, name = 'Workspace owner'): Promise<{ id: string; workspace: string; name: string }> {
    const digest = hash(token);
    const c = (await this.db.query(`SELECT c.*,o.workspace_id,o.name FROM credentials c LEFT JOIN owners o ON o.id=c.owner_id
      WHERE token_hash=$1 FOR SHARE OF c`, [digest])).rows[0];
    if (c) {
      if (!c.owner_id || c.revoked_at) throw new Error('unauthorized');
      return { id: c.owner_id as string, workspace: c.workspace_id as string, name: c.name as string };
    }
    if (!create) throw new Error('unauthorized');
    const id = randomUUID();
    // Unknown high-entropy tokens retain the development bootstrap behavior.
    const created = await this.db.query('INSERT INTO workspaces(id,owner_hash) VALUES($1,$2) ON CONFLICT(owner_hash) DO NOTHING RETURNING id', [id, digest]);
    if (!created.rows.length) return this.owner(token, false);
    await this.db.query('INSERT INTO owners(id,workspace_id,name) VALUES($1,$1,$2)', [id, name]);
    await this.db.query('INSERT INTO credentials(token_hash,owner_id) VALUES($1,$2)', [digest, id]);
    return { id, workspace: id, name };
  }
  async register(raw: unknown) {
    const { name } = z.object({ name: z.string().trim().min(1).max(100) }).strict().parse(raw);
    const token = credential(), owner = await this.owner(token, true, name);
    return { ...owner, credential: token };
  }
  async authorize(workspace: string, task: string, token: string, kind: 'owner' | 'agent' | 'either') {
    const c = (await this.db.query(`SELECT c.*,o.workspace_id AS owner_workspace,a.workspace_id AS agent_workspace,a.task_id,a.revoked
      FROM credentials c LEFT JOIN owners o ON o.id=c.owner_id LEFT JOIN agents a ON a.id=c.agent_id
      WHERE c.token_hash=$1 FOR SHARE OF c`, [hash(token)])).rows[0];
    if (!c || c.revoked_at) throw new Error('unauthorized');
    const owner = c.owner_id && c.owner_workspace === workspace;
    const agent = c.agent_id && !c.revoked && c.agent_workspace === workspace && c.task_id === task;
    if (!(kind === 'owner' ? owner : kind === 'agent' ? agent : owner || agent)) throw new Error('unauthorized');
    return c;
  }
  async registerAgent(workspace: string, task: string, token: string) {
    await this.db.query('INSERT INTO agents(id,workspace_id,task_id,name) VALUES($1,$2,$1,$3)', [task, workspace, 'Research agent']);
    await this.db.query('INSERT INTO credentials(token_hash,agent_id) VALUES($1,$2)', [hash(token), task]);
  }
  async overview(token: string) {
    const owner = await this.owner(token);
    const agents = (await this.db.query(`SELECT a.id,a.task_id,a.name,a.revoked,t.paused,t.revoked AS task_revoked
      FROM agents a JOIN tasks t ON t.id=a.task_id WHERE a.workspace_id=$1 ORDER BY a.created_at`, [owner.workspace])).rows;
    return { ...owner, agents };
  }
  async rotateOwner(token: string) {
    // Exclusive credential lock makes simultaneous rotations single-use.
    const row = (await this.db.query(`SELECT c.*,o.workspace_id FROM credentials c JOIN owners o ON o.id=c.owner_id
      WHERE c.token_hash=$1 FOR UPDATE OF c`, [hash(token)])).rows[0];
    if (!row || row.revoked_at) throw new Error('unauthorized');
    const next = credential();
    await this.db.query('UPDATE credentials SET revoked_at=now() WHERE token_hash=$1', [hash(token)]);
    await this.db.query('INSERT INTO credentials(token_hash,owner_id) VALUES($1,$2)', [hash(next), row.owner_id]);
    await this.db.query('UPDATE workspaces SET owner_hash=$2 WHERE id=$1', [row.workspace_id, hash(next)]);
    await this.db.query("INSERT INTO identity_events(workspace_id,action,subject_id) VALUES($1,'owner_credential_rotated',$2)", [row.workspace_id, row.owner_id]);
    return { credential: next };
  }
  async rotateAgent(workspace: string, task: string, revoke = false) {
    const next = credential();
    const a = (await this.db.query('SELECT * FROM agents WHERE task_id=$1 FOR UPDATE', [task])).rows[0];
    if (!a || a.revoked) throw new Error('task_inactive');
    await this.db.query('UPDATE credentials SET revoked_at=now() WHERE agent_id=$1 AND revoked_at IS NULL', [a.id]);
    if (revoke) await this.db.query('UPDATE agents SET revoked=true WHERE id=$1', [a.id]);
    else {
      await this.db.query('INSERT INTO credentials(token_hash,agent_id) VALUES($1,$2)', [hash(next), a.id]);
      await this.db.query('UPDATE tasks SET agent_hash=$2 WHERE id=$1', [task, hash(next)]);
    }
    await this.db.query('INSERT INTO identity_events(workspace_id,action,subject_id) VALUES($1,$2,$3)', [workspace, revoke ? 'agent_revoked' : 'agent_credential_rotated', a.id]);
    return revoke ? { revoked: true } : { credential: next };
  }
}
