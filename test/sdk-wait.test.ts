import{test}from'node:test';
import assert from'node:assert/strict';
import{SpendingClient,PendingRequestError}from'../packages/sdk/src/index.js';
import{Snapshot}from'../packages/sdk/src/contracts.js';
function snapshot(state:string,usage:unknown[]=[]){return Snapshot.parse({task:'task',policy:{budget:'100',perRequest:'60',approvalAbove:'30',calls:10,expiresAt:'2030-01-01T00:00:00Z',providers:['fixture'],tools:['search'],recipients:['service']},policyVersion:1,paused:false,revoked:false,available:'80',spent:'20',reserved:'0',callsLeft:9,research:[],vault:null,requests:[{id:'purchase',state,payload:{provider:'fixture',tool:'search',recipient:'service',amount:'20',input:{query:'test'}},policyVersion:1}],usage,events:[]});}
test('SDK waiting notifies once and preserves charged failed-delivery outcome without submitting again',async()=>{
 const client=new SpendingClient('http://localhost','not-used');let reads=0,approvals=0;
 client.snapshot=async(_task,signal)=>{assert.ok(signal);reads++;return reads<3?snapshot('approval'):snapshot('failed',[{request_id:'purchase',charged_amount:'20',calls:1,delivery:'failed',receipt:{fixture:true}}]);};
 client.submit=async()=>{throw Error('Waiting must not submit');};
 const result=await client.waitForRequest('task','purchase',{pollIntervalMs:1,onApproval:()=>{approvals++;}});
 assert.equal(approvals,1);assert.equal(result.request.state,'failed');assert.equal(result.usage?.charged_amount,'20');assert.equal(result.usage?.delivery,'failed');
});
test('SDK waiting bounds an in-flight read and preserves caller cancellation',async()=>{
 const client=new SpendingClient('http://localhost','not-used');
 client.snapshot=async(_task,signal)=>new Promise((_resolve,reject)=>signal!.addEventListener('abort',()=>reject(signal!.reason),{once:true}));
 // Keep the event loop alive while AbortSignal.timeout's unreferenced timer runs.
 const keepalive=setInterval(()=>{},1000);
 try{await assert.rejects(client.waitForRequest('task','purchase',{timeoutMs:20}),e=>e instanceof PendingRequestError&&e.requestId==='purchase');}finally{clearInterval(keepalive);}
 const controller=new AbortController(),reason=new Error('caller cancelled');controller.abort(reason);
 await assert.rejects(client.waitForRequest('task','purchase',{signal:controller.signal}),e=>e===reason);
 await assert.rejects(client.waitForRequest('task','purchase',{pollIntervalMs:0}),/invalid_wait_options/);
});
test('SDK waiting propagates authorization failures and returns cancelled without inventing usage',async()=>{
 const client=new SpendingClient('http://localhost','not-used');client.snapshot=async()=>{throw Error('unauthorized');};
 await assert.rejects(client.waitForRequest('task','purchase'),/unauthorized/);
 client.snapshot=async()=>snapshot('cancelled');const result=await client.waitForRequest('task','purchase');assert.equal(result.request.state,'cancelled');assert.equal(result.usage,null);
});

test('SDK deadline also bounds an unresolved approval callback',async()=>{
 const client=new SpendingClient('http://localhost','not-used');client.snapshot=async()=>snapshot('approval');
 const keepalive=setInterval(()=>{},1000);try{
  await assert.rejects(client.waitForRequest('task','purchase',{timeoutMs:20,onApproval:()=>new Promise<void>(()=>{})}),PendingRequestError);
 }finally{clearInterval(keepalive);}
});
