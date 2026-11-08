/** Build must run first. Emit an audited static-only Vercel API file payload. */
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve('apps/replay/dist');
const names=(await readdir(root,{recursive:true})).filter(n=>n!=='assets');
if(!names.includes('index.html')||!names.includes('evidence.json')||names.some(n=>!['index.html','evidence.json','submission.html','submission.css','walkthrough.mp4','walkthrough.vtt'].includes(n)&&!/^assets\/[\w-]+\.(js|css)$/.test(n)))throw Error('Unexpected public artifact file.');
const secrets:string[]=[];
for(const dir of ['.local/local-demo-v2','.local/devnet-demo']){
  try{const access=JSON.parse(await readFile(`${dir}/access.json`,'utf8'));for(const field of ['ownerToken','agentToken'])if(typeof access[field]==='string')secrets.push(access[field]);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
}
const files=[];
for(const name of names){
  const bytes=await readFile(resolve(root,name));
  if(bytes.length>20*1024*1024)throw Error('Public file exceeds reviewed size limit');
  const data=bytes.toString('utf8');
  if(secrets.some(s=>data.includes(s))||/-----BEGIN .*PRIVATE KEY|\bsk-proj-[\w-]{20,}|\/api\/identity|OWNER_TOKEN|OWNER_WALLET_PATH|DATABASE_URL/.test(data))throw Error(`Private content detected in artifact ${name}`);
  files.push({file:name,data:bytes.toString('base64'),encoding:'base64'});
}
files.push({file:'vercel.json',data:Buffer.from(await readFile('apps/replay/vercel.json','utf8')).toString('base64'),encoding:'base64'});
await mkdir('.local',{recursive:true});await writeFile('.local/public-replay-upload.json',JSON.stringify(files),{mode:0o600});
const destination=resolve('.local/public-replay-deploy');await mkdir(destination,{recursive:true});
for(const file of files){const path=resolve(destination,file.file);await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,Buffer.from(file.data,'base64'));}
const expected=new Set(files.map(f=>f.file));
for(const path of await readdir(destination,{recursive:true}))if(path!=='assets'&&!expected.has(path))throw Error('Unexpected stale staging file; inspect the generated public-replay-deploy directory before uploading.');
console.log(`Audited ${files.length} static/config files; no repository sources, private config, wallets, API handlers or operator credentials included.`);
