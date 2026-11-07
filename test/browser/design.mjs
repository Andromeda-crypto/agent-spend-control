// Read-only visual QA; no submission, approval, rotation or revocation actions.
import{chromium}from'playwright';import{readFile,mkdir}from'node:fs/promises';import assert from'node:assert/strict';
const base=process.env.BROWSER_DEMO_URL??'http://127.0.0.1:5174';assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const access=JSON.parse(await readFile('.local/local-demo-v2/access.json','utf8'));
const b=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const p=await b.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(e.message));await mkdir('.local/qa',{recursive:true});
const shot=async name=>{const text=await p.locator('body').innerText();assert.ok(!text.includes(access.ownerToken)&&!text.includes(access.agentToken));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(name.includes('overlay')){const box=await p.getByRole('dialog').boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=p.viewportSize().width,'Dialog must fit viewport');}await p.screenshot({path:`.local/qa/orbit-${name}.png`,animations:'disabled'});};
try{
 await p.goto(base+'/replay/');await p.locator('.orbit-console').waitFor();await shot('public-desktop');await p.locator('#orbit-node-receipt').click();await p.locator('#orbit-inspect').click();await p.locator('#orbit-detail').waitFor();assert.equal(await p.locator('#orbit-node-receipt').getAttribute('aria-pressed'),'true');await p.locator('#orbit-dock-policy').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#orbit-dock-policy').evaluate(el=>document.activeElement===el),true);await p.locator('#orbit-node-request').click();await p.getByRole('link',{name:'Integration',exact:true}).click();await p.waitForFunction(()=>{const r=document.getElementById('developer-pilot')?.getBoundingClientRect();return r&&r.top>=0&&r.top<innerHeight;});await p.reload();await p.locator('#developer-pilot').waitFor();await p.goto(base+'/replay/');await p.evaluate(()=>scrollTo(0,0));
 await p.setViewportSize({width:375,height:900});await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(250);await shot('public-mobile');
 await p.locator('.orbit-console').scrollIntoViewIfNeeded();await shot('policy-mobile');
 await p.goto(base);await p.locator('#auth-toggle').click();try{await p.getByLabel('Owner key',{exact:true}).fill(access.ownerToken);}catch{throw Error('Masked sign-in unavailable');}await p.getByRole('button',{name:'Open workspace',exact:true}).click();
 await p.locator(`[data-task="${access.task}"]`).waitFor();await p.locator(`[data-task="${access.task}"]`).click();
 await p.setViewportSize({width:1440,height:1000});await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(250);await shot('console-desktop');
 await p.locator('#demo-guide').click();await p.getByRole('dialog').waitFor();await shot('overlay-desktop');await p.keyboard.press('Escape');
 assert.equal(await p.locator('#demo-guide').evaluate(el=>document.activeElement===el),true);
 await p.getByRole('button',{name:'Integration',exact:true}).click();await shot('integration-desktop');await p.reload();await p.locator('.integration-workbench').waitFor();
 await p.setViewportSize({width:375,height:900});await shot('integration-mobile');
 await p.locator('#tool-example').scrollIntoViewIfNeeded();await shot('code-mobile');
 await p.getByRole('button',{name:'Overview',exact:true}).click();await p.locator('#demo-guide').click();await shot('overlay-mobile');await p.keyboard.press('Escape');
 assert.deepEqual(errors,[]);console.log('Orbit design verified in Chrome: public orbit/inspector/policy, private overview/integration, code, modal overlay, desktop/mobile, focus return and no credential rendering. No spending actions sent.');
}finally{await b.close();}
