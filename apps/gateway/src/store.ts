import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Policy, Purchase, allowed, canonical } from '../../../packages/policy/src/index.js';
export interface DB { query(sql:string, params?:any[]):Promise<{rows:any[]}> }
export const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export const credential=()=>randomBytes(32).toString('base64url');
export class Store {
 constructor(private db:DB){}
 async create(owner:string, raw:unknown) {
 const policy=Policy.parse(raw), agent=credential(), workspace=randomUUID(), task=randomUUID();
 await this.db.query('INSERT INTO workspaces VALUES ($1,$2)',[workspace,hash(owner)]);
 await this.db.query('INSERT INTO tasks(id,workspace_id,agent_hash,policy) VALUES ($1,$2,$3,$4)',[task,workspace,hash(agent),policy]);
 return {task,agent};
 }
 async task(id:string, token:string, owner=false) {
 const {rows}=await this.db.query(`SELECT t.*, w.owner_hash FROM tasks t JOIN workspaces w ON w.id=t.workspace_id WHERE t.id=$1 FOR UPDATE OF t`,[id]);
 const t=rows[0]; if(!t||hash(token)!==(owner?t.owner_hash:t.agent_hash)) throw new Error('unauthorized'); return t;
 }
 async event(id:string,state:string){await this.db.query('INSERT INTO events(request_id,state) VALUES ($1,$2)',[id,state]);}
 async reserve(task:string, token:string, key:string, raw:unknown) {
 const payload=Purchase.parse(raw), t=await this.task(task,token);
 const old=(await this.db.query('SELECT * FROM requests WHERE task_id=$1 AND key=$2',[task,key])).rows[0];
 if(old){if(canonical(old.payload)!==canonical(payload)) throw new Error('idempotency_conflict'); return old;}
 allowed(Policy.parse(t.policy),payload,t.spent,t.reserved,t.calls_used+t.calls_reserved,t.paused,t.revoked);
 const state=BigInt(payload.amount)>BigInt(t.policy.approvalAbove)?'approval':'reserved';
 const id=randomUUID();
 await this.db.query('INSERT INTO requests(id,task_id,key,payload,version,state) VALUES($1,$2,$3,$4,$5,$6)',[id,task,key,payload,t.version,state]);
 if(state==='reserved') await this.add(t.id,payload.amount,1);
 await this.event(id,state); return {id,state,payload};
 }
 async add(task:string,amount:string,direction:number){await this.db.query('UPDATE tasks SET reserved=reserved+$2::bigint,calls_reserved=calls_reserved+$3 WHERE id=$1',[task,(BigInt(amount)*BigInt(direction)).toString(),direction]);}
 async transition(task:string,id:string,token:string,action:'approve'|'dispatch'|'succeeded'|'failed',receipt:unknown=null){
 const t=await this.task(task,token,action==='approve');
 const r=(await this.db.query('SELECT * FROM requests WHERE id=$1 AND task_id=$2 FOR UPDATE',[id,task])).rows[0];
 if(!r) throw new Error('not_found');
 if(action==='approve'){
 if(r.state!=='approval'||r.version!==t.version) throw new Error('invalid_state');
 allowed(Policy.parse(t.policy),r.payload,t.spent,t.reserved,t.calls_used+t.calls_reserved,t.paused,t.revoked);
 await this.add(task,r.payload.amount,1);
 await this.db.query("UPDATE requests SET state='reserved',approved_by=$2 WHERE id=$1",[id,t.workspace_id]);
 } else if(action==='dispatch') {
 if(r.state!=='reserved'||r.version!==t.version) throw new Error('invalid_state');
 allowed(Policy.parse(t.policy),r.payload,t.spent,(BigInt(t.reserved)-BigInt(r.payload.amount)).toString(),t.calls_used+t.calls_reserved-1,t.paused,t.revoked);
 await this.db.query("UPDATE requests SET state='dispatched' WHERE id=$1",[id]);
 } else {
 if(r.state!=='dispatched') throw new Error('invalid_state');
 await this.add(task,r.payload.amount,-1);
 if(action==='succeeded') await this.db.query('UPDATE tasks SET spent=spent+$2::bigint,calls_used=calls_used+1 WHERE id=$1',[task,r.payload.amount]);
 await this.db.query('UPDATE requests SET state=$2,receipt=$3 WHERE id=$1',[id,action,receipt]);
 }
 await this.event(id,action); return {id,state:action==='approve'?'reserved':action};
 }
 async control(task:string,token:string,action:'pause'|'revoke'){
 await this.task(task,token,true);
 await this.db.query(`UPDATE tasks SET ${action==='pause'?'paused':'revoked'}=true WHERE id=$1`,[task]);
 const pending=(await this.db.query("SELECT * FROM requests WHERE task_id=$1 AND state IN ('approval','reserved')",[task])).rows;
 for(const r of pending){if(r.state==='reserved') await this.add(task,r.payload.amount,-1);await this.db.query("UPDATE requests SET state='cancelled' WHERE id=$1",[r.id]);await this.event(r.id,'cancelled');}
 return {task,action};
 }
}
