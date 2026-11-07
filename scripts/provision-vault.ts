import pg from 'pg';
import { vaultConfiguration } from '../apps/gateway/src/configuration.js';
import { loadSigner } from '../packages/solana/client.js';
import { provisionVault } from '../packages/solana/provision.js';
const config=vaultConfiguration();
if(!config)throw new Error('Complete the public Solana vault configuration first.');
const task=process.argv[2];
if(!task||!process.env.OWNER_TOKEN||!process.env.OWNER_WALLET_PATH)throw new Error('Usage: npm run vault:provision -- TASK_ID; set OWNER_TOKEN and OWNER_WALLET_PATH securely.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try{
  const result=await provisionVault(pool,config,process.env.OWNER_TOKEN,task,await loadSigner(process.env.OWNER_WALLET_PATH));
  // Public addresses and the transaction signature only; never print credentials or key material.
  console.log(JSON.stringify({task:result.task,policy:result.policy,vault:result.vault,signature:result.signature,cluster:config.cluster},null,2));
}finally{await pool.end();}
