import { createServer } from 'node:net';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { mkdir, readFile, writeFile, access, open } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { address, createKeyPairSignerFromBytes, generateKeyPairSigner, lamports, type KeyPairSigner } from '@solana/kit';
import { getCreateAccountInstruction, getTransferSolInstruction } from '@solana-program/system';
import { TOKEN_PROGRAM_ADDRESS, getMintSize, getInitializeMintInstruction, getCreateAssociatedTokenInstructionAsync, findAssociatedTokenPda, getMintToInstruction } from '@solana-program/token';
import { VaultClient } from '../packages/solana/client.js';
import { provisionVault } from '../packages/solana/provision.js';
import { transaction } from '../apps/gateway/src/database.js';
import { migrate } from '../apps/gateway/src/migrations.js';
import { credential } from '../apps/gateway/src/store.js';
import { SpendingClient } from '../packages/sdk/src/index.js';

const devnet=process.argv.includes('--devnet'),cluster=devnet?'devnet':'localnet';
const exec=promisify(execFile),state=resolve(devnet?'.local/devnet-demo':'.local/local-demo-v2');
await mkdir(state,{recursive:true,mode:0o700});
const binaries=process.env.SOLANA_BIN??join(homedir(),'.local/share/solana/install/active_release/bin');
const pgBinary=(name:string)=>process.env.PG_BIN?join(process.env.PG_BIN,name):name;
const pgPort=devnet?54330:54329,rpcPort=18899;
const dbURL=`postgres://spend@127.0.0.1:${pgPort}/postgres`,rpcURL=devnet?'https://api.devnet.solana.com':`http://127.0.0.1:${rpcPort}`;
async function available(preferred:number):Promise<number>{return new Promise((resolve,reject)=>{const server=createServer();server.once('error',error=>{if((error as NodeJS.ErrnoException).code==='EADDRINUSE')void available(0).then(resolve,reject);else reject(error);});server.listen(preferred,'127.0.0.1',()=>{const port=(server.address() as {port:number}).port;server.close(()=>resolve(port));});});}
const apiPort=await available(devnet?3201:3101),referencePort=await available(devnet?3202:3102),webPort=await available(devnet?5175:5174);
const replayPort=await available(5176);
const apiURL=`http://127.0.0.1:${apiPort}`,referenceURL=`http://127.0.0.1:${referencePort}`,webURL=`http://127.0.0.1:${webPort}`;
const children:ChildProcess[]=[],logs:Awaited<ReturnType<typeof open>>[]=[],stop=new AbortController();
const smoke=process.argv.includes('--smoke');let stopping=false;
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>stop.abort());
async function exists(path:string){try{await access(path);return true;}catch{return false;}}
async function child(name:string,command:string,args:string[],env:NodeJS.ProcessEnv=process.env){
  const log=await open(join(state,`${name}.log`),'a',0o600);logs.push(log);
  const p=spawn(command,args,{stdio:['ignore',log.fd,log.fd],env});children.push(p);roles.set(p,name);
  p.once('error',()=>{console.error(`${name} could not start; see ${state}/${name}.log`);stop.abort();});
  p.once('exit',code=>{if(!stopping){console.error(`${name} exited (${code}); see ${state}/${name}.log`);stop.abort();}});
  return p;
}
async function ready(check:()=>Promise<boolean>,name:string){for(let i=0;i<200;i++){if(stop.signal.aborted)throw new Error(`${name}_startup_interrupted`);try{if(await check())return;}catch{}await new Promise(r=>setTimeout(r,150));}throw new Error(`${name}_startup_timeout`);}
async function wallet(name:string):Promise<KeyPairSigner>{
  const path=join(state,`${name}.wallet.json`);
  if(!await exists(path)){
    const key=await generateKeyPairSigner(true);
    const seed=Buffer.from(await crypto.subtle.exportKey('pkcs8',key.keyPair.privateKey)).subarray(-32);
    const pub=Buffer.from(await crypto.subtle.exportKey('raw',key.keyPair.publicKey));
    await writeFile(path,JSON.stringify([...seed,...pub]),{mode:0o600});
  }
  return createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(await readFile(path,'utf8'))));
}
const binary=await readFile('target/deploy/spending_vault.so');
const binaryHash=createHash('sha256').update(binary).digest('hex');
const program=(await readFile('programs/spending-vault/src/lib.rs','utf8')).match(/declare_id!\("([^"]+)"\)/)![1];
let stage='startup';
let pool:pg.Pool|undefined,activeClient:VaultClient|undefined;
const roles=new Map<ChildProcess,string>();
async function checkpoint(){
  if(devnet||!activeClient)return;
  const target=(await activeClient.rpc.getSlot({commitment:'confirmed'}).send());
  console.log('Waiting for the local ledger to finalize before shutdown.');
  for(let i=0;i<80;i++){
    if((await activeClient.rpc.getSlot({commitment:'finalized'}).send())>=target)return;
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw new Error('Local ledger checkpoint did not finalize; keep its state for investigation.');
}
try{
  const metadataPath=join(state,'network.json');
  const metadata=await exists(metadataPath)?JSON.parse(await readFile(metadataPath,'utf8')):null;
  if(metadata&&(metadata.binaryHash!==binaryHash||metadata.program!==program))throw new Error('Local ledger uses a different program build. Preserve its data and use a new local demo directory before rebuilding the demo.');
  if(!await exists(join(state,'postgres/PG_VERSION')))await exec(pgBinary('initdb'),['-D',join(state,'postgres'),'-A','trust','-U','spend','--no-locale']);
  await child('postgres',pgBinary('postgres'),['-D',join(state,'postgres'),'-h','127.0.0.1','-k',state,'-p',String(pgPort)]);
  pool=new pg.Pool({connectionString:dbURL});
  pool.on('error',()=>{if(!stopping){console.error('Local database connection closed unexpectedly.');stop.abort();}});
  await ready(async()=>{await pool!.query('SELECT 1');return true;},'postgres');
  const migration=await pool.connect();try{await migration.query('BEGIN');await migrate(migration);await migration.query('COMMIT');}finally{migration.release();}
  const owner=devnet?await createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(await readFile('.local/devnet-deployer.wallet.json','utf8')))):await wallet('owner'),agent=await wallet('agent'),recipientWallet=await wallet('service'),mint=await wallet('mint');
  if(!devnet){
  await child('validator',join(binaries,'solana-test-validator'),['--ledger',join(state,'ledger'),'--rpc-port',String(rpcPort),
    '--faucet-port','18901','--gossip-port','18902','--bind-address','127.0.0.1','--bpf-program',program,'target/deploy/spending_vault.so','--mint',owner.address,'--quiet']);
  await ready(async()=>{const r=await fetch(rpcURL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getHealth'})});return (await r.json()).result==='ok';},'validator');
  }
  const client=new VaultClient(rpcURL,address(program));activeClient=client;await client.assertCluster(cluster);
  if(!devnet)await ready(async()=>(await client.rpc.getSlot({commitment:'finalized'}).send())>0n,'validator replay and root');
  await ready(async()=>(await client.rpc.getBalance(owner.address,{commitment:'confirmed'}).send()).value>0n,'wallet funding');
  stage='agent fee funding';
  // RPC health/balance can become readable before the restarted validator's
  // transaction bank is ready. Require successful preflight before any write.
  if(!devnet)await ready(async()=>{
    const probe=await client.prepare(owner,[getTransferSolInstruction({source:owner,destination:agent.address,amount:1n})]);
    return (await client.rpc.simulateTransaction(probe.wire,{encoding:'base64',commitment:'confirmed'}).send()).value.err===null;
  },'validator transaction bank');
  if((await client.rpc.getBalance(agent.address,{commitment:'confirmed'}).send()).value<10_000_000n)
    await client.send(owner,[getTransferSolInstruction({source:owner,destination:agent.address,amount:30_000_000n})]);
  stage='mint initialization';
  if(!(await client.rpc.getAccountInfo(mint.address,{encoding:'base64',commitment:'confirmed'}).send()).value){
    await client.send(owner,[getCreateAccountInstruction({payer:owner,newAccount:mint,lamports:await client.rpc.getMinimumBalanceForRentExemption(BigInt(getMintSize())).send(),space:BigInt(getMintSize()),programAddress:TOKEN_PROGRAM_ADDRESS}),
      getInitializeMintInstruction({mint:mint.address,mintAuthority:owner.address,decimals:0})]);
  }
  stage='token-account initialization';
  for(const who of [owner,recipientWallet]){
    const ata=(await findAssociatedTokenPda({owner:who.address,mint:mint.address,tokenProgram:TOKEN_PROGRAM_ADDRESS}))[0];
    if(!(await client.rpc.getAccountInfo(ata,{encoding:'base64',commitment:'confirmed'}).send()).value)
      await client.send(owner,[await getCreateAssociatedTokenInstructionAsync({payer:owner,owner:who.address,mint:mint.address})]);
  }
  const source=(await findAssociatedTokenPda({owner:owner.address,mint:mint.address,tokenProgram:TOKEN_PROGRAM_ADDRESS}))[0];
  stage='minting demo allowance';
  if(BigInt((await client.rpc.getTokenAccountBalance(source,{commitment:'confirmed'}).send()).value.amount)<120n)
    await client.send(owner,[getMintToInstruction({mint:mint.address,token:source,mintAuthority:owner,amount:1200n})]);
  await writeFile(metadataPath,JSON.stringify({binaryHash,program,mint:mint.address},null,2),{mode:0o600});
  const accessPath=join(state,'access.json');
  let saved:any=await exists(accessPath)?JSON.parse(await readFile(accessPath,'utf8')):null;
  if(!saved||smoke||process.argv.includes('--new-task')){
    const ownerToken=saved?.ownerToken??credential();
    const created=await transaction(pool,s=>s.create(ownerToken,{asset:{kind:'spl_token',network:cluster,mint:mint.address,symbol:'TEST',decimals:0},
      budget:'120',perRequest:'60',approvalAbove:'30',maxOutputTokens:512,calls:10,expiresAt:new Date(Date.now()+7*86400000).toISOString(),
      providers:['local-model','solana'],tools:['research','reference'],recipients:['local-model','reference-service']}));
    saved={ownerToken,task:created.task,agentToken:created.agent};
    await writeFile(accessPath,JSON.stringify(saved,null,2),{mode:0o600});
  }
  stage='vault provisioning';
  if(!(await pool.query('SELECT task_id FROM vault_bindings WHERE task_id=$1',[saved.task])).rows.length)
    await provisionVault(pool,{client,cluster,mint:mint.address,agent:agent.address,recipientWallet:recipientWallet.address},saved.ownerToken,saved.task,owner);
  stage='service startup';
  const baseEnv={...process.env,OPENAI_API_KEY:undefined,OPENAI_MODEL:undefined,ENABLE_LIVE_EXECUTION:'false',ENABLE_FIXTURE_ADAPTER:'true',
    ENABLE_LOCALNET_MODEL:devnet?'false':'true',ENABLE_DEVNET_DEMO_MODEL:devnet?'true':'false',SOLANA_CLUSTER:cluster,SOLANA_RPC_URL:rpcURL,SOLANA_PROGRAM_ID:program,
    REFERENCE_MINT:mint.address,REFERENCE_RECIPIENT:recipientWallet.address,AGENT_PUBLIC_KEY:agent.address,
    OWNER_WALLET_PATH:undefined,AGENT_WALLET_PATH:undefined,OWNER_TOKEN:undefined};
  const publicEnv={...baseEnv,DATABASE_URL:dbURL,PORT:String(apiPort),REFERENCE_PORT:String(referencePort),HOST:'127.0.0.1',REFERENCE_SERVICE_URL:referenceURL};
  await child('gateway',process.execPath,['--import','tsx','apps/gateway/src/server.ts'],publicEnv);
  await child('reference',process.execPath,['--import','tsx','apps/reference-service/src/main.ts'],publicEnv);
  await ready(async()=>(await fetch(`${apiURL}/health`)).ok,'gateway');
  await ready(async()=>(await fetch(`${referenceURL}/catalog`)).ok,'reference service');
  await child('worker',process.execPath,['--import','tsx','apps/worker/src/main.ts','--watch'],{...publicEnv,AGENT_WALLET_PATH:join(state,'agent.wallet.json')});
  await child('owner-sync',process.execPath,['--import','tsx','apps/owner/src/main.ts','--watch'],{...publicEnv,OWNER_WALLET_PATH:devnet?resolve('.local/devnet-deployer.wallet.json'):join(state,'owner.wallet.json')});
  await child('replay',process.execPath,['node_modules/vite/bin/vite.js','--config','apps/replay/vite.config.ts','apps/replay','--strictPort','--port',String(replayPort)],{...baseEnv,REPLAY_BASE:'/replay/'});
  await child('web',process.execPath,['node_modules/vite/bin/vite.js','--config','apps/web/vite.config.ts','apps/web','--force','--strictPort','--port',String(webPort)],{...baseEnv,GATEWAY_TARGET:apiURL,REPLAY_TARGET:`http://127.0.0.1:${replayPort}`});
  await ready(async()=>(await fetch(webURL)).ok,'dashboard');
  console.log(`Dashboard: ${webURL}`);
  console.log(`Sign in with the owner key in ${state}/access.json (kept private; never printed).`);
  console.log(`Actual ${cluster} test-token transfers · simulated model · OpenAI disabled. Ctrl+C stops this stack; data is retained.`);
  if(smoke){
    const sdk=new SpendingClient(apiURL,saved.ownerToken);
    const response=await fetch(`${apiURL}/api/tasks/${saved.task}/research`,{method:'POST',headers:{authorization:`Bearer ${saved.ownerToken}`,'content-type':'application/json'},body:JSON.stringify({topic:'Safe spending on Solana',mode:devnet?'devnet-demo':'local'})});
    if(!response.ok)throw new Error('Smoke run needs a fresh, unused local-demo task.');
    let passed=false;
    for(let i=0;i<(devnet?360:150);i++){
      if(stop.signal.aborted)throw new Error('smoke_interrupted');
      const task=await sdk.snapshot(saved.task);
      for(const r of task.requests.filter(r=>r.state==='approval'))await sdk.approve(saved.task,r.id);
      if(task.research[0]?.state==='complete'){
        if(task.spent!=='60'||task.reserved!=='0'||task.usage.filter(u=>u.receipt.cluster===cluster).length!==2)throw new Error('smoke_accounting_mismatch');
        passed=true;break;
      }
      await new Promise(r=>setTimeout(r,500));
    }
    if(!passed)throw new Error('smoke_workflow_timeout');
    console.log(`${cluster} stack smoke passed: 2 actual token payments, 60 TEST units, simulated model.`);
    if(devnet){const final=await sdk.snapshot(saved.task);await mkdir('docs/deployments',{recursive:true});await writeFile('docs/deployments/devnet-workflow.json',JSON.stringify({cluster,program,mint:mint.address,task:saved.task,spent:final.spent,receipts:final.usage.filter(u=>u.receipt.cluster==='devnet').map(u=>u.receipt)},null,2)+'\n');}
  }else if(!stop.signal.aborted)await once(stop.signal,'abort');
}catch(error){console.error(`${stage}: ${error instanceof Error?error.message:'Local demo failed'}`);process.exitCode=1;}
finally{
  stopping=true;
  await pool?.end();
  for(const p of children.reverse())if(p.exitCode===null&&p.signalCode===null&&p.pid){if(roles.get(p)==='validator'){try{await checkpoint();}catch(error){console.error(error instanceof Error?error.message:'Local finality check failed');process.exitCode=1;}}const ended=once(p,'exit');p.kill(roles.get(p)==='validator'?'SIGINT':'SIGTERM');const timer=setTimeout(()=>p.kill('SIGKILL'),5000);await ended;clearTimeout(timer);}
  for(const log of logs)await log.close();
}
