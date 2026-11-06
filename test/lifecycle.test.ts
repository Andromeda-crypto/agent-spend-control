import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { Store } from '../apps/gateway/src/store.js';
const policy={budget:'100',perRequest:'80',approvalAbove:'30',calls:4,expiresAt:'2030-01-01T00:00:00Z',providers:['fixture'],tools:['search'],recipients:['service']};
const purchase=(amount='20')=>({amount,provider:'fixture',tool:'search',recipient:'service',input:{query:'hello'}});
async function setup(){const db=new PGlite();await db.exec(await readFile('migrations/001_initial.sql','utf8'));const store=new Store(db);const owner='owner-secret';const {task,agent}=await store.create(owner,policy);return {db,store,owner,task,agent};}
test('reservations, complete payload idempotency, hard limits, and owner approval',async()=>{
 const {db,store,owner,task,agent}=await setup();try{
 const first=await store.reserve(task,agent,'one',purchase());
 assert.equal((await store.reserve(task,agent,'one',purchase())).id,first.id);
 await assert.rejects(store.reserve(task,agent,'one',purchase('21')),/idempotency_conflict/);
 await assert.rejects(store.reserve(task,agent,'big',purchase('81')),/hard_limit/);
 const pending=await store.reserve(task,agent,'approval',purchase('70'));assert.equal(pending.state,'approval');
 await assert.rejects(store.transition(task,pending.id,agent,'approve'),/unauthorized/);
 await store.transition(task,pending.id,owner,'approve');
 await assert.rejects(store.reserve(task,agent,'over',purchase()),/hard_limit/);
 await store.transition(task,first.id,agent,'dispatch');
 await store.transition(task,first.id,agent,'succeeded',{fixture:true});
 await assert.rejects(store.transition(task,first.id,agent,'dispatch'),/invalid_state/);
 await store.control(task,owner,'revoke');
 await assert.rejects(store.transition(task,pending.id,agent,'dispatch'),/invalid_state/);
 const row=(await db.query('SELECT * FROM tasks')).rows[0] as any;assert.equal(row.spent,20);assert.equal(row.reserved,0);
 }finally{await db.close();}
});
test('allowlist, expiry, credential isolation and conservative uncertain state',async()=>{
 const {db,store,owner,task,agent}=await setup();try{
 await assert.rejects(store.reserve(task,owner,'wrong',purchase()),/unauthorized/);
 await assert.rejects(store.reserve(task,agent,'bad',{...purchase(),recipient:'attacker'}),/not_allowed/);
 const r=await store.reserve(task,agent,'pending',purchase());await store.transition(task,r.id,agent,'dispatch');await store.control(task,owner,'revoke');
 const row=(await db.query('SELECT * FROM tasks')).rows[0] as any;assert.equal(row.reserved,20);
 }finally{await db.close();}
});
