import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createDashboard } from '../../apps/web/src/ui.js';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import pg from 'pg';
import { address, generateKeyPairSigner, lamports, type Address } from '@solana/kit';
import { getCreateAccountInstruction } from '@solana-program/system';
import { TOKEN_PROGRAM_ADDRESS, getInitializeMintInstruction, getMintSize, getMintToInstruction,
  getCreateAssociatedTokenInstructionAsync, findAssociatedTokenPda } from '@solana-program/token';
import { VaultClient, bytes32 } from '../../packages/solana/client.js';
import { provisionVault } from '../../packages/solana/provision.js';
import { bindingFor, SolanaAdapter } from '../../packages/adapters/solana.js';
import { inspectBinding, bindingMessage, type VaultConfiguration } from '../../packages/solana/binding.js';
import { serviceScope, deliveryMessage } from '../../packages/solana/reference.js';
import { syncOwnerDecisions } from '../../packages/solana/owner-sync.js';
import { LocalModelAdapter } from '../../packages/adapters/local-model.js';
import { createGateway } from '../../apps/gateway/src/app.js';
import { createReferenceService } from '../../apps/reference-service/src/service.js';
import { referenceTool } from '../../examples/existing-agent/reference-tool.js';
import { PendingRequestError } from '../../packages/sdk/src/index.js';
import { SpendingClient } from '../../packages/sdk/src/index.js';
import { transaction } from '../../apps/gateway/src/database.js';
import { migrate } from '../../apps/gateway/src/migrations.js';
import { credential } from '../../apps/gateway/src/store.js';
import { advanceResearch } from '../../examples/reference-agent/workflow.js';
import { runWorkerOnce } from '../../apps/worker/src/worker.js';

async function listen(server:Server){await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});return `http://127.0.0.1:${(server.address() as {port:number}).port}`;}
async function close(server:Server){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
async function until(check:()=>Promise<boolean>){for(let i=0;i<100;i++){if(await check())return;await new Promise(r=>setTimeout(r,150));}throw new Error('integration_state_timeout');}

test('vault → paid reference delivery → ledger → approval → report, with no billable model API', {timeout:180000},async t=>{
  assert.ok(process.env.TEST_DATABASE_URL&&process.env.SOLANA_RPC_URL&&process.env.SOLANA_PROGRAM_ID,'Use npm run test:integration');
  const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:10});
  const db=await pool.connect();try{await db.query('BEGIN');await migrate(db);await db.query('COMMIT');}finally{db.release();}
  const client=new VaultClient(process.env.SOLANA_RPC_URL,address(process.env.SOLANA_PROGRAM_ID));
  const owner=await generateKeyPairSigner(),agent=await generateKeyPairSigner(),service=await generateKeyPairSigner();
  await client.rpc.requestAirdrop(owner.address,lamports(8_000_000_000n)).send();
  await client.rpc.requestAirdrop(agent.address,lamports(2_000_000_000n)).send();
  await until(async()=> (await client.rpc.getBalance(owner.address,{commitment:'confirmed'}).send()).value>0n);
  const mint=await generateKeyPairSigner();
  await client.send(owner,[getCreateAccountInstruction({payer:owner,newAccount:mint,
    lamports:await client.rpc.getMinimumBalanceForRentExemption(BigInt(getMintSize())).send(),space:BigInt(getMintSize()),programAddress:TOKEN_PROGRAM_ADDRESS}),
    getInitializeMintInstruction({mint:mint.address,mintAuthority:owner.address,decimals:0})]);
  for(const wallet of [owner,service])await client.send(owner,[await getCreateAssociatedTokenInstructionAsync({payer:owner,owner:wallet.address,mint:mint.address})]);
  const source=(await findAssociatedTokenPda({owner:owner.address,mint:mint.address,tokenProgram:TOKEN_PROGRAM_ADDRESS}))[0];
  const recipient=(await findAssociatedTokenPda({owner:service.address,mint:mint.address,tokenProgram:TOKEN_PROGRAM_ADDRESS}))[0];
  await client.send(owner,[getMintToInstruction({mint:mint.address,token:source,mintAuthority:owner,amount:2000n})]);
  const config:VaultConfiguration={client,cluster:'localnet',mint:mint.address,agent:agent.address,recipientWallet:service.address};
  const gateway=createGateway(pool,{vault:config,localModel:true});
  const reference=createReferenceService({rpc:client.url,program:client.program,mint:mint.address,recipientWallet:service.address,cluster:'localnet'});
  const badService=createServer((_req,res)=>{res.writeHead(503);res.end('intentional delivery failure');});
  const apiURL=await listen(gateway),serviceURL=await listen(reference),badURL=await listen(badService);
  const ownerToken=credential(),sdk=new SpendingClient(apiURL,ownerToken);
  const policy={asset:{kind:'spl_token' as const,network:'localnet' as const,mint:mint.address,symbol:'TEST',decimals:0},
    budget:'120',perRequest:'60',approvalAbove:'30',calls:10,expiresAt:new Date(Date.now()+600000).toISOString(),
    providers:['local-model','solana'],tools:['research','reference'],recipients:['local-model','reference-service']};
  let task='',agentToken='',proof:any;
  let board:ReturnType<typeof createDashboard>|undefined,dom:JSDOM|undefined;
  const normal=new SolanaAdapter(pool,client,agent,serviceURL),model=new LocalModelAdapter(pool);
  const snapshot=()=>sdk.snapshot(task);
  const balance=async(key:Address)=>(await client.rpc.getTokenAccountBalance(key,{commitment:'confirmed'}).send()).value.amount;
  try{
    await t.test('provisioning retries deposit once, and binding rejects forgery and cross-workspace access',async()=>{
      const created=await sdk.createTask(policy);task=created.task;agentToken=created.agent;
      const attempts=await Promise.all([provisionVault(pool,config,ownerToken,task,owner),provisionVault(pool,config,ownerToken,task,owner)]);
      assert.equal(attempts[0].signature,attempts[1].signature);proof=attempts[0].proof;
      assert.equal(await balance(address(attempts[0].vault)),'120');
      assert.equal((await pool.query('SELECT count(*) FROM vault_provisions WHERE task_id=$1',[task])).rows[0].count,'1');
      const foreignToken=credential(),foreign=new SpendingClient(apiURL,foreignToken);await foreign.createTask(policy);
      const bind=async(token:string,body:unknown,id=task)=>fetch(`${apiURL}/api/tasks/${id}/vault`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)});
      assert.equal((await bind(foreignToken,proof)).status,403);
      assert.equal((await bind(agentToken,proof)).status,403);
      assert.equal((await bind(ownerToken,{...proof,signature:Buffer.alloc(64).toString('base64')})).status,403);
      const other=await sdk.createTask(policy);assert.equal((await bind(ownerToken,proof,other.task)).status,409);
      const raw=await transaction(pool,s=>s.task(task,ownerToken,true));
      const b=await bindingFor(pool,task);
      const wrongPolicy={...policy,budget:'119'};
      const signature=Buffer.from(await crypto.subtle.sign('Ed25519',owner.keyPair.privateKey,new Uint8Array(bindingMessage(task,raw.workspace_id,1,wrongPolicy,b,'localnet')))).toString('base64');
      await assert.rejects(inspectBinding(config,{...raw,policy:wrongPolicy},{...proof,signature}),/vault_policy_mismatch/);
      await assert.rejects(sdk.editPolicy(task,1,policy),/onchain_policy_immutable/);
    });
    await t.test('unpaid service access returns 402 and a copied proof cannot authorize another signer',async()=>{
      assert.equal((await fetch(`${serviceURL}/basic?topic=Solana`)).status,402);
      const url=new URL('/basic',serviceURL);url.searchParams.set('topic','Solana');url.searchParams.set('policy',proof.policy);url.searchParams.set('purchase','00'.repeat(32));
      assert.equal((await fetch(url,{headers:{'x-agent-signature':Buffer.alloc(64).toString('base64')}})).status,403);
    });
    await t.test('lost submission response reconciles one transfer and pauses the premium request for owner approval',async()=>{
      dom=new JSDOM('<div id="app"></div>',{url:apiURL});
      dom.window.sessionStorage.setItem('owner-key',ownerToken);
      board=createDashboard(dom.window.document.getElementById('app')!,((path:Parameters<typeof fetch>[0],init?:RequestInit)=>fetch(new URL(String(path),apiURL),init)) as typeof fetch);
      await until(async()=>!!dom!.window.document.getElementById('run-task'));
      assert.match(dom.window.document.body.textContent??'',/Model responses are simulated/);
      dom.window.document.getElementById('run-task')!.click();
      (dom.window.document.getElementById('run-topic') as HTMLInputElement).value='Safe agent spending on Solana';
      dom.window.document.getElementById('modal-submit')!.click();
      await until(async()=>!!(await pool.query('SELECT id FROM research_runs WHERE task_id=$1',[task])).rows.length);
      const duplicate=await fetch(`${apiURL}/api/tasks/${task}/research`,{method:'POST',headers:{authorization:`Bearer ${ownerToken}`,'content-type':'application/json'},body:JSON.stringify({topic:'Another run',mode:'local'})});assert.equal(duplicate.status,409);
      await advanceResearch(pool);await runWorkerOnce(pool,[model,normal]);await advanceResearch(pool);
      let submits=0;
      const lost=new SolanaAdapter(pool,client,agent,serviceURL,{broadcast:async wire=>{submits++;await client.rpc.sendTransaction(wire,{encoding:'base64',maxRetries:10n}).send();throw new Error('lost_response_after_submission');}});
      await runWorkerOnce(pool,[model,lost]);
      let current=await snapshot();assert.equal(current.reserved,'20');assert.equal(current.spent,'0');
      await until(async()=>{await runWorkerOnce(pool,[model,new SolanaAdapter(pool,client,agent,serviceURL)]);return (await snapshot()).spent==='20';});
      assert.equal(submits,1);
      await advanceResearch(pool);current=await snapshot();
      const approval=current.requests.find(r=>r.state==='approval');assert.ok(approval);
      assert.equal(approval.payload.amount,'40');
      await assert.rejects(new SpendingClient(apiURL,agentToken).approve(task,approval.id),/unauthorized/);
      await board!.refresh();
      await until(async()=>!!dom!.window.document.querySelector(`[data-approve="${task}:${approval.id}"]`));
      (dom!.window.document.querySelector(`[data-approve="${task}:${approval.id}"]`) as HTMLElement).click();
      await until(async()=>(await snapshot()).requests.find(r=>r.id===approval.id)?.state==='reserved');
      await runWorkerOnce(pool,[model,normal]);
      current=await snapshot();assert.equal(current.requests.find(r=>r.id===approval.id)?.state,'reserved');assert.equal(current.reserved,'40');
      await syncOwnerDecisions(pool,client,owner);await syncOwnerDecisions(pool,client,owner);
      assert.equal((await pool.query('SELECT count(*) FROM chain_approvals WHERE request_id=$1',[approval.id])).rows[0].count,'1');
    });
    await t.test('paid datasets reach the report and ledger, with real local receipts and simulated model labels',async()=>{
      await until(async()=>{await advanceResearch(pool);await runWorkerOnce(pool,[model,normal]);await advanceResearch(pool);return (await snapshot()).research[0]?.state==='complete';});
      await board!.refresh();
      await until(async()=>dom!.window.document.body.textContent?.includes('SIMULATED MODEL REPORT')??false);
      const final=await snapshot();assert.equal(final.spent,'60');assert.equal(final.reserved,'0');assert.equal(final.callsLeft,8);
      assert.equal(final.usage.length,4);assert.match(final.research[0].report??'',/SIMULATED MODEL/);
      const chainUsage=final.usage.filter(u=>u.receipt.cluster==='localnet');assert.equal(chainUsage.length,2);
      for(const u of chainUsage){assert.equal(u.receipt.fixture,false);assert.equal(u.receipt.selfOperatedService,true);assert.ok(u.receipt.chainReceipt);assert.ok(BigInt(String(u.receipt.feeLamports))>0n);assert.ok(BigInt(String(u.receipt.receiptRentLamports))>0n);assert.equal(u.delivery,'delivered');}
      assert.equal(await balance(recipient),'60');assert.equal(await balance(address(final.vault!.vault_address)),'60');
      const chain=await client.policy(address(final.vault!.policy_address),'confirmed');assert.equal(chain.spent,60n);
      // Repeating provisioning after spending must not top up or repeat a deposit.
      await provisionVault(pool,config,ownerToken,task,owner);
      assert.equal(await balance(address(final.vault!.vault_address)),'60');
      const attempts=(await pool.query('SELECT * FROM chain_attempts WHERE task_id=$1',[task])).rows;assert.equal(attempts.length,2);
      await Promise.all([normal.lookup(attempts[0].dispatch_id),normal.lookup(attempts[0].dispatch_id)]);
      assert.equal((await snapshot()).spent,'60');
      const first=attempts[0],r=(await pool.query('SELECT payload FROM requests WHERE dispatch_id=$1',[first.dispatch_id])).rows[0];
      const input=r.payload.input;
      const url=new URL(`/${input.dataset}`,serviceURL);url.searchParams.set('topic',input.topic);url.searchParams.set('policy',final.vault!.policy_address);url.searchParams.set('purchase',first.purchase_id);
      const fake=await generateKeyPairSigner();
      const forged=Buffer.from(await crypto.subtle.sign('Ed25519',fake.keyPair.privateKey,new Uint8Array(deliveryMessage(final.vault!.policy_address,first.purchase_id,input.dataset,input.topic)))).toString('base64');
      assert.equal((await fetch(url,{headers:{'x-agent-signature':forged}})).status,403);
    });
    await t.test('an existing agent tool waits for exact approval and resumes the same purchase after timeout',async()=>{
      const created=await sdk.createTask(policy);await provisionVault(pool,config,ownerToken,created.task,owner);
      const agentSDK=new SpendingClient(apiURL,created.agent),tool=referenceTool(agentSDK,created.task);
      const input={operationId:'external-job/basic',topic:'Existing agent integration',dataset:'basic' as const};
      await assert.rejects(tool(input,{timeoutMs:75}),PendingRequestError);
      const before=await sdk.snapshot(created.task);assert.equal(before.requests.length,1);const id=before.requests[0].id;
      const pending=tool(input,{timeoutMs:20000});
      await until(async()=>{await runWorkerOnce(pool,[normal]);return (await sdk.snapshot(created.task)).spent==='20';});
      const done=await pending;assert.equal(done.request.id,id);assert.equal(done.usage?.delivery,'delivered');
      assert.equal((await sdk.snapshot(created.task)).requests.length,1);
      const premium={operationId:'external-job/premium',topic:input.topic,dataset:'premium' as const};
      let approvalId='';const waiting=tool(premium,{timeoutMs:20000,onApproval:id=>{approvalId=id;}});
      await until(async()=>!!approvalId);
      await assert.rejects(agentSDK.approve(created.task,approvalId),/unauthorized/);
      await sdk.approve(created.task,approvalId);await syncOwnerDecisions(pool,client,owner);
      await until(async()=>{await runWorkerOnce(pool,[normal]);return (await sdk.snapshot(created.task)).spent==='60';});
      const result=await waiting;assert.equal(result.request.id,approvalId);assert.equal(result.usage?.delivery,'delivered');
      await assert.rejects(tool({...input,topic:'Changed payload'}),/idempotency_conflict/);
      await assert.rejects(agentSDK.submit(created.task,'above-cap',{provider:'solana',tool:'reference',recipient:'reference-service',amount:'61',input:{dataset:'basic',topic:input.topic}}),/hard_limit/);
      const final=await sdk.snapshot(created.task);assert.equal(final.requests.length,2);assert.equal(final.spent,'60');assert.equal(final.reserved,'0');
      assert.equal((await pool.query('SELECT count(*) FROM chain_attempts WHERE task_id=$1',[created.task])).rows[0].count,'2');
    });
    await t.test('confirmed payment with failed delivery remains charged and is never repaid',async()=>{
      const created=await sdk.createTask(policy);await provisionVault(pool,config,ownerToken,created.task,owner);
      const r=await new SpendingClient(apiURL,created.agent).submit(created.task,'failed-delivery',{provider:'solana',tool:'reference',recipient:'reference-service',amount:'20',input:{dataset:'basic',topic:'Delivery failure'}});
      const bad=new SolanaAdapter(pool,client,agent,badURL);
      await runWorkerOnce(pool,[model,bad]);
      await until(async()=>{await runWorkerOnce(pool,[model,bad]);return (await sdk.snapshot(created.task)).requests[0].state==='failed';});
      const current=await sdk.snapshot(created.task);assert.equal(current.spent,'20');assert.equal(current.reserved,'0');assert.equal(current.usage[0].delivery,'failed');
      const attempt=(await pool.query('SELECT * FROM chain_attempts WHERE task_id=$1',[created.task])).rows[0];
      const outcomes=await Promise.all([bad.lookup(attempt.dispatch_id),bad.lookup(attempt.dispatch_id)]);assert.deepEqual(outcomes[0],outcomes[1]);
      assert.equal((await pool.query('SELECT count(*) FROM chain_attempts WHERE task_id=$1',[created.task])).rows[0].count,'1');
      assert.equal((await new SpendingClient(apiURL,created.agent).submit(created.task,'failed-delivery',r.payload)).id,r.id);
    });
    await t.test('revocation is observed on chain and already-dispatched payment is still reconciled',async()=>{
      const created=await sdk.createTask(policy);await provisionVault(pool,config,ownerToken,created.task,owner);
      const agentSDK=new SpendingClient(apiURL,created.agent);
      const r=await agentSDK.submit(created.task,'revoke-race',{provider:'solana',tool:'reference',recipient:'reference-service',amount:'20',input:{dataset:'basic',topic:'Revocation after dispatch'}});
      await runWorkerOnce(pool,[model,normal]);await sdk.control(created.task,'revoke');
      assert.equal((await sdk.snapshot(created.task)).reserved,'20');
      await syncOwnerDecisions(pool,client,owner);
      await until(async()=>{await runWorkerOnce(pool,[model,normal]);return (await sdk.snapshot(created.task)).spent==='20';});
      const current=await sdk.snapshot(created.task);assert.equal(current.vault?.revoked,true);assert.equal(current.reserved,'0');
      const b=await bindingFor(pool,created.task);assert.equal((await client.policy(b.policy,'confirmed')).revoked,true);
      await assert.rejects(agentSDK.submit(created.task,'denied',r.payload),/task_inactive/);
      await assert.rejects(client.send(agent,[await client.purchaseInstruction(agent,b,bytes32('after-revoke'),'1',serviceScope('basic','Revocation after dispatch'))]));
      await client.withdraw(owner,b,source,'100');assert.equal(await balance(b.vault),'0');
    });
  }finally{board?.dispose();dom?.window.close();await close(gateway);await close(reference);await close(badService);await pool.end();}
});
