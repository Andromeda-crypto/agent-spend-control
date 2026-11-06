import type pg from 'pg';
import type { Purchase } from '../../../packages/policy/src/index.js';
import type { Adapter } from '../../../packages/adapters/index.js';
import { transaction } from '../../gateway/src/database.js';

type Candidate = { id: string; task_id: string; state: string; payload: Purchase; dispatch_id: string | null; adapter_version: string | null };

/** One bounded pass. Calling again after restart reconciles dispatched work without executing it again. */
export async function runWorkerOnce(pool: pg.Pool, adapters: Adapter[]) {
  const batches = await Promise.all(['reserved', 'dispatched'].map(state => pool.query<Candidate>(`SELECT id,task_id,state,payload,dispatch_id,adapter_version
    FROM requests WHERE state=$1 ORDER BY created_at,id LIMIT 100`, [state])));
  const candidates = batches.flatMap(batch => batch.rows);
  const results: { id: string; status: 'settled' | 'pending' | 'skipped'; reason?: string }[] = [];
  for (const r of candidates) {
    const adapter = adapters.find(a => a.provider === r.payload.provider && a.tool === r.payload.tool && a.recipient === r.payload.recipient
      && (r.state === 'reserved' || a.version === r.adapter_version));
    if (r.state === 'dispatched' && !adapter) {
      results.push({ id: r.id, status: 'pending', reason: 'adapter_unavailable' });
      continue;
    }
    const dispatch = r.state === 'reserved'
      ? await transaction(pool, s => s.dispatch(r.task_id, r.id, adapter))
      : { dispatchId: r.dispatch_id!, payload: r.payload };
    if (!dispatch || !adapter) { results.push({ id: r.id, status: 'skipped' }); continue; }
    try {
      // External execution/lookup happens after the dispatch transaction has committed.
      const outcome = r.state === 'reserved'
        ? await adapter.execute(dispatch.dispatchId, dispatch.payload)
        : await adapter.lookup(dispatch.dispatchId);
      if (outcome.status === 'pending') { results.push({ id: r.id, status: 'pending' }); continue; }
      await transaction(pool, s => s.settle(r.task_id, r.id, dispatch.dispatchId, outcome));
      results.push({ id: r.id, status: 'settled' });
    } catch {
      // An exception, including malformed/over-budget provider evidence, cannot release funds.
      results.push({ id: r.id, status: 'pending', reason: 'reconciliation_required' });
    }
  }
  return results;
}
