import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { Store } from '../apps/gateway/src/store.js';
import { migrate } from '../apps/gateway/src/migrations.js';
import { FixtureAdapter } from '../packages/adapters/fixture.js';
const policy = { budget: '100', perRequest: '80', approvalAbove: '30', calls: 4, expiresAt: '2030-01-01T00:00:00Z', providers: ['fixture'], tools: ['search'], recipients: ['service'] };
const purchase = (amount = '20') => ({ amount, provider: 'fixture', tool: 'search', recipient: 'service', input: { query: 'hello' } });
async function setup() {
  const db = new PGlite();
  await db.exec('BEGIN');
  await migrate({ query: async (sql, params) => params ? db.query(sql, params) : (await db.exec(sql)).at(-1) ?? { rows: [] } });
  await db.exec('COMMIT');
  const store = new Store(db), owner = 'owner-secret';
  const { task, agent } = await store.create(owner, policy);
  return { db, store, owner, task, agent, adapter: new FixtureAdapter(db) };
}
test('reservations, complete payload idempotency, hard limits, and exact owner approval', async () => {
  const { db, store, owner, task, agent, adapter } = await setup();
  try {
    const first = await store.reserve(task, agent, 'one', purchase());
    assert.equal((await store.reserve(task, agent, 'one', purchase())).id, first.id);
    await assert.rejects(store.reserve(task, agent, 'one', purchase('21')), /idempotency_conflict/);
    await assert.rejects(store.reserve(task, agent, 'big', purchase('81')), /hard_limit/);
    const pending = await store.reserve(task, agent, 'approval', purchase('70'));
    assert.equal(pending.state, 'approval');
    await assert.rejects(store.approve(task, pending.id, agent), /unauthorized/);
    await store.approve(task, pending.id, owner);
    await store.approve(task, pending.id, owner); // retries do not reserve twice
    await assert.rejects(store.reserve(task, agent, 'over', purchase()), /hard_limit/);
    const dispatch = await store.dispatch(task, first.id, adapter);
    assert.ok(dispatch);
    const outcome = await adapter.execute(dispatch.dispatchId, dispatch.payload);
    await store.settle(task, first.id, dispatch.dispatchId, outcome);
    assert.equal(await store.dispatch(task, first.id, adapter), null);
    await store.control(task, owner, 'revoke');
    assert.equal(await store.dispatch(task, pending.id, adapter), null);
    const snapshot = await store.snapshot(task, owner);
    assert.equal(snapshot.spent, '20'); assert.equal(snapshot.reserved, '0');
    assert.equal((await db.query('SELECT * FROM approvals')).rows.length, 1);
  } finally { await db.close(); }
});
test('allowlists, expired policy, credential isolation and conservative uncertain state', async () => {
  const { db, store, owner, task, agent, adapter } = await setup();
  try {
    await assert.rejects(store.reserve(task, owner, 'wrong', purchase()), /unauthorized/);
    await assert.rejects(store.reserve(task, agent, 'bad', { ...purchase(), recipient: 'attacker' }), /not_allowed/);
    const r = await store.reserve(task, agent, 'pending', purchase());
    assert.ok(await store.dispatch(task, r.id, adapter));
    await store.control(task, owner, 'revoke');
    assert.equal((await store.snapshot(task, owner)).reserved, '20');
    const other = await store.create(owner, { ...policy, expiresAt: '2000-01-01T00:00:00Z' });
    await assert.rejects(store.reserve(other.task, other.agent, 'expired', purchase()), /task_inactive/);
    await assert.rejects(store.snapshot(other.task, agent), /unauthorized/);
    assert.equal((await db.query('SELECT * FROM workspaces')).rows.length, 1);
  } finally { await db.close(); }
});
test('policy edits invalidate pending approvals and cannot hide committed usage', async () => {
  const { db, store, owner, task, agent, adapter } = await setup();
  try {
    const awaiting = await store.reserve(task, agent, 'approval', purchase('40'));
    const ready = await store.reserve(task, agent, 'ready', purchase());
    await assert.rejects(store.editPolicy(task, agent, 1, policy), /unauthorized/);
    await assert.rejects(store.editPolicy(task, owner, 2, policy), /policy_version_conflict/);
    await store.editPolicy(task, owner, 1, policy);
    await assert.rejects(store.approve(task, awaiting.id, owner), /invalid_state/);
    assert.equal(await store.dispatch(task, ready.id, adapter), null);
    const active = await store.reserve(task, agent, 'active', purchase());
    await store.dispatch(task, active.id, adapter);
    await assert.rejects(store.editPolicy(task, owner, 2, { ...policy, budget: '0' }), /policy_below_committed_usage/);
    await assert.rejects(store.editPolicy(task, owner, 2, { ...policy, calls: 0 }), /policy_below_committed_usage/);
  } finally { await db.close(); }
});
test('confirmed billing is independent of delivery; settlement cannot exceed reservation or be rewritten', async () => {
  const { db, store, owner, task, agent, adapter } = await setup();
  try {
    const r = await store.reserve(task, agent, 'one', purchase());
    const dispatch = await store.dispatch(task, r.id, adapter); assert.ok(dispatch);
    const confirmed = { status: 'confirmed', chargedAmount: '21', calls: 1, delivery: 'failed', receipt: { fixture: true } };
    await assert.rejects(store.settle(task, r.id, dispatch.dispatchId, confirmed), /provider_exceeded_reservation/);
    assert.equal((await store.snapshot(task, owner)).reserved, '20');
    confirmed.chargedAmount = '12';
    await store.settle(task, r.id, dispatch.dispatchId, confirmed);
    await store.settle(task, r.id, dispatch.dispatchId, confirmed);
    await assert.rejects(store.settle(task, r.id, dispatch.dispatchId, { ...confirmed, chargedAmount: '0' }), /settlement_conflict/);
    const snapshot = await store.snapshot(task, owner);
    assert.equal(snapshot.reserved, '0'); assert.equal(snapshot.spent, '12'); assert.equal(snapshot.available, '88');
    assert.equal(snapshot.requests[0].state, 'failed'); assert.equal(snapshot.usage.length, 1);
  } finally { await db.close(); }
});
test('trusted adapter quote prevents agent understating execution cost', async () => {
  const { db, store, owner, task, agent, adapter } = await setup();
  try {
    const r = await store.reserve(task, agent, 'cheap', purchase('1'));
    assert.equal(await store.dispatch(task, r.id, adapter), null);
    const snapshot = await store.snapshot(task, owner);
    assert.equal(snapshot.requests[0].state, 'cancelled'); assert.equal(snapshot.reserved, '0');
    assert.equal(snapshot.events.at(-1)?.detail.reason, 'quote_mismatch');
  } finally { await db.close(); }
});

test('dispatch binds owner approval to the exact payload hash', async () => {
  const { db, store, owner, task, agent, adapter } = await setup();
  try {
    await store.editPolicy(task, owner, 1, { ...policy, approvalAbove: '10' });
    const r = await store.reserve(task, agent, 'approval', purchase());
    await store.approve(task, r.id, owner);
    // Simulate a corrupted persisted purchase; execution must still check the approval binding.
    await db.query('UPDATE requests SET payload=$2 WHERE id=$1', [r.id, { ...purchase(), input: { query: 'changed after approval' } }]);
    assert.equal(await store.dispatch(task, r.id, adapter), null);
    const snapshot = await store.snapshot(task, owner);
    assert.equal(snapshot.reserved, '0'); assert.equal(snapshot.events.at(-1)?.detail.reason, 'approval_required');
  } finally { await db.close(); }
});
