import { isSolanaError, SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR, type RpcTransport } from '@solana/kit';

type Queue={tail:Promise<void>;last:number};
const queues=new Map<string,Queue>();
/** Respect public RPC limits. Retries send the identical RPC payload, never a new payment. */
export function pacedTransport<T extends RpcTransport>(transport:T,key:string,interval=350,sleep:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms))):T{
  const state=queues.get(key)??{tail:Promise.resolve(),last:0};queues.set(key,state);
  return (async(config:Parameters<RpcTransport>[0])=>{
    const result=state.tail.then(async()=>{
      for(let attempt=0;;attempt++){
        const delay=Math.max(0,state.last+interval-Date.now());
        if(delay)await sleep(delay);
        config.signal?.throwIfAborted();state.last=Date.now();
        try{return await transport(config);}
        catch(error){
          if(!isSolanaError(error,SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR)||error.context.statusCode!==429||attempt>=5)throw error;
          const header=error.context.headers.get('retry-after')??'0';
          const seconds=Number(header);
          const requested=Number.isFinite(seconds)?seconds*1000:Math.max(0,Date.parse(header)-Date.now());
          const pause=Math.max(2000*2**attempt,Number.isFinite(requested)?requested:0);
          console.log(`Public RPC throttled; backing off ${pause/1000}s without changing the request.`);
          await sleep(pause);
        }
      }
    });
    state.tail=result.then(()=>{},()=>{});return result;
  }) as T;
}
