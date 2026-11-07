import pg from 'pg';
import { setTimeout } from 'node:timers/promises';
import { runtime } from './runtime.js';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const watch=process.argv.includes('--watch');
const shutdown=new AbortController();
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>shutdown.abort());
try{
  const tick=await runtime(pool);
  do{
    try{const results=await tick();if(!watch||results.length)console.log(JSON.stringify({results}));}
    catch(error){if(!watch)throw error;console.error('Worker pass failed; retrying. Review database and adapter configuration.');}
    if(watch&&!shutdown.signal.aborted)await setTimeout(1500,undefined,{signal:shutdown.signal}).catch(()=>{});
  }while(watch&&!shutdown.signal.aborted);
}finally{await pool.end();}
