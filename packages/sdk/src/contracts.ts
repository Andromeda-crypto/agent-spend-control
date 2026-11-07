import { z } from 'zod';
import { Policy, Purchase, units } from '../../policy/src/index.js';
export const TaskCreated = z.object({ task: z.string(), agent: z.string() }).strict();
export const RequestView = z.object({ id: z.string(), state: z.enum(['approval','reserved','dispatched','succeeded','failed','cancelled']),
  payload: Purchase, policyVersion: z.number().int().positive() }).strict();
export const ActionResult = z.object({ task: z.string(), action: z.enum(['pause','revoke','resume']) }).strict();
export const PolicyEdited = z.object({ task: z.string(), policyVersion: z.number().int().positive() }).strict();
export const Snapshot = z.object({
  task: z.string(), policy: Policy, policyVersion: z.number().int().positive(), paused: z.boolean(), revoked: z.boolean(),
  available: units, spent: units, reserved: units, callsLeft: z.number().int().nonnegative(),
  research: z.array(z.object({id:z.string(),topic:z.string(),mode:z.enum(['fixture','live']),step:z.number().int(),state:z.string(),report:z.string().nullable()}).strict()),
  vault: z.object({program_id:z.string(),policy_address:z.string(),vault_address:z.string(),mint:z.string(),owner_address:z.string(),agent_address:z.string(),cluster:z.string(),revoked:z.boolean()}).strict().nullable(),
  requests: z.array(RequestView),
  usage: z.array(z.object({ request_id: z.string(), charged_amount: units, calls: z.number().int().min(0).max(1),
    delivery: z.enum(['delivered','failed']), receipt: z.record(z.string(), z.json()) }).strict()),
  events: z.array(z.object({ request_id: z.string(), state: z.string(), detail: z.record(z.string(), z.json()), created_at: z.string().datetime() }).strict()),
}).strict();
export const Credential = z.object({ credential: z.string() }).strict();
export const IdentityView = z.object({ id: z.string(), workspace: z.string(), name: z.string(), agents: z.array(z.object({
  id: z.string(), task_id: z.string(), name: z.string(), revoked: z.boolean(), paused: z.boolean(), task_revoked: z.boolean(),
}).strict()) }).strict();
