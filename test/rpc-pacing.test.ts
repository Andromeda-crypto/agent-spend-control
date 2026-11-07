import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SolanaError, SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR, type RpcTransport } from '@solana/kit';
import { pacedTransport } from '../packages/solana/rpc-pacing.js';
test('RPC throttling serializes calls and retries the identical signed payload with Retry-After backoff',async()=>{
  const seen:unknown[]=[],pauses:number[]=[];let active=0,maxActive=0;
  const transport=(async(config:{payload:unknown})=>{
    active++;maxActive=Math.max(maxActive,active);seen.push(config.payload);await Promise.resolve();active--;
    if(seen.length===1)throw new SolanaError(SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR,{statusCode:429,message:'Too many requests',headers:new Headers({'retry-after':'7'})});
    return {jsonrpc:'2.0',id:'1',result:'ok'};
  }) as RpcTransport;
  const paced=pacedTransport(transport,'test-429',0,async ms=>{pauses.push(ms);});
  const payment={method:'sendTransaction',params:['same-signed-transaction']},lookup={method:'getAccountInfo',params:['receipt']};
  await Promise.all([paced({payload:payment}),paced({payload:lookup})]);
  assert.equal(maxActive,1);assert.equal(seen[0],payment);assert.equal(seen[1],payment);assert.equal(seen[2],lookup);assert.equal(pauses[0],7000);
});
