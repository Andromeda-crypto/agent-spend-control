import { z } from 'zod';
import type { SpendingClient } from './index.js';

export const ReferenceInput=z.object({topic:z.string().min(3).max(500),dataset:z.enum(['basic','premium'])}).strict();
const Input=ReferenceInput.extend({operationId:z.string().min(1).max(160)}).strict();

/** Shared submission boundary. Never waits, pays or approves by itself. */
export function submitReference(client:Pick<SpendingClient,'submit'>,task:string,key:string,raw:unknown){
  const input=ReferenceInput.parse(raw);
  return client.submit(task,key,{provider:'solana',tool:'reference',recipient:'reference-service',
    amount:input.dataset==='basic'?'20':'40',input:{dataset:input.dataset,topic:input.topic}});
}

/** Mount this as a tool in an existing agent. No owner credential, DB or signer. */
export function referenceTool(client:SpendingClient,task:string){
  return async(input:{operationId:string;topic:string;dataset:'basic'|'premium'},options:{timeoutMs?:number;onApproval?:(id:string)=>void}={})=>{
    input=Input.parse(input);
    // Persist operationId with the agent job; reuse it across restarts/retries.
    const request=await submitReference(client,task,`reference:${input.operationId}`,{dataset:input.dataset,topic:input.topic});
    return client.waitForRequest(task,request.id,{timeoutMs:options.timeoutMs,
      onApproval:r=>options.onApproval?.(r.id)});
  };
}
