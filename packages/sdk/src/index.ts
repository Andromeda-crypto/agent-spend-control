import { z } from 'zod';
import { TaskCreated, RequestView, Snapshot, ActionResult, PolicyEdited } from './contracts.js';
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
  createTask(policy: z.infer<typeof Policy>) { return this.request('POST', '/tasks', TaskCreated, Policy.parse(policy)); }
  submit(task: string, key: string, purchase: z.infer<typeof Purchase>) {
    return this.request('POST', `/tasks/${encodeURIComponent(task)}/requests`, RequestView, Purchase.parse(purchase), key);
  }
  snapshot(task: string) { return this.request('GET', `/tasks/${encodeURIComponent(task)}`, Snapshot); }
  approve(task: string, id: string) { return this.request('POST', `/tasks/${encodeURIComponent(task)}/requests/${encodeURIComponent(id)}/approve`, RequestView, {}); }
  control(task: string, action: 'pause' | 'resume' | 'revoke') { return this.request('POST', `/tasks/${encodeURIComponent(task)}/${action}`, ActionResult, {}); }
  editPolicy(task: string, expectedVersion: number, policy: z.infer<typeof Policy>) {
    return this.request('PATCH', `/tasks/${encodeURIComponent(task)}/policy`, PolicyEdited, { expectedVersion, policy: Policy.parse(policy) });
  }
}
