import { createServer } from 'node:http';
import { createPublicKey, verify } from 'node:crypto';
import { address, type Address } from '@solana/kit';
import { z } from 'zod';
import { VaultClient, keyBytes, type Binding } from '../../../packages/solana/client.js';
import { DatasetInput, serviceScope, deliveryMessage } from '../../../packages/solana/reference.js';
export const datasets = {
  basic:{title:'Solana spending controls',content:'A task vault can hold SPL tokens under a program-derived authority. Agent purchases must pass the program rules before a token transfer. API-provider billing remains separate from on-chain token budgets.',sources:['https://solana.com/docs/core/pda','https://solana.com/docs/tokens/basics/transfer-tokens']},
  premium:{title:'Designing safe agent payment recovery',content:'Use a unique purchase receipt per task and purchase ID. Update counters and transfer in one transaction. Bind owner exceptions to the exact recipient, asset, amount, policy version and service scope. A lost response is not evidence of failure; reconcile the chain receipt before considering another purchase. Payment success and service delivery are separate outcomes.',sources:['https://solana.com/docs/core/transactions','https://solana.com/docs/rpc/http/getsignaturestatuses']},
};
export function createReferenceService(config:{rpc:string;program:Address;mint:Address;recipientWallet:Address;cluster:'localnet'|'devnet'}) {
  const client = new VaultClient(config.rpc,config.program);
  const commitment = config.cluster==='localnet'?'confirmed':'finalized';
  return createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json'); res.setHeader('Cache-Control','no-store');
    try {
      if(req.method!=='GET'){res.statusCode=405;res.end(JSON.stringify({error:'method_not_allowed'}));return;}
      const url=new URL(req.url??'/','http://localhost');
      if(req.method==='GET'&&url.pathname==='/catalog'){res.end(JSON.stringify({selfOperated:true,cluster:config.cluster,mint:config.mint,datasets:[{id:'basic',amount:'20'},{id:'premium',amount:'40'}]}));return;}
      const dataset=url.pathname.slice(1),topic=url.searchParams.get('topic')??'';
      const parsed=DatasetInput.parse({dataset,topic});
      const purchase=url.searchParams.get('purchase'),policy=url.searchParams.get('policy');
      if(!purchase||!policy||!req.headers['x-agent-signature']){res.statusCode=402;res.end(JSON.stringify({error:'payment_required',amount:dataset==='basic'?'20':'40',mint:config.mint,cluster:config.cluster}));return;}
      if(!/^[0-9a-f]{64}$/.test(purchase))throw new Error('invalid_purchase');
      const policyAddress=address(policy), task=await client.policy(policyAddress,commitment);
      if(task.mint!==config.mint||task.recipient!==config.recipientWallet)throw new Error('payment_asset_or_recipient_mismatch');
      const publicKey=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),keyBytes(task.agent)]),format:'der',type:'spki'});
      if(!verify(null,deliveryMessage(policy,purchase,dataset,topic),publicKey,Buffer.from(String(req.headers['x-agent-signature']),'base64')))throw new Error('invalid_delivery_signature');
      const b={policy:policyAddress} as Binding;
      const receipt=await client.receipt(b,Buffer.from(purchase,'hex'),commitment);
      if(!receipt||receipt.amount!==(dataset==='basic'?'20':'40')||receipt.scope!==serviceScope(dataset,topic).toString('hex')||receipt.version!==task.version)throw new Error('payment_not_confirmed');
      res.end(JSON.stringify({selfOperated:true,fixture:false,cluster:config.cluster,receipt:receipt.address,topic:parsed.topic,data:datasets[parsed.dataset]}));
    }catch(error){res.statusCode=error instanceof z.ZodError?400:403;res.end(JSON.stringify({error:res.statusCode===400?'invalid_request':'payment_verification_failed'}));}
  });
}
