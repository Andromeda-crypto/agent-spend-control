import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import type { generateText } from 'ai';
import { OpenAIAdapter } from '../packages/adapters/openai.js';

test('OpenAI adapter disables retries, limits output and persists actual usage without making a network call',async()=>{
  const db=new PGlite();
  try{
    await db.exec('CREATE TABLE provider_receipts(dispatch_id text PRIMARY KEY,provider text,outcome jsonb)');
    let calls=0;let observed:any;
    const generate=(async(options:unknown)=>{calls++;observed=options;return {text:'A source-grounded brief.',usage:{inputTokens:80,outputTokens:25},response:{id:'test-response'},finishReason:'stop'};}) as unknown as typeof generateText;
    const adapter=new OpenAIAdapter(db,'test-model','test-only-not-an-api-key',generate);
    const purchase={amount:'0',provider:'openai',tool:'research',recipient:'openai',input:{prompt:'Summarize the supplied evidence.',maxOutputTokens:128}};
    assert.equal(adapter.quote(purchase),'0');
    const confirmed=await adapter.execute('request-one',purchase);
    assert.equal(observed.maxRetries,0);assert.equal(observed.maxOutputTokens,128);assert.equal(observed.providerOptions.openai.store,false);
    assert.equal(confirmed.status,'confirmed');
    if(confirmed.status==='confirmed'){assert.equal(confirmed.chargedAmount,'0');assert.equal(confirmed.calls,1);assert.equal(confirmed.receipt.inputTokens,80);assert.equal(confirmed.receipt.outputTokens,25);}
    assert.deepEqual(await adapter.execute('request-one',purchase),confirmed);assert.equal(calls,1);
    assert.deepEqual(await adapter.lookup('unknown-response'),{status:'pending'});assert.equal(calls,1);
    assert.ok(!JSON.stringify(confirmed).includes('test-only-not-an-api-key'));
  }finally{await db.close();}
});
