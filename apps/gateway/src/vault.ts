import type pg from 'pg';
import { transaction } from './database.js';
import { canonical, Policy } from '../../../packages/policy/src/index.js';
import { BindingProof, bindingMessage, inspectBinding, verifyBindingSignature, type VaultConfiguration } from '../../../packages/solana/binding.js';
import { bindingFor } from '../../../packages/adapters/solana.js';

/** Authenticate, inspect the chain without locks, then atomically revalidate and bind. */
export async function bindVault(pool:pg.Pool,config:VaultConfiguration,taskId:string,ownerToken:string,raw:unknown){
  const before=await transaction(pool,s=>s.task(taskId,ownerToken,true));
  const existing=(await pool.query('SELECT task_id FROM vault_bindings WHERE task_id=$1',[taskId])).rows[0];
  let b;
  if(existing){
    b=await bindingFor(pool,taskId);
    const proof=BindingProof.parse(raw);
    if(b.program!==config.client.program||b.cluster!==config.cluster||b.agent!==config.agent||b.mint!==config.mint
      ||proof.policy!==b.policy||proof.owner!==b.owner||proof.recipientAccount!==b.recipient)throw new Error('binding_conflict');
    verifyBindingSignature(bindingMessage(taskId,before.workspace_id,before.version,before.policy,b,b.cluster),b.owner,proof.signature);
  }else b=await inspectBinding(config,before,raw);
  return transaction(pool,async s=>s.bindVault(taskId,ownerToken,canonical(Policy.parse(before.policy)),before.version,b,config.cluster));
}
