import type pg from 'pg';
import { address } from '@solana/kit';
import { FixtureAdapter } from '../../../packages/adapters/fixture.js';
import { OpenAIAdapter } from '../../../packages/adapters/openai.js';
import { SolanaAdapter } from '../../../packages/adapters/solana.js';
import type { Adapter } from '../../../packages/adapters/index.js';
import { loadSigner, VaultClient } from '../../../packages/solana/client.js';
import { advanceResearch } from '../../../examples/reference-agent/workflow.js';
import { runWorkerOnce } from './worker.js';
export async function runtime(pool:pg.Pool){
  const adapters:Adapter[]=[];
  if(process.env.ENABLE_FIXTURE_ADAPTER==='true')adapters.push(new FixtureAdapter(pool),new FixtureAdapter(pool,'40','dataset'));
  const live=process.env.ENABLE_LIVE_EXECUTION==='true';
  if(live&&process.env.OPENAI_API_KEY&&process.env.OPENAI_MODEL)adapters.push(new OpenAIAdapter(pool,process.env.OPENAI_MODEL,process.env.OPENAI_API_KEY));
  if(live&&process.env.SOLANA_RPC_URL&&process.env.SOLANA_PROGRAM_ID&&process.env.AGENT_WALLET_PATH&&process.env.REFERENCE_SERVICE_URL){
    const client=new VaultClient(process.env.SOLANA_RPC_URL,address(process.env.SOLANA_PROGRAM_ID));
    adapters.push(new SolanaAdapter(pool,client,await loadSigner(process.env.AGENT_WALLET_PATH),process.env.REFERENCE_SERVICE_URL));
  }
  if(!adapters.length)throw new Error('no_adapters_enabled');
  return async()=>{await advanceResearch(pool);const results=await runWorkerOnce(pool,adapters);await advanceResearch(pool);return results;};
}
