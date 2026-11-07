import { z } from 'zod';
export const units = z.string().regex(/^(0|[1-9][0-9]{0,17})$/);
export const Asset = z.object({ kind: z.enum(['fixture','spl_token']), network: z.enum(['localnet','devnet']),
 mint: z.string().min(1), symbol: z.string().min(1).max(20), decimals: z.number().int().min(0).max(9) }).strict();
export const Policy = z.object({ asset: Asset.default({kind:'fixture',network:'localnet',mint:'fixture',symbol:'DEMO',decimals:0}), maxOutputTokens: z.number().int().min(16).max(2048).default(512), budget: units, perRequest: units, approvalAbove: units,
 calls: z.number().int().nonnegative().max(2147483647), expiresAt: z.string().datetime(),
 providers: z.array(z.string().min(1)), tools: z.array(z.string().min(1)), recipients: z.array(z.string().min(1)) }).strict();
export const Purchase = z.object({ provider: z.string().min(1), tool: z.string().min(1), recipient: z.string().min(1), amount: units,
 input: z.record(z.string(), z.json()) }).strict();
export type Purchase = z.infer<typeof Purchase>;
export function allowed(policy: z.infer<typeof Policy>, p: Purchase, spent: string, reserved: string, calls: number, paused: boolean, revoked: boolean) {
 if(paused || revoked || Date.parse(policy.expiresAt)<=Date.now()) throw new Error('task_inactive');
 if(!policy.providers.includes(p.provider)||!policy.tools.includes(p.tool)||!policy.recipients.includes(p.recipient)) throw new Error('not_allowed');
 if(BigInt(p.amount)>BigInt(policy.perRequest)||BigInt(spent)+BigInt(reserved)+BigInt(p.amount)>BigInt(policy.budget)||calls>=policy.calls) throw new Error('hard_limit');
}
export function canonical(value: unknown): string {
 if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
 if(value!==null && typeof value==='object') return '{'+Object.entries(value).sort(([a],[b])=>(a < b ? -1 : a > b ? 1 : 0)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
 return JSON.stringify(value);
}
