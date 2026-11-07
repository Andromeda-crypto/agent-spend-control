import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import type { Adapter, Outcome } from './index.js';
import { Confirmed } from './index.js';
import type { Purchase } from '../policy/src/index.js';
interface ReceiptStore { query(sql: string, params?: any[]): Promise<{ rows: any[] }> }
export const ModelInput = z.object({ prompt: z.string().min(1).max(16000), maxOutputTokens: z.number().int().min(16).max(2048) }).strict();

/** Call/output quotas are governed; provider-dollar billing is separate from SPL budgets. */
export class OpenAIAdapter implements Adapter {
  provider = 'openai'; tool = 'research'; recipient = 'openai'; version: string;
  constructor(private db: ReceiptStore, private model: string, private apiKey: string,
    private generate = generateText) {
    if (!model || !apiKey) throw new Error('openai_configuration_required');
    this.version = `openai-responses-v1:${model}`;
  }
  quote(p: Purchase) { ModelInput.parse(p.input); return '0'; }
  async execute(dispatchId: string, p: Purchase): Promise<Outcome> {
    const old = await this.lookup(dispatchId); if (old.status === 'confirmed') return old;
    const input = ModelInput.parse(p.input);
    const result = await this.generate({
      model: createOpenAI({ apiKey: this.apiKey }).responses(this.model),
      prompt: input.prompt, maxOutputTokens: input.maxOutputTokens, maxRetries: 0,
      abortSignal: AbortSignal.timeout(60000), providerOptions: { openai: { store: false } },
    });
    const outcome = Confirmed.parse({ status: 'confirmed', chargedAmount: '0', calls: 1,
      delivery: result.text ? 'delivered' : 'failed',
      receipt: { provider: 'openai', fixture: false, model: this.model, responseId: result.response.id ?? null,
        text: result.text, inputTokens: result.usage.inputTokens ?? null, outputTokens: result.usage.outputTokens ?? null,
        finishReason: result.finishReason, billing: 'Provider-billed API usage; no SPL token transfer. Dollar charge not confirmed.' },
    });
    await this.db.query(`INSERT INTO provider_receipts(dispatch_id,provider,outcome) VALUES($1,'openai',$2)
      ON CONFLICT(dispatch_id) DO NOTHING`, [dispatchId, outcome]);
    return this.lookup(dispatchId);
  }
  async lookup(dispatchId: string): Promise<Outcome> {
    const row = (await this.db.query("SELECT outcome FROM provider_receipts WHERE dispatch_id=$1 AND provider='openai'", [dispatchId])).rows[0];
    // No receipt is not proof of failure. Responses with no known ID are never retried.
    return row ? Confirmed.parse(row.outcome) : { status: 'pending' };
  }
}
