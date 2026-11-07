import type pg from 'pg';
import { signature as parseSignature, type KeyPairSigner } from '@solana/kit';
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { transaction } from '../../apps/gateway/src/database.js';
import { bindVault } from '../../apps/gateway/src/vault.js';
import { canonical, Policy } from '../policy/src/index.js';
import { bindingMessage, type VaultConfiguration } from './binding.js';
import { bytes32, type Binding } from './client.js';

/** Operator-only provisioning. Create+deposit is one atomic, replay-resistant chain transaction. */
export async function provisionVault(pool:pg.Pool,config:VaultConfiguration,ownerToken:string,taskId:string,owner:KeyPairSigner) {
  const task=await transaction(pool,s=>s.task(taskId,ownerToken,true));
  const policy=Policy.parse(task.policy);
  if(task.version!==1)throw new Error('new_task_required_for_vault');
  if(task.revoked||task.paused)throw new Error('task_inactive');
  if(policy.asset.kind!=='spl_token'||policy.asset.network!==config.cluster||policy.asset.mint!==config.mint)throw new Error('vault_asset_mismatch');
  await config.client.assertCluster(config.cluster);
  const source=(await findAssociatedTokenPda({owner:owner.address,mint:config.mint,tokenProgram:TOKEN_PROGRAM_ADDRESS}))[0];
  const recipient=(await findAssociatedTokenPda({owner:config.recipientWallet,mint:config.mint,tokenProgram:TOKEN_PROGRAM_ADDRESS}))[0];
  const create=await config.client.createInstruction(owner,config.mint,config.agent,config.recipientWallet,bytes32(`task:${taskId}`),
    policy.budget,policy.perRequest,policy.approvalAbove,BigInt(Math.floor(Date.parse(policy.expiresAt)/1000)));
  const b:Binding={program:config.client.program,policy:create.policy,vault:create.vault,mint:config.mint,recipient,
    owner:owner.address,agent:config.agent,version:task.version};
  const message=bindingMessage(taskId,task.workspace_id,task.version,policy,b,config.cluster);
  const plan={binding:b,cluster:config.cluster};
  const policyHash=bytes32(canonical(policy)).toString('hex');
  const previous=(await pool.query('SELECT * FROM vault_provisions WHERE task_id=$1',[taskId])).rows[0];
  let prepared=previous;
  if(!prepared){
    const wire=await config.client.prepare(owner,[create.instruction,config.client.depositInstruction(owner,b,source,policy.budget)]);
    prepared=await transaction(pool,async s=>{
      const latest=await s.task(taskId,ownerToken,true);
      if(latest.version!==task.version||canonical(Policy.parse(latest.policy))!==canonical(policy)||latest.paused||latest.revoked)throw new Error('policy_version_conflict');
      // This task-row lock also serializes concurrent provisioning commands.
      return s.saveProvision(taskId,policyHash,plan,wire.signature,wire.wire);
    });
  }
  if(prepared.policy_hash!==policyHash||canonical(prepared.plan)!==canonical(plan))throw new Error('provisioning_conflict');
  const commitment=config.cluster==='devnet'?'finalized':'confirmed';
  const exists=(await config.client.rpc.getAccountInfo(b.policy,{encoding:'base64',commitment}).send()).value;
  if(!exists){
    // Re-broadcasting this identical signed atomic transaction cannot deposit twice.
    const accepted=await config.client.rpc.sendTransaction(prepared.wire,{encoding:'base64',preflightCommitment:'confirmed',maxRetries:10n}).send();
    if(accepted!==prepared.signature)throw new Error('rpc_signature_mismatch');
    for(let i=0;i<100;i++){
      const status=(await config.client.rpc.getSignatureStatuses([parseSignature(prepared.signature)],{searchTransactionHistory:true}).send()).value[0];
      if(status?.err)throw new Error('provisioning_transaction_failed');
      if(status&&(commitment==='finalized'?status.confirmationStatus==='finalized':status.confirmationStatus!=='processed'))break;
      await new Promise(resolve=>setTimeout(resolve,500));
    }
  }
  const proof={policy:b.policy,owner:b.owner,recipientAccount:b.recipient,
    signature:Buffer.from(await crypto.subtle.sign('Ed25519',owner.keyPair.privateKey,new Uint8Array(message))).toString('base64')};
  const result=await bindVault(pool,config,taskId,ownerToken,proof);
  return {...result,signature:prepared.signature as string,proof};
}
