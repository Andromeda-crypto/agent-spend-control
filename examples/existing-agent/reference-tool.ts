import { z } from 'zod';
import { SpendingClient } from '../../packages/sdk/src/index.js';

const Input=z.object({operationId:z.string().min(1).max(160),topic:z.string().min(3).max(500),dataset:z.enum(['basic','premium'])}).strict();

/** Mount this as a tool in an existing agent. No owner credential, DB or signer. */
export function referenceTool(client:SpendingClient,task:string){
  return async(input:{operationId:string;topic:string;dataset:'basic'|'premium'},options:{timeoutMs?:number;onApproval?:(id:string)=>void}={})=>{
    input=Input.parse(input);
    // Persist operationId with the agent job; reuse it across restarts/retries.
    const request=await client.submit(task,`reference:${input.operationId}`,{
      provider:'solana',tool:'reference',recipient:'reference-service',
      amount:input.dataset==='basic'?'20':'40',input:{dataset:input.dataset,topic:input.topic},
    });
    return client.waitForRequest(task,request.id,{timeoutMs:options.timeoutMs,
      onApproval:r=>options.onApproval?.(r.id)});
  };
}
