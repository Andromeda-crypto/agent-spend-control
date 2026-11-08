import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const directory=resolve('apps/replay/dist');
const workflow=JSON.parse(await readFile('docs/deployments/devnet-workflow.json','utf8'));
const evidence=JSON.parse(await readFile(`${directory}/evidence.json`,'utf8'));
assert.deepEqual(Object.keys(evidence).sort(),['mint','program','receipts','verifiedAt']);
assert.equal(evidence.program,workflow.program);
assert.deepEqual(evidence.receipts.map(r=>r.signature),workflow.receipts.map(r=>r.signature));
for(const r of evidence.receipts){assert.deepEqual(Object.keys(r).sort(),['chainReceipt','confirmation','explorer','feeLamports','receiptRentLamports','signature']);assert.equal(r.confirmation,'finalized');}
let credential='';try{credential=JSON.parse(await readFile('.local/local-demo-v2/access.json','utf8')).ownerToken;}catch{}
for(const file of await readdir(directory,{recursive:true})){if(!/\.(js|html|json|css)$/.test(file))continue;const text=await readFile(resolve(directory,file),'utf8');assert.ok(!credential||!text.includes(credential),'public build must not contain operator credential');assert.ok(!text.includes('/api/identity'),'public build must not contain console authentication code');}
const server=createServer(async(req,res)=>{try{const file=resolve(directory,req.url==='/'?'index.html':`.${new URL(req.url,'http://localhost').pathname}`);if(!file.startsWith(directory+'/'))throw Error();res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.mp4':'video/mp4','.vtt':'text/vtt'})[extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const p=await browser.newPage({viewport:{width:1440,height:1000}}),network=[],errors=[];
p.on('request',r=>network.push({method:r.method(),authorization:!!r.headers().authorization,url:r.url()}));p.on('pageerror',e=>errors.push(e.message));
try{
 await p.route('**/evidence.json',async route=>{await new Promise(r=>setTimeout(r,1000));await route.continue();});
 const url=`http://127.0.0.1:${server.address().port}`;await p.goto(`${url}/#3`);await p.getByRole('status').waitFor();await p.locator('.receipt').first().waitFor();
 for(const width of [1440,375,320]){await p.setViewportSize({width,height:900});for(let i=0;i<7;i++){await p.locator(`[data-scene="${i}"]`).click();assert.equal(await p.locator('#scene').evaluate(el=>el===document.activeElement),true);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}await p.reload();await p.getByRole('heading',{name:'The final report',exact:true}).waitFor();}
 await p.unrouteAll({behavior:'wait'});await p.route('**/evidence.json',r=>r.fulfill({status:503,body:'unavailable'}));await p.reload();await p.getByText('Evidence could not load.',{exact:false}).waitFor();await p.locator('#back').click();assert.equal(await p.locator('[aria-current]').getAttribute('data-scene'),'5');
 await mkdir('.local/qa',{recursive:true});
 for(const width of [1440,375,320]){
  await p.setViewportSize({width,height:900});await p.goto(`${url}/submission.html`);await p.reload();
  await p.getByRole('heading',{name:'One task, from allowance to revocation.',exact:true}).waitFor();
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await p.locator('video').evaluate(v=>{v.muted=true;return v.play();});await p.waitForFunction(()=>document.querySelector('video').currentTime>0.1);
  assert.equal(await p.locator('video').evaluate(v=>Math.round(v.duration*10)/10),37.5);
  await p.locator('video').evaluate(v=>v.pause());await p.locator('video').scrollIntoViewIfNeeded();
  await p.screenshot({path:`.local/qa/submission-${width}.png`});
 }
 assert.ok(network.every(r=>r.method==='GET'&&!r.authorization&&!r.url.includes('/api/')),'replay may only read static public assets');assert.deepEqual(errors,[]);
 console.log('Production replay and submission/video passed in Chrome: strict CSP, allowlisted real evidence, no operator code/credential/API requests, loading/error states, seven scenes, keyboard focus, refresh and widths 1440/375/320.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
