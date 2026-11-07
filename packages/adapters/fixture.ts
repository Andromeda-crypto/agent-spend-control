import { z } from 'zod';
import { createHash } from 'node:crypto';
interface ReceiptStore { query(sql: string, params?: any[]): Promise<{ rows: any[] }> }
import { canonical, type Purchase } from '../policy/src/index.js';
import { Confirmed, type Adapter, type Outcome } from './index.js';

const Input = z.object({ query: z.string().min(1).max(2000), simulateTimeout: z.boolean().optional(), failDelivery: z.boolean().optional() }).strict();

/** Self-operated fixture provider; every receipt explicitly identifies synthetic data. */
export class FixtureAdapter implements Adapter {
  version = 'fixture-v1';
  provider = 'fixture';
  tool: string;
  recipient = 'service';
  constructor(private db: ReceiptStore, private price = '20', tool = 'search') { this.tool = tool; this.version = `fixture-v1:${tool}:${price}`; }
  quote(purchase: Purchase) { Input.parse(purchase.input); return this.price; }

  async execute(dispatchId: string, purchase: Purchase): Promise<Outcome> {
    const input = Input.parse(purchase.input);
    const payloadHash = createHash('sha256').update(canonical(purchase)).digest('hex');
    const outcome: Confirmed = {
      status: 'confirmed', chargedAmount: this.price, calls: 1,
      delivery: input.failDelivery ? 'failed' : 'delivered',
      receipt: { fixture: true, dispatchId, query: input.query,
        result: input.failDelivery ? null : 'Synthetic research result: Solana task vaults require program-enforced limits.' },
    };
    await this.db.query(`INSERT INTO fixture_receipts(dispatch_id,payload_hash,outcome) VALUES($1,$2,$3)
      ON CONFLICT(dispatch_id) DO NOTHING`, [dispatchId, payloadHash, outcome]);
    const stored = (await this.db.query('SELECT * FROM fixture_receipts WHERE dispatch_id=$1', [dispatchId])).rows[0];
    if (stored.payload_hash !== payloadHash) throw new Error('provider_idempotency_conflict');
    // Simulates provider success followed by a lost response, never a real timeout/payment.
    if (input.simulateTimeout) throw new Error('fixture_response_lost');
    return Confirmed.parse(stored.outcome);
  }

  async lookup(dispatchId: string): Promise<Outcome> {
    const row = (await this.db.query('SELECT outcome FROM fixture_receipts WHERE dispatch_id=$1', [dispatchId])).rows[0];
    return row ? Confirmed.parse(row.outcome) : { status: 'pending' };
  }
}
