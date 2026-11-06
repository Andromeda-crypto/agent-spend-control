import { z } from 'zod';
import type { Purchase } from '../policy/src/index.js';
import { units } from '../policy/src/index.js';

export const Confirmed = z.object({
  status: z.literal('confirmed'), chargedAmount: units,
  calls: z.union([z.literal(0), z.literal(1)]),
  delivery: z.enum(['delivered', 'failed']),
  receipt: z.record(z.string(), z.json()),
}).strict();
export type Confirmed = z.infer<typeof Confirmed>;
export type Outcome = Confirmed | { status: 'pending' };
export interface Adapter {
  /** Bump on any behavior/quote change; in-flight work must keep its original adapter. */
  version: string;
  provider: string;
  tool: string;
  recipient: string;
  /** A trusted, reliable upper bound in the task's monetary units. */
  quote(purchase: Purchase): string;
  execute(dispatchId: string, purchase: Purchase): Promise<Outcome>;
  /** Read-only lookup; never send the purchase again after an uncertain result. */
  lookup(dispatchId: string): Promise<Outcome>;
}
