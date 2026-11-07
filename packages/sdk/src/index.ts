import { z } from 'zod';
import { TaskCreated, RequestView, Snapshot, ActionResult, PolicyEdited, Credential, IdentityView } from './contracts.js';
import { ResearchInput } from './research.js';
import { Policy, Purchase } from '../../policy/src/index.js';

export class PendingRequestError extends Error {
  constructor(readonly requestId:string){super('Request is still pending. Resume waiting or retry the same idempotency key and payload; do not create a replacement purchase.');this.name='PendingRequestError';}
}
export type WaitOptions={timeoutMs?:number;pollIntervalMs?:number;signal?:AbortSignal;onApproval?:(request:z.infer<typeof RequestView>)=>void|Promise<void>};

/** Node >=22 or any browser with fetch. Credentials stay with the caller. */
export class SpendingClient {
  constructor(private baseURL: string, private credential: string) {}
  private async request<T>(method: string, path: string, schema: z.ZodType<T>, body?: unknown, key?: string, signal?:AbortSignal): Promise<T> {
    const response = await fetch(new URL(path, this.baseURL), {
      method, signal, headers: { authorization: `Bearer ${this.credential}`, 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : `http_${response.status}`);
    return schema.parse(result);
  }
  startResearch(task:string,topic:string,mode:z.input<typeof ResearchInput>['mode']) {
    return this.request('POST', `/tasks/${encodeURIComponent(task)}/research`, z.object({id:z.string()}).strict(), ResearchInput.parse({topic,mode}));
  }
  bindVault(task:string,proof:{policy:string;owner:string;recipientAccount:string;signature:string}) {
    return this.request('POST', `/tasks/${encodeURIComponent(task)}/vault`, z.object({task:z.string(),policy:z.string(),vault:z.string()}).strict(), proof);
  }
  identity() { return this.request('GET', '/identity', IdentityView); }
  rotateOwner() { return this.request('POST', '/identity/rotate', Credential, {}); }
  rotateAgent(task: string) { return this.request('POST', `/tasks/${encodeURIComponent(task)}/agent/rotate`, Credential, {}); }
  createTask(policy: z.input<typeof Policy>) { return this.request('POST', '/tasks', TaskCreated, Policy.parse(policy)); }
  submit(task: string, key: string, purchase: z.infer<typeof Purchase>) {
    return this.request('POST', `/tasks/${encodeURIComponent(task)}/requests`, RequestView, Purchase.parse(purchase), key);
  }
  snapshot(task: string,signal?:AbortSignal) { return this.request('GET', `/tasks/${encodeURIComponent(task)}`, Snapshot,undefined,undefined,signal); }
  /** Stops waiting on timeout; it never cancels, reapproves or repays a request. */
  async waitForRequest(task:string,id:string,options:WaitOptions={}) {
    const timeoutMs=options.timeoutMs??60000,pollIntervalMs=options.pollIntervalMs??1000;
    if(!Number.isInteger(timeoutMs)||timeoutMs<1||!Number.isInteger(pollIntervalMs)||pollIntervalMs<1)throw new Error('invalid_wait_options');
    const deadline=AbortSignal.timeout(timeoutMs);
    const signal=options.signal?AbortSignal.any([deadline,options.signal]):deadline;
    let notified=false;
    try{
      for(;;){
        signal.throwIfAborted();
        const snapshot=await this.snapshot(task,signal),request=snapshot.requests.find(r=>r.id===id);
        if(!request)throw new Error('request_not_found');
        if(['succeeded','failed','cancelled'].includes(request.state))return {request,usage:snapshot.usage.find(u=>u.request_id===id)??null};
        if(request.state==='approval'&&!notified){
          notified=true;
          await new Promise<void>((resolve,reject)=>{
            const abort=()=>{cleanup();reject(signal.reason);};
            const cleanup=()=>signal.removeEventListener('abort',abort);
            signal.addEventListener('abort',abort,{once:true});
            Promise.resolve().then(()=>options.onApproval?.(request)).then(()=>{cleanup();resolve();},error=>{cleanup();reject(error);});
            if(signal.aborted)abort();
          });
        }
        await new Promise<void>((resolve,reject)=>{
          const cleanup=()=>signal.removeEventListener('abort',abort);
          const timer=setTimeout(()=>{cleanup();resolve();},pollIntervalMs);
          const abort=()=>{clearTimeout(timer);cleanup();reject(signal.reason);};
          signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
        });
      }
    }catch(error){if(options.signal?.aborted)throw options.signal.reason;if(deadline.aborted)throw new PendingRequestError(id);throw error;}
  }
  approve(task: string, id: string) { return this.request('POST', `/tasks/${encodeURIComponent(task)}/requests/${encodeURIComponent(id)}/approve`, RequestView, {}); }
  control(task: string, action: 'pause' | 'resume' | 'revoke') { return this.request('POST', `/tasks/${encodeURIComponent(task)}/${action}`, ActionResult, {}); }
  editPolicy(task: string, expectedVersion: number, policy: z.input<typeof Policy>) {
    return this.request('PATCH', `/tasks/${encodeURIComponent(task)}/policy`, PolicyEdited, { expectedVersion, policy: Policy.parse(policy) });
  }
}
