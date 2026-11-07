import type pg from 'pg';
import type { KeyPairSigner } from '@solana/kit';
import { VaultClient, bytes32 } from './client.js';
import { bindingFor } from '../adapters/solana.js';
import { DatasetInput, serviceScope } from './reference.js';
import { canonical } from '../policy/src/index.js';

/** Owner infrastructure only. The agent process never receives this signer. */
export async function syncOwnerDecisions(pool:pg.Pool,client:VaultClient,owner:KeyPairSigner){
  const revoked=(await pool.query(`SELECT v.task_id FROM vault_bindings v JOIN tasks t ON t.id=v.task_id WHERE t.revoked AND NOT v.revoked`)).rows;
  for(const row of revoked){
    const b=await bindingFor(pool,row.task_id);if(b.owner!==owner.address||b.program!==client.program)continue;
    await client.assertCluster(b.cluster);
    const commitment=b.cluster==='devnet'?'finalized':'confirmed';
    if(!(await client.policy(b.policy,commitment)).revoked)await client.revoke(owner,b);
    // Mark only after independently observing the requested chain state.
    if((await client.policy(b.policy,commitment)).revoked)
      await pool.query('UPDATE vault_bindings SET revoked=true WHERE task_id=$1',[row.task_id]);
  }
  const approvals=(await pool.query(`SELECT r.*,a.payload_hash,a.policy_version FROM requests r JOIN approvals a ON a.request_id=r.id
    JOIN tasks t ON t.id=r.task_id LEFT JOIN chain_approvals c ON c.request_id=r.id
    WHERE r.state='reserved' AND NOT t.revoked AND NOT t.paused AND r.version=t.version
    AND r.payload->>'provider'='solana' AND c.request_id IS NULL`)).rows;
  for(const r of approvals){
    const b=await bindingFor(pool,r.task_id);if(b.owner!==owner.address||b.program!==client.program)continue;
    if(r.policy_version!==r.version||r.payload_hash!==bytes32(canonical(r.payload)).toString('hex'))throw new Error('approval_binding_mismatch');
    await client.assertCluster(b.cluster);
    const input=DatasetInput.parse(r.payload.input);
    const exception=await client.exception(owner,b,bytes32(r.id),r.payload.amount,serviceScope(input.dataset,input.topic));
    await pool.query('INSERT INTO chain_approvals(request_id,exception_address) VALUES($1,$2) ON CONFLICT DO NOTHING',[r.id,exception]);
  }
}
