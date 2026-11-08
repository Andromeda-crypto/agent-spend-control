// Anonymous acceptance check; never uses Vercel auth/bypass or operator credentials.
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=new URL(process.env.PUBLIC_REPLAY_URL??'');
assert.equal(base.protocol,'https:');assert.ok(base.hostname.endsWith('.vercel.app'));
const canonical=base.origin;
const response=await fetch(canonical);assert.equal(response.status,200,'must be public without authentication');
const headers=Object.fromEntries(response.headers);
for(const key of ['content-security-policy','x-content-type-options','x-frame-options','referrer-policy','permissions-policy','strict-transport-security'])assert.ok(headers[key],`Missing ${key}`);
assert.equal(headers['x-frame-options'],'DENY');assert.equal(headers['x-content-type-options'],'nosniff');assert.match(headers['content-security-policy'],/connect-src 'self'/);
const evidence=await (await fetch(`${canonical}/evidence.json`)).json();
assert.deepEqual(evidence,JSON.parse(await readFile('apps/replay/public/evidence.json','utf8')));
for(const r of evidence.receipts){const u=new URL(r.explorer);assert.equal(u.origin,'https://explorer.solana.com');assert.equal(u.pathname,`/tx/${r.signature}`);assert.equal(u.search,'?cluster=devnet');}
for(const path of ['/api/identity','/api/session','/api/tasks','/.env','/access.json','/.local/devnet-deployer.wallet.json','/missing-route'])assert.equal((await fetch(`${canonical}${path}`)).status,404,`Must not expose ${path}`);
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),requests=[],errors=[];
page.on('request',r=>requests.push({method:r.method(),url:r.url(),authorization:!!r.headers().authorization}));
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await mkdir('.local/qa',{recursive:true});
try{
 for(const width of [1440,375,320]){
  await page.setViewportSize({width,height:900});
  for(let i=0;i<7;i++){
   await page.goto('about:blank');const res=await page.goto(`${canonical}/#${i}`);assert.equal(res.status(),200);await page.locator(`[data-scene="${i}"][aria-current]`).waitFor();
   if(i>=3)await page.locator('.receipt').first().waitFor();
   await page.reload();await page.locator(`[data-scene="${i}"][aria-current]`).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.locator('[data-scene="3"]').click();await page.locator('.receipt').first().waitFor();
  assert.deepEqual(await page.getByRole('link',{name:'Verify on Devnet ↗'}).evaluateAll(els=>els.map(el=>el.href)),evidence.receipts.map(r=>r.explorer));
  await page.locator('#scene').scrollIntoViewIfNeeded();await page.screenshot({path:`.local/qa/hosted-replay-${width}.png`});
  await page.locator('#next').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('[aria-current]').getAttribute('data-scene'),'4');
 }
 for(const width of [1440,375,320]){
  await page.setViewportSize({width,height:900});const res=await page.goto(`${canonical}/submission.html`);assert.equal(res.status(),200);await page.reload();
  await page.getByRole('heading',{name:'One task, from allowance to revocation.',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('video').evaluate(v=>{v.muted=true;return v.play();});await page.waitForFunction(()=>document.querySelector('video').currentTime>0.1);
  assert.equal(await page.locator('video').evaluate(v=>Math.round(v.duration*10)/10),37.5);
  await page.locator('video').evaluate(v=>v.pause());
  assert.equal(await page.locator('track').getAttribute('src'),'walkthrough.vtt');
  assert.equal(await page.locator('video').evaluate(v=>v.textTracks[0].cues.length>0),true);
 }
 assert.ok(requests.every(r=>r.method==='GET'&&!r.authorization&&new URL(r.url).origin===canonical&&!new URL(r.url).pathname.startsWith('/api')),'Browser must read only public same-origin assets');
 assert.deepEqual(errors,[],'No browser console or JS errors');
 await writeFile('.local/hosted-replay-verification.json',JSON.stringify({url:canonical,verifiedAt:new Date().toISOString(),headers,evidenceSignatures:evidence.receipts.map(r=>r.signature),widths:[1440,375,320],scenes:7,browserErrors:errors,requestCount:requests.length,publicWithoutAuth:true,privilegedPaths404:true,staticGetOnly:true,submissionRoute:'/submission.html',videoPlayback:true,captionsLoaded:true},null,2)+'\n');
 console.log('Hosted Chrome checks passed: anonymous HTTPS, security headers, direct scene links/refresh, desktop/mobile, exact Devnet evidence, no errors/API calls or spending.');
}finally{await browser.close();}
