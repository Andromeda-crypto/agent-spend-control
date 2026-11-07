import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { transaction } from '../../apps/gateway/src/database.js';
import { credential } from '../../apps/gateway/src/store.js';
import { migrate } from '../../apps/gateway/src/migrations.js';

const policy = { budget: '100', perRequest: '100', approvalAbove: '100', calls: 10,
  expiresAt: '2030-01-01T00:00:00Z', providers: ['fixture'], tools: ['search'], recipients: ['service'] };
const purchase = (amount = '60') => ({ amount, provider: 'fixture', tool: 'search', recipient: 'service', input: { query: 'hello' } });

before(async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Verify adoption of the previous checkpoint's unversioned schema.
    await client.query(await readFile('migrations/001_initial.sql', 'utf8'));
    await migrate(client);
    await migrate(client);
    assert.equal((await client.query('SELECT count(*) FROM schema_migrations')).rows[0].count, '7');
    await client.query('COMMIT');
  }
  finally { client.release(); await pool.end(); }
});

test('real PostgreSQL serializes competing reservations and retries across connections', async () => {
  assert.ok(process.env.TEST_DATABASE_URL, 'Use npm run test:postgres or set TEST_DATABASE_URL to a disposable database');
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 8 });
  try {
    const owner = credential();
    const { task, agent } = await transaction(pool, s => s.create(owner, policy));
    const attempts = await Promise.allSettled(Array.from({ length: 8 }, (_, i) =>
      transaction(pool, s => s.reserve(task, agent, `race-${i}`, purchase()))));
    assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 1);
    for (const r of attempts) if (r.status === 'rejected') assert.match(String(r.reason), /hard_limit/);
    const totals = (await pool.query('SELECT reserved,calls_reserved FROM tasks WHERE id=$1', [task])).rows[0];
    assert.equal(totals.reserved, '60');
    assert.equal(totals.calls_reserved, 1);
    const retries = await Promise.all(Array.from({ length: 8 }, () =>
      transaction(pool, s => s.reserve(task, agent, 'retry', purchase('40')))));
    assert.equal(new Set(retries.map(r => r.id)).size, 1);
    await assert.rejects(transaction(pool, s => s.reserve(task, agent, 'retry', { ...purchase('40'), input: { query: 'changed' } })), /idempotency_conflict/);
    const count = (await pool.query('SELECT count(*) FROM requests WHERE task_id=$1', [task])).rows[0];
    assert.equal(count.count, '2');
    const secondPool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    try {
      const persisted = await transaction(secondPool, s => s.reserve(task, agent, 'retry', purchase('40')));
      assert.equal(persisted.id, retries[0].id);
    } finally { await secondPool.end(); }
  } finally { await pool.end(); }
});

test('API quota races, owner control races and transaction rollback preserve counters', async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 8 });
  try {
    const owner = credential();
    const { task, agent } = await transaction(pool, s => s.create(owner, { ...policy, calls: 1 }));
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => transaction(pool, s => s.reserve(task, agent, `quota-${i}`, purchase('1')))));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    await transaction(pool, s => s.control(task, owner, 'revoke'));
    const snapshot = await transaction(pool, s => s.snapshot(task, owner));
    assert.equal(snapshot.reserved, '0'); assert.equal(snapshot.callsLeft, 1);
    await assert.rejects(transaction(pool, s => s.reserve(task, agent, 'revoked', purchase('1'))), /task_inactive/);

    const other = await transaction(pool, s => s.create(owner, policy));
    await assert.rejects(transaction(pool, async s => {
      await s.reserve(other.task, other.agent, 'rollback', purchase());
      throw new Error('simulated_crash_before_commit');
    }), /simulated_crash/);
    const after = await transaction(pool, s => s.snapshot(other.task, owner));
    assert.equal(after.reserved, '0'); assert.equal(after.requests.length, 0);

    const controlRace = await Promise.allSettled([
      transaction(pool, s => s.reserve(other.task, other.agent, 'control-race', purchase())),
      transaction(pool, s => s.control(other.task, owner, 'revoke')),
    ]);
    assert.equal(controlRace[1].status, 'fulfilled');
    if (controlRace[0].status === 'rejected') assert.match(String(controlRace[0].reason), /task_inactive/);
    const revoked = await transaction(pool, s => s.snapshot(other.task, owner));
    assert.equal(revoked.revoked, true); assert.equal(revoked.reserved, '0');
    assert.ok(revoked.requests.every(r => r.state === 'cancelled'));
  } finally { await pool.end(); }
});

test('workers execute outside locks, claim once, and reconcile without double accounting', async () => {
  const { FixtureAdapter } = await import('../../packages/adapters/fixture.js');
  const { runWorkerOnce } = await import('../../apps/worker/src/worker.js');
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 8 });
  try {
    // Other fixture tasks may also be pending; every candidate must be safe to process.
    const owner = credential();
    const { task, agent } = await transaction(pool, s => s.create(owner, policy));
    const ready = await transaction(pool, s => s.reserve(task, agent, 'execute', { ...purchase('20'), input: { query: 'exclusive-worker-test' } }));
    let executions = 0;
    const fixture = new FixtureAdapter(pool);
    const adapter = {
      version: fixture.version, provider: fixture.provider, tool: fixture.tool, recipient: fixture.recipient,
      quote: (p: Parameters<typeof fixture.quote>[0]) => fixture.quote(p),
      lookup: (id: string) => fixture.lookup(id),
      execute: async (id: string, p: Parameters<typeof fixture.execute>[1]) => {
        if (p.input.query === 'exclusive-worker-test') executions++;
        // A transaction on the same task succeeds while provider work is in flight.
        await transaction(pool, s => s.snapshot(task, owner));
        return fixture.execute(id, p);
      },
    };
    await Promise.all([runWorkerOnce(pool, [adapter]), runWorkerOnce(pool, [adapter])]);
    assert.equal(executions, 1);
    const snapshot = await transaction(pool, s => s.snapshot(task, owner));
    assert.equal(snapshot.spent, '20'); assert.equal(snapshot.reserved, '0'); assert.equal(snapshot.usage.length, 1);
    const row = (await pool.query('SELECT dispatch_id FROM requests WHERE id=$1', [ready.id])).rows[0];
    const outcome = await fixture.lookup(row.dispatch_id); assert.equal(outcome.status, 'confirmed');
    await Promise.all(Array.from({ length: 6 }, () => transaction(pool, s => s.settle(task, ready.id, row.dispatch_id, outcome))));
    assert.equal((await transaction(pool, s => s.snapshot(task, owner))).spent, '20');
  } finally { await pool.end(); }
});

test('HTTP/SDK flow survives gateway crash, and a fresh worker reconciles a lost provider response', async () => {
  const { startGateway, workerProcess } = await import('./process.js');
  const { SpendingClient } = await import('../../packages/sdk/src/index.js');
  let gateway = await startGateway();
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    const ownerToken = credential();
    let owner = new SpendingClient(gateway.url, ownerToken);
    const created = await owner.createTask({ ...policy, approvalAbove: '10' });
    let agent = new SpendingClient(gateway.url, created.agent);
    const payload = { ...purchase('20'), input: { query: 'crash recovery', simulateTimeout: true } };
    const request = await agent.submit(created.task, 'recovery', payload);
    assert.equal(request.state, 'approval');
    await assert.rejects(agent.approve(created.task, request.id), /unauthorized/);
    await assert.rejects(agent.editPolicy(created.task, 1, policy), /unauthorized/);
    await owner.approve(created.task, request.id);
    const first = await workerProcess();
    assert.ok(first.results.some((r: any) => r.id === request.id && r.status === 'pending'));
    const pending = await owner.snapshot(created.task);
    assert.equal(pending.requests[0].state, 'dispatched'); assert.equal(pending.reserved, '20');
    assert.equal(pending.usage.length, 0);
    await gateway.stop(true);
    gateway = await startGateway();
    owner = new SpendingClient(gateway.url, ownerToken);
    agent = new SpendingClient(gateway.url, created.agent);
    assert.equal((await agent.submit(created.task, 'recovery', payload)).id, request.id);
    await assert.rejects(agent.submit(created.task, 'recovery', { ...payload, input: { query: 'changed' } }), /idempotency_conflict/);
    await owner.control(created.task, 'revoke');
    assert.equal((await owner.snapshot(created.task)).reserved, '20');
    await workerProcess();
    const final = await owner.snapshot(created.task);
    assert.equal(final.spent, '20'); assert.equal(final.reserved, '0'); assert.equal(final.usage.length, 1);
    assert.equal(final.usage[0].receipt.fixture, true); assert.equal(final.callsLeft, 9);
    const providerCount = (await pool.query(`SELECT count(*) FROM fixture_receipts f JOIN requests r ON r.dispatch_id=f.dispatch_id WHERE r.id=$1`, [request.id])).rows[0];
    assert.equal(providerCount.count, '1');
    await assert.rejects(agent.submit(created.task, 'after-revoke', purchase('20')), /task_inactive/);
    const fakeSettle = await fetch(`${gateway.url}/tasks/${created.task}/requests/${request.id}/succeeded`, { method: 'POST', headers: { authorization: `Bearer ${created.agent}` } });
    assert.equal(fakeSettle.status, 404);
    const malformed = await fetch(`${gateway.url}/tasks`, { method: 'POST', headers: { authorization: `Bearer ${ownerToken}` }, body: '{' });
    assert.equal(malformed.status, 400);
  } finally { await gateway.stop(); await pool.end(); }
});

test('applied migration checksums prevent silent schema history changes', async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("UPDATE schema_migrations SET checksum='tampered' WHERE name='001_initial.sql'");
    await assert.rejects(migrate(client), /migration_changed:001_initial.sql/);
  } finally { await client.query('ROLLBACK'); client.release(); await pool.end(); }
});

test('HTTP identity rotation is single-use and workspace authority never crosses tenants', async () => {
  const { startGateway } = await import('./process.js');
  const { SpendingClient } = await import('../../packages/sdk/src/index.js');
  const gateway = await startGateway();
  try {
    const a = new SpendingClient(gateway.url, credential()), b = new SpendingClient(gateway.url, credential());
    const ta = await a.createTask(policy), tb = await b.createTask(policy);
    await assert.rejects(b.snapshot(ta.task), /unauthorized/);
    await assert.rejects(b.rotateAgent(ta.task), /unauthorized/);
    await assert.rejects(b.control(ta.task,'revoke'), /unauthorized/);
    await assert.rejects(b.editPolicy(ta.task,1,policy), /unauthorized/);
    const agent = new SpendingClient(gateway.url,ta.agent);
    await assert.rejects(agent.rotateOwner(), /unauthorized/);
    await assert.rejects(agent.rotateAgent(ta.task), /unauthorized/);
    await assert.rejects(agent.snapshot(tb.task), /unauthorized/);
    const nextAgent = await a.rotateAgent(ta.task);
    await assert.rejects(agent.snapshot(ta.task), /unauthorized/);
    assert.equal((await new SpendingClient(gateway.url,nextAgent.credential).snapshot(ta.task)).task,ta.task);
    const rotations = await Promise.allSettled([a.rotateOwner(),a.rotateOwner()]);
    const wins = rotations.filter(r=>r.status==='fulfilled'); assert.equal(wins.length,1);
    const lost = rotations.find(r=>r.status==='rejected'); assert.ok(lost && lost.status==='rejected'); assert.match(String(lost.reason),/unauthorized/);
    await assert.rejects(a.identity(), /unauthorized/);
    await assert.rejects(a.createTask(policy), /unauthorized/);
  } finally { await gateway.stop(); }
});

test('dashboard owner setup, fixture workflow, approval, and report use the actual HTTP API', {timeout:30000}, async () => {
  const { JSDOM }=await import('jsdom');
  const { createDashboard }=await import('../../apps/web/src/ui.js');
  const { startGateway }=await import('./process.js');
  const { advanceResearch }=await import('../../examples/reference-agent/workflow.js');
  const { runWorkerOnce }=await import('../../apps/worker/src/worker.js');
  const { FixtureAdapter }=await import('../../packages/adapters/fixture.js');
  const gateway=await startGateway();
  const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
  const dom=new JSDOM('<div id="app"></div>',{url:gateway.url});
  const doc=dom.window.document;
  const board=createDashboard(doc.getElementById('app')!,((input:Parameters<typeof fetch>[0],init?:RequestInit)=>fetch(new URL(String(input),gateway.url),init)) as typeof fetch);
  const until=async(check:()=>boolean)=>{for(let i=0;i<150;i++){if(check())return;await new Promise(r=>setTimeout(r,20));}throw new Error('dashboard_wait_timeout:'+doc.body.textContent?.slice(-1500));};
  const click=(selector:string)=>{const button=doc.querySelector<HTMLElement>(selector);assert.ok(button,selector);button.click();};
  try{
    (doc.querySelector('input[name="value"]') as HTMLInputElement).value='Test research workspace';
    doc.getElementById('auth-form')!.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
    await until(()=>!!doc.querySelector('[aria-label="Your owner key"]'));click('[data-close]');
    click('#new-task');
    const topic='Safe Solana spending <img src=x onerror=alert(1)>';
    (doc.getElementById('topic') as HTMLInputElement).value=topic;click('#modal-submit');
    await until(()=>!!doc.querySelector('[aria-label="Task agent key"]'));click('[data-close]');
    const row=(await pool.query('SELECT task_id FROM research_runs WHERE topic=$1',[topic])).rows[0];assert.ok(row);
    const adapters=[new FixtureAdapter(pool),new FixtureAdapter(pool,'40','dataset')];
    const tick=async()=>{await advanceResearch(pool);await runWorkerOnce(pool,adapters);await advanceResearch(pool);};
    await tick();await tick();await board.refresh();
    await until(()=>!!doc.querySelector('[data-approve]'));
    assert.equal(doc.querySelector('img'),null,'untrusted topic must render as text');
    assert.match(doc.body.textContent??'',/Fixture mode/);
    click('[data-approve]');
    await until(()=>!doc.querySelector('[data-approve]'));
    await tick();await tick();await board.refresh();
    await until(()=>doc.body.textContent?.includes('FIXTURE REPORT')??false);
    const task=(await transaction(pool,s=>s.snapshot(row.task_id,(dom.window.sessionStorage.getItem('owner-key')!))));
    assert.equal(task.spent,'100');assert.equal(task.reserved,'0');assert.equal(task.research[0].state,'complete');assert.equal(task.usage.length,4);
    assert.equal(task.events.filter(e=>e.detail.reason==='owner_approved').length,1);
  }finally{board.dispose();dom.window.close();await pool.end();await gateway.stop();}
});
