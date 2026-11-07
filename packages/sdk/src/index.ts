import { z } from 'zod';
import { TaskCreated, RequestView, Snapshot, ActionResult, PolicyEdited, Credential, IdentityView } from './contracts.js';
import { ResearchInput } from './research.js';
import { Policy, Purchase } from '../../policy/src/index.js';

/** Node >=22 or any browser with fetch. Credentials stay with the caller. */
export class SpendingClient {
  constructor(private baseURL: string, private credential: string) {}
  private async request<T>(method: string, path: string, schema: z.ZodType<T>, body?: unknown, key?: string): Promise<T> {
    const response = await fetch(new URL(path, this.baseURL), {
      method, headers: { authorization: `Bearer ${this.credential}`, 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) },
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
  snapshot(task: string) { return this.request('GET', `/tasks/${encodeURIComponent(task)}`, Snapshot); }
  approve(task: string, id: string) { return this.request('POST', `/tasks/${encodeURIComponent(task)}/requests/${encodeURIComponent(id)}/approve`, RequestView, {}); }
  control(task: string, action: 'pause' | 'resume' | 'revoke') { return this.request('POST', `/tasks/${encodeURIComponent(task)}/${action}`, ActionResult, {}); }
  editPolicy(task: string, expectedVersion: number, policy: z.input<typeof Policy>) {
    return this.request('PATCH', `/tasks/${encodeURIComponent(task)}/policy`, PolicyEdited, { expectedVersion, policy: Policy.parse(policy) });
  }
}
