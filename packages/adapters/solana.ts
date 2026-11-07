import { address, signature as parseSignature, type Base64EncodedWireTransaction, type KeyPairSigner } from '@solana/kit';
import { Confirmed, type Adapter, type Outcome } from './index.js';
import type { Purchase } from '../policy/src/index.js';
import { VaultClient, bytes32, keyBytes, type Binding } from '../solana/client.js';
import { DatasetInput, serviceScope, deliveryMessage } from '../solana/reference.js';
interface DB { query(sql:string,params?:any[]):Promise<{rows:any[]}> }
export async function bindingFor(db:DB,task:string):Promise<Binding & {cluster:'localnet'|'devnet'}>{
  const b=(await db.query('SELECT * FROM vault_bindings WHERE task_id=$1',[task])).rows[0];
  if(!b)throw new Error('vault_not_configured');
  return {program:address(b.program_id),policy:address(b.policy_address),vault:address(b.vault_address),mint:address(b.mint),recipient:address(b.recipient_account),owner:address(b.owner_address),agent:address(b.agent_address),version:b.chain_version,cluster:b.cluster};
}
export class SolanaAdapter implements Adapter {
  provider='solana';tool='reference';recipient='reference-service';version:string;
  constructor(private db:DB,private client:VaultClient,private agent:KeyPairSigner,private serviceURL:string,private options:{broadcast?:(wire:Base64EncodedWireTransaction)=>Promise<string>}={}){
    this.version=`solana-v1:${client.program}`;
    const url=new URL(serviceURL);if(url.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('reference_https_required');
  }
  quote(p:Purchase){return DatasetInput.parse(p.input).dataset==='basic'?'20':'40';}
  async execute(dispatchId:string,p:Purchase,context?:{task:string;request:string}):Promise<Outcome>{
    if(!context)throw new Error('trusted_task_context_required');
    if((await this.db.query('SELECT dispatch_id FROM chain_attempts WHERE dispatch_id=$1',[dispatchId])).rows.length)return this.lookup(dispatchId);
    const b=await bindingFor(this.db,context.task),input=DatasetInput.parse(p.input);
    await this.client.assertCluster(b.cluster);
    if(b.program!==this.client.program||b.agent!==this.agent.address)throw new Error('vault_identity_mismatch');
    const stored=(await this.db.query('SELECT policy FROM tasks WHERE id=$1',[context.task])).rows[0];
    if(stored.policy.asset?.mint!==b.mint||stored.policy.asset?.network!==b.cluster)throw new Error('vault_asset_mismatch');
    const purchaseId=bytes32(dispatchId),scope=serviceScope(input.dataset,input.topic);
    const exception=await this.client.pda(Buffer.from('exception'),keyBytes(b.policy),purchaseId);
    const exists=(await this.client.rpc.getAccountInfo(exception,{encoding:'base64',commitment:'confirmed'}).send()).value;
    const ix=await this.client.purchaseInstruction(this.agent,b,purchaseId,p.amount,scope,exists?exception:undefined);
    const prepared=await this.client.prepare(this.agent,[ix]);
    await this.db.query('INSERT INTO chain_attempts(dispatch_id,task_id,purchase_id,scope,signature,wire) VALUES($1,$2,$3,$4,$5,$6)',
      [dispatchId,context.task,purchaseId.toString('hex'),scope.toString('hex'),prepared.signature,prepared.wire]);
    // Persist before broadcast. Neither a timeout nor restart causes this transaction to be sent again.
    const accepted=await (this.options.broadcast?this.options.broadcast(prepared.wire):this.client.rpc.sendTransaction(prepared.wire,{encoding:'base64',preflightCommitment:'confirmed',maxRetries:10n}).send());
    if(accepted!==prepared.signature)throw new Error('rpc_signature_mismatch');
    return {status:'pending'};
  }
  async lookup(dispatchId:string):Promise<Outcome>{
    const saved=(await this.db.query("SELECT outcome FROM provider_receipts WHERE dispatch_id=$1 AND provider='solana'",[dispatchId])).rows[0];
    if(saved)return Confirmed.parse(saved.outcome);
    const a=(await this.db.query('SELECT * FROM chain_attempts WHERE dispatch_id=$1',[dispatchId])).rows[0];
    if(!a)return {status:'pending'};
    const b=await bindingFor(this.db,a.task_id);
    if(b.program!==this.client.program||b.agent!==this.agent.address)throw new Error('vault_identity_mismatch');
    await this.client.assertCluster(b.cluster);
    const receipt=await this.client.receipt(b,Buffer.from(a.purchase_id,'hex'),b.cluster==='devnet'?'finalized':'confirmed');
    if(!receipt)return {status:'pending'};
    if(receipt.scope!==a.scope||receipt.version!==b.version)throw new Error('chain_receipt_mismatch');
    const r=(await this.db.query('SELECT payload FROM requests WHERE dispatch_id=$1',[dispatchId])).rows[0];
    if(receipt.amount!==r.payload.amount)throw new Error('chain_amount_mismatch');
    const confirmation=b.cluster==='devnet'?'finalized':'confirmed';
    const transaction=await this.client.rpc.getTransaction(parseSignature(a.signature),{encoding:'json',commitment:confirmation,maxSupportedTransactionVersion:0}).send();
    if(!transaction)return {status:'pending'};
    if(transaction.meta?.err||!transaction.transaction.message.accountKeys.includes(receipt.address)
      ||!transaction.transaction.message.accountKeys.includes(b.program))throw new Error('chain_transaction_mismatch');

    const input=DatasetInput.parse(r.payload.input);
    const url=new URL(`/${input.dataset}`,this.serviceURL);url.searchParams.set('topic',input.topic);url.searchParams.set('policy',b.policy);url.searchParams.set('purchase',a.purchase_id);
    const signature=Buffer.from(await crypto.subtle.sign('Ed25519',this.agent.keyPair.privateKey,new Uint8Array(deliveryMessage(b.policy,a.purchase_id,input.dataset,input.topic)))).toString('base64');
    let delivery:'delivered'|'failed'='failed',data:unknown=null;
    try{const response=await fetch(url,{headers:{'x-agent-signature':signature},signal:AbortSignal.timeout(15000)});if(response.ok){data=await response.json();delivery='delivered';}}catch{}
    const outcome=Confirmed.parse({status:'confirmed',chargedAmount:receipt.amount,calls:0,delivery,receipt:{fixture:false,cluster:b.cluster,signature:a.signature,
      explorer:b.cluster==='devnet'?`https://explorer.solana.com/tx/${a.signature}?cluster=devnet`:null,policy:b.policy,mint:b.mint,chainReceipt:receipt.address,selfOperatedService:true,confirmation,feeLamports:transaction.meta?.fee.toString()??null,receiptRentLamports:receipt.rentLamports,data}});
    await this.db.query("INSERT INTO provider_receipts(dispatch_id,provider,outcome) VALUES($1,'solana',$2) ON CONFLICT(dispatch_id) DO NOTHING",[dispatchId,outcome]);
    return Confirmed.parse((await this.db.query("SELECT outcome FROM provider_receipts WHERE dispatch_id=$1 AND provider='solana'",[dispatchId])).rows[0].outcome);
  }
}
