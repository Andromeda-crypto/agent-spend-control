import { createServer } from 'node:http';
import pg from 'pg';
import { z } from 'zod';
import { Store } from './store.js';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const server=createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');
 let client:pg.PoolClient|undefined;
 try {
 const token=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,})$/)?.[1];
 if(!token) throw new Error('unauthorized');
 let data=''; for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>65536) throw new Error('body_too_large');}
 const body=data?JSON.parse(data):{};
 const parts=(req.url??'').split('/').filter(Boolean);
 client=await pool.connect(); await client.query('BEGIN'); const store=new Store(client);
 let result:unknown;
 if(req.method==='POST' && req.url==='/tasks') result=await store.create(token,body);
 else if(req.method==='POST' && parts[0]==='tasks' && parts[2]==='requests' && parts.length===3) {
 const key=z.string().min(1).max(200).parse(req.headers['idempotency-key']); result=await store.reserve(parts[1],token,key,body);
 }else if(req.method==='POST' && parts[0]==='tasks' && parts[2]==='requests' && parts[4]==='approve' && parts.length===5) result=await store.transition(parts[1],parts[3],token,'approve');
 else if(req.method==='POST' && parts[0]==='tasks' && ['pause','revoke'].includes(parts[2]) && parts.length===3) result=await store.control(parts[1],token,parts[2] as 'pause'|'revoke');
 else {res.statusCode=404;result={error:'not_found'};}
 await client.query('COMMIT'); res.end(JSON.stringify(result));
 }catch(error){if(client)await client.query('ROLLBACK');const message=error instanceof Error?error.message:'invalid_request';res.statusCode=message==='unauthorized'?403:409;res.end(JSON.stringify({error:message.startsWith('[')?'invalid_request':message}));}
 finally{client?.release();}
});
server.listen(Number(process.env.PORT??3001),'127.0.0.1');
