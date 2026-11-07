import { address, type Address } from '@solana/kit';
import { getMintDecoder, getTokenDecoder, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { z } from 'zod';
import { createPublicKey, verify } from 'node:crypto';
import { bytes32, keyBytes, VaultClient, type Binding } from './client.js';
import { canonical, Policy } from '../policy/src/index.js';

export type VaultConfiguration = {
  client: VaultClient; cluster: 'localnet' | 'devnet';
  agent: Address; recipientWallet: Address; mint: Address;
};
export const BindingProof = z.object({
  policy: z.string(), owner: z.string(), recipientAccount: z.string(), signature: z.string().max(128),
}).strict();
export function bindingMessage(task: string, workspace: string, version: number, policy: unknown, b: Binding, cluster: string) {
  return Buffer.from(canonical({ purpose: 'agent-spend-control:bind-v1', task, workspace, version,
    policyHash: bytes32(canonical(Policy.parse(policy))).toString('hex'), cluster,
    program:b.program, policy:b.policy, vault:b.vault, mint:b.mint, owner:b.owner, agent:b.agent, recipient:b.recipient }));
}
export function verifyBindingSignature(message: Uint8Array, owner: Address, signature: string) {
  const key = createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),keyBytes(owner)]),format:'der',type:'spki'});
  if (!verify(null,message,key,Buffer.from(signature,'base64'))) throw new Error('invalid_binding_signature');
}

export async function inspectBinding(config: VaultConfiguration, task: { id:string; workspace_id:string; version:number; policy:unknown }, raw: unknown) {
  const proof=BindingProof.parse(raw),policy=Policy.parse(task.policy),owner=address(proof.owner);
  if(policy.asset.kind!=='spl_token'||policy.asset.network!==config.cluster||policy.asset.mint!==config.mint)throw new Error('vault_asset_mismatch');
  const taskSeed=bytes32(`task:${task.id}`);
  const expectedPolicy=await config.client.pda(Buffer.from('task'),keyBytes(owner),taskSeed);
  if(address(proof.policy)!==expectedPolicy)throw new Error('vault_task_mismatch');
  const b: Binding={program:config.client.program,policy:expectedPolicy,
    vault:await config.client.pda(Buffer.from('vault'),keyBytes(expectedPolicy)),mint:config.mint,
    recipient:address(proof.recipientAccount),owner,agent:config.agent,version:task.version};
  verifyBindingSignature(bindingMessage(task.id,task.workspace_id,task.version,policy,b,config.cluster),owner,proof.signature);
  await config.client.assertCluster(config.cluster);
  const commitment=config.cluster==='devnet'?'finalized':'confirmed';
  const chain=await config.client.policy(b.policy,commitment);
  if(chain.owner!==owner||chain.agent!==config.agent||chain.recipient!==config.recipientWallet||chain.mint!==config.mint
    ||chain.version!==task.version||chain.taskId!==taskSeed.toString('hex'))throw new Error('vault_identity_mismatch');
  if(chain.total!==BigInt(policy.budget)||chain.perPayment!==BigInt(policy.perRequest)||chain.approvalAbove!==BigInt(policy.approvalAbove)
    ||chain.expiresAt!==BigInt(Math.floor(Date.parse(policy.expiresAt)/1000))||chain.revoked||chain.spent!==0n)throw new Error('vault_policy_mismatch');
  const accounts=await config.client.rpc.getMultipleAccounts([b.mint,b.vault,b.recipient],{encoding:'base64',commitment}).send();
  const data=accounts.value.map(a=>{
    if(!a||a.owner!==TOKEN_PROGRAM_ADDRESS)throw new Error('invalid_token_account');
    return Buffer.from(a.data[0],'base64');
  });
  const mint=getMintDecoder().decode(data[0]),vault=getTokenDecoder().decode(data[1]),recipient=getTokenDecoder().decode(data[2]);
  if(!mint.isInitialized||mint.decimals!==policy.asset.decimals||vault.owner!==b.policy||vault.mint!==b.mint
    ||recipient.owner!==config.recipientWallet||recipient.mint!==b.mint
    ||vault.delegate.__option!=='None'||vault.closeAuthority.__option!=='None'||vault.state!==1||recipient.state!==1
    ||vault.amount<BigInt(policy.budget))throw new Error('vault_funding_or_token_mismatch');
  return b;
}
