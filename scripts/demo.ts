import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { Store, credential } from '../apps/gateway/src/store.js';
import { migrate } from '../apps/gateway/src/migrations.js';
import { FixtureAdapter } from '../packages/adapters/fixture.js';

console.log('FIXTURE DEMO — synthetic API usage, no network calls or blockchain payments');
const db = new PGlite();
async function transaction<T>(work: (store: Store) => Promise<T>) {
  await db.exec('BEGIN');
  try { const value = await work(new Store(db)); await db.exec('COMMIT'); return value; }
  catch (error) { await db.exec('ROLLBACK'); throw error; }
}
try {
  await db.exec('BEGIN');
  await migrate({ query: async (sql, params) => params ? db.query(sql, params) : (await db.exec(sql)).at(-1) ?? { rows: [] } });
  await db.exec('COMMIT');
  const owner = credential();
  const policy = { budget: '100', perRequest: '40', approvalAbove: '30', calls: 5,
    expiresAt: new Date(Date.now() + 3600000).toISOString(), providers: ['fixture'], tools: ['search'], recipients: ['service'] };
  const { task, agent } = await transaction(s => s.create(owner, policy));
  const adapter = new FixtureAdapter(db);
  const purchase = { amount: '20', provider: 'fixture', tool: 'search', recipient: 'service', input: { query: 'Solana spending controls' } };
  const first = await transaction(s => s.reserve(task, agent, 'allowed', purchase));
  const dispatch = await transaction(s => s.dispatch(task, first.id, adapter)); assert.ok(dispatch);
  const outcome = await adapter.execute(dispatch.dispatchId, dispatch.payload);
  await transaction(s => s.settle(task, first.id, dispatch.dispatchId, outcome));
  console.log('Allowed fixture request: confirmed 20 synthetic units, delivered a synthetic research result.');

  await transaction(s => s.editPolicy(task, owner, 1, { ...policy, approvalAbove: '10' }));
  const exception = await transaction(s => s.reserve(task, agent, 'approval', purchase));
  assert.equal(exception.state, 'approval');
  await assert.rejects(transaction(s => s.approve(task, exception.id, agent)), /unauthorized/);
  await transaction(s => s.approve(task, exception.id, owner));
  const approved = await transaction(s => s.dispatch(task, exception.id, adapter)); assert.ok(approved);
  const approvedOutcome = await adapter.execute(approved.dispatchId, approved.payload);
  await transaction(s => s.settle(task, exception.id, approved.dispatchId, approvedOutcome));
  console.log('Owner approval: task continues with the exact approved payload and policy version.');

  await assert.rejects(transaction(s => s.reserve(task, agent, 'blocked', { ...purchase, recipient: 'attacker' })), /not_allowed/);
  await transaction(s => s.control(task, owner, 'revoke'));
  await assert.rejects(transaction(s => s.reserve(task, agent, 'revoked', purchase)), /task_inactive/);
  console.log('Unapproved recipient blocked; owner revocation blocks subsequent requests.');
  const snapshot = await transaction(s => s.snapshot(task, owner));
  assert.equal(snapshot.spent, '40'); assert.equal(snapshot.reserved, '0');
  console.log(JSON.stringify({ fixture: true, available: snapshot.available, reserved: snapshot.reserved, spent: snapshot.spent,
    callsLeft: snapshot.callsLeft, usage: snapshot.usage }, null, 2));
} finally { await db.close(); }
