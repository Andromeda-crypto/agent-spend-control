// A real private LOCALNET walkthrough. Only authenticated, credential-free frames
// are recorded. No traces, auth screenshots, HAR, wallet files or API bodies.
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {encodeWalkthrough} from './encode-walkthrough.mjs';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const base=process.env.BROWSER_DEMO_URL??'http://127.0.0.1:5174';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const access=JSON.parse(await readFile('.local/local-demo-v2/access.json','utf8'));
const folder=`.local/recordings/${Date.now()}`;await mkdir(folder,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const cues=[];let index=0,recording=false,loop;
const cue=label=>{cues.push({frame:index,label});console.log(label);};
const hold=()=>delay(3000);
try{
 await page.goto(base);await page.locator('#auth-toggle').click();
 try{await page.getByLabel('Owner key',{exact:true}).fill(access.ownerToken);}catch{throw Error('Masked sign-in unavailable');}
 await page.getByRole('button',{name:'Open workspace',exact:true}).click();
 await page.locator(`[data-task="${access.task}"]`).click();
 await page.locator('.orbit-console').waitFor();await page.evaluate(()=>scrollTo(0,0));
 assert.equal(await page.locator('#run-task').isEnabled(),true,'Seed a fresh active task before recording');
 recording=true;
 loop=(async()=>{while(recording){
  const text=await page.locator('body').innerText();
  assert.ok(![access.ownerToken,access.agentToken].some(t=>t&&text.includes(t)),'Credential rendering detected; discard recording');
  assert.equal(await page.locator('input[type="password"]').count(),0,'Authentication must never be recorded');
  await page.screenshot({path:`${folder}/${String(index++).padStart(5,'0')}.jpg`,type:'jpeg',quality:80});
  await delay(500);
 }})();
 cue('Funded task: 120 TEST cap / 60 per request / approval above 30');await hold();
 await page.locator('#run-task').click();await page.locator('#modal-submit').click();
 await page.locator(`[data-approve^="${access.task}:"]`).waitFor({timeout:60000});
 cue('Basic request allowed; premium 40 TEST waits for exact owner approval');
 await page.locator('#approval-inbox').scrollIntoViewIfNeeded();await hold();
 await page.locator(`[data-approve^="${access.task}:"]`).click();
 await page.getByRole('heading',{name:'Research report',exact:true}).waitFor({timeout:60000});
 cue('Two local TEST transfers and delivered references; model report simulated');
 await page.locator('#task-receipts').scrollIntoViewIfNeeded();await hold();
 await page.locator('.report').scrollIntoViewIfNeeded();await hold();
 await page.locator('#revoke').click();await page.locator('#modal-submit').click();
 await page.getByRole('heading',{name:'Revocation confirmed',exact:true}).waitFor({timeout:60000});
 cue('Revocation confirmed on local validator; new work disabled');
 assert.equal(await page.locator('#run-task').isDisabled(),true);await page.evaluate(()=>scrollTo(0,0));await hold();
 await page.goto(base+'/replay/#4');await page.getByRole('heading',{name:'A blocked request',exact:true}).waitFor();
 cue('Replay fallback: illustrated hard-cap rejection; no live public execution');
 await page.locator('#scene').scrollIntoViewIfNeeded();await hold();
 await page.locator('[data-scene="6"]').click();await page.locator('.report').scrollIntoViewIfNeeded();await hold();
 cue('Final report is simulated; Devnet receipts are recorded evidence');
 recording=false;await loop;assert.deepEqual(errors,[]);
 const stamp=frame=>new Date(frame*500).toISOString().slice(11,23);
 await writeFile(`${folder}/walkthrough.vtt`,'WEBVTT\n\n'+cues.filter(c=>c.frame<index).map((c,i)=>`${stamp(c.frame)} --> ${stamp(cues[i+1]?.frame??index)}\n${c.label}\n`).join('\n'));
 await writeFile(`${folder}/recording.json`,JSON.stringify({recordedAt:new Date().toISOString(),mode:'localnet',model:'simulated',service:'self-operated TEST',frames:index,playbackSeconds:index/2,cues,authRecorded:false,checksPassed:true},null,2)+'\n');
 await encodeWalkthrough(folder);
 console.log(`Walkthrough passed. Review before publishing: ${folder}/walkthrough.mp4`);
}finally{recording=false;if(loop)await loop.catch(()=>{});await browser.close();}
