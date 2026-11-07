import pg from 'pg';
import { address } from '@solana/kit';
import { VaultClient, loadSigner } from '../../../packages/solana/client.js';
import { syncOwnerDecisions } from '../../../packages/solana/owner-sync.js';
if(process.env.ENABLE_LIVE_EXECUTION!=='true')throw new Error('live_execution_disabled');
const required=(name:string)=>{const value=process.env[name];if(!value)throw new Error(`missing_${name}`);return value;};
const pool=new pg.Pool({connectionString:required('DATABASE_URL')});
try{await syncOwnerDecisions(pool,new VaultClient(required('SOLANA_RPC_URL'),address(required('SOLANA_PROGRAM_ID'))),await loadSigner(required('OWNER_WALLET_PATH')));console.log('Owner decisions synchronized.');}
finally{await pool.end();}
