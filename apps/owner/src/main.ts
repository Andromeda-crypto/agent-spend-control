import pg from 'pg';
import { setTimeout } from 'node:timers/promises';
import { address } from '@solana/kit';
import { VaultClient, loadSigner } from '../../../packages/solana/client.js';
import { syncOwnerDecisions } from '../../../packages/solana/owner-sync.js';
const local=process.env.ENABLE_LOCALNET_MODEL==='true'&&process.env.SOLANA_CLUSTER==='localnet'||process.env.ENABLE_DEVNET_DEMO_MODEL==='true'&&process.env.SOLANA_CLUSTER==='devnet';
if(process.env.ENABLE_LIVE_EXECUTION!=='true'&&!local)throw new Error('live_execution_disabled');
const required=(name:string)=>{const value=process.env[name];if(!value)throw new Error(`missing_${name}`);return value;};
const pool=new pg.Pool({connectionString:required('DATABASE_URL')});
const watch=process.argv.includes('--watch'),shutdown=new AbortController();
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>shutdown.abort());
try{
  const client=new VaultClient(required('SOLANA_RPC_URL'),address(required('SOLANA_PROGRAM_ID'))),owner=await loadSigner(required('OWNER_WALLET_PATH'));
  do{
    try{await syncOwnerDecisions(pool,client,owner);if(!watch)console.log('Owner decisions synchronized.');}
    catch(error){if(!watch)throw error;console.error('Owner synchronization failed; decisions remain pending.');}
    if(watch&&!shutdown.signal.aborted)await setTimeout(1500,undefined,{signal:shutdown.signal}).catch(()=>{});
  }while(watch&&!shutdown.signal.aborted);
}finally{await pool.end();}
