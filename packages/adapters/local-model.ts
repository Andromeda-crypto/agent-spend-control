import { Confirmed, type Adapter, type Outcome } from './index.js';
import type { Purchase } from '../policy/src/index.js';
import { ModelInput } from './openai.js';
interface DB { query(sql:string,params?:any[]):Promise<{rows:any[]}> }
/** Deliberately simulated model for test-cluster demos. Never calls an API. */
export class LocalModelAdapter implements Adapter {
  provider='local-model';tool='research';recipient='local-model';version='local-model-v1';
  constructor(private db:DB){}
  quote(p:Purchase){ModelInput.parse(p.input);return '0';}
  async execute(id:string,p:Purchase):Promise<Outcome>{
    const old=await this.lookup(id);if(old.status==='confirmed')return old;
    const {prompt}=ModelInput.parse(p.input);
    const text=prompt.startsWith('Create a concise research plan')
      ? 'SIMULATED MODEL: inspect vault authority, compare payment limits, and obtain the two paid reference datasets.'
      : `SIMULATED MODEL REPORT\nThis is a simulated model response. Inspect the itemized chain receipts for actual payments. No request was sent to OpenAI.\n\nA program-derived vault limits the agent to an approved mint and recipient. Exact owner approval handles exceptions within hard limits. Purchase receipts prevent replay; ambiguous submissions are reconciled before another payment. API-provider billing is separate.\n\nSources: https://solana.com/docs/core/pda\nhttps://solana.com/docs/core/transactions\nhttps://solana.com/docs/tokens/basics/transfer-tokens`;
    const outcome=Confirmed.parse({status:'confirmed',chargedAmount:'0',calls:1,delivery:'delivered',receipt:{provider:'local-model',fixture:true,simulatedModel:true,text,billing:'No API request or dollar charge. On-chain receipts are recorded separately.'}});
    await this.db.query("INSERT INTO provider_receipts(dispatch_id,provider,outcome) VALUES($1,'local-model',$2) ON CONFLICT DO NOTHING",[id,outcome]);
    return this.lookup(id);
  }
  async lookup(id:string):Promise<Outcome>{const row=(await this.db.query("SELECT outcome FROM provider_receipts WHERE dispatch_id=$1 AND provider='local-model'",[id])).rows[0];return row?Confirmed.parse(row.outcome):{status:'pending'};}
}
