import type pg from 'pg';
import type { KeyPairSigner } from '@solana/kit';
import { VaultClient, bytes32 } from './client.js';
import { bindingFor } from '../adapters/solana.js';
import { DatasetInput, serviceScope } from './reference.js';

/** Owner infrastructure only. Never load the owner signer into the agent SDK or model context. */
export async function syncOwnerDecisions(pool:pg.Pool,client:VaultClient,owner:KeyPairSigner){
  const revoked=(await pool.query(`SELECT v.task_id FROM vault_bindings v JOIN tasks t ON t.id=v.task_id WHERE t.revoked AND NOT v.revoked`)).rows;
  for(const row of revoked){
    const b=await bindingFor(pool,row.task_id);if(b.owner!==owner.address)continue;
    await client.revoke(owner,b);await pool.query('UPDATE vault_bindings SET revoked=true WHERE task_id=$1',[row.task_id]);
  }
  const approvals=(await pool.query(`SELECT r.* FROM requests r JOIN approvals a ON a.request_id=r.id
    LEFT JOIN chain_approvals c ON c.request_id=r.id WHERE r.state='reserved' AND r.payload->>'provider'='solana' AND c.request_id IS NULL`)).rows;
  for(const r of approvals){
    const b=await bindingFor(pool,r.task_id);if(b.owner!==owner.address)continue;
    const input=DatasetInput.parse(r.payload.input);
    const exception=await client.exception(owner,b,bytes32(r.id),r.payload.amount,serviceScope(input.dataset,input.topic));
    await pool.query('INSERT INTO chain_approvals(request_id,exception_address) VALUES($1,$2) ON CONFLICT DO NOTHING',[r.id,exception]);
  }
}
