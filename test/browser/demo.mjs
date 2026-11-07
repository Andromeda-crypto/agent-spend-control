// Real Chrome, no traces/HAR/video/auth screenshots. Credentials stay in memory.
import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.BROWSER_DEMO_URL??'http://127.0.0.1:5174';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Browser check is restricted to a private localhost demo.');
const access=JSON.parse(await readFile(process.env.BROWSER_ACCESS_FILE??'.local/local-demo-v2/access.json','utf8'));
const out='.local/qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
const failures=[];page.on('pageerror',e=>failures.push(e.message));
const visible=async locator=>{await locator.waitFor({state:'visible',timeout:60000});};
const screenshot=async name=>{assert.ok(!(await page.locator('body').innerText()).includes(access.ownerToken));await page.screenshot({path:`${out}/${name}.png`,fullPage:true,timeout:15000});};
try{
 console.log('Browser: start screen');await page.goto(base,{waitUntil:'domcontentloaded'});await visible(page.locator('#session-mode'));await page.waitForFunction(()=>document.querySelector('#session-mode')?.textContent?.includes('LOCALNET'));
 await screenshot('start');console.log('Browser: sign-in and keyboard');
 await page.locator('#auth-toggle').click();await page.getByLabel('Owner key',{exact:true}).fill('invalid_owner_key_for_browser_test_0000000');await page.getByRole('button',{name:'Open workspace',exact:true}).click();await visible(page.getByRole('alert'));assert.match(await page.getByRole('alert').innerText(),/not valid/);
 try{await page.getByLabel('Owner key',{exact:true}).fill(access.ownerToken);}catch{throw Error('Masked owner sign-in could not be filled.');}await page.getByRole('button',{name:'Open workspace',exact:true}).click();await visible(page.locator(`[data-task="${access.task}"]`));await page.locator(`[data-task="${access.task}"]`).click();
 await page.locator('#revoke').focus();await page.waitForTimeout(3000);assert.equal(await page.locator('#revoke').evaluate(el=>el===document.activeElement),true,'poll must preserve keyboard focus');
 await page.locator('#demo-guide').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#demo-guide').evaluate(el=>el===document.activeElement),true,'Escape restores opener focus');
 console.log('Browser: research and approval');await page.locator('#run-task').click();await visible(page.getByRole('dialog'));await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('#modal-submit').evaluate(el=>el===document.activeElement),true,'dialog traps reverse tab');await page.locator('#modal-submit').click();
 await visible(page.locator(`[data-approve^="${access.task}:"]`));await screenshot('approval-desktop');
 console.log('Browser: disconnect/reconnect');await context.setOffline(true);await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent?.includes('Connection interrupted'),{},{timeout:20000});assert.ok(await page.locator(`[data-approve^="${access.task}:"]`).isVisible(),'last confirmed data remains');await page.locator(`[data-approve^="${access.task}:"]`).click();await page.getByText('Connection unavailable. Check your network and try again.',{exact:true}).waitFor();assert.equal(await page.locator(`[data-approve^="${access.task}:"]`).isDisabled(),false,'failed approval remains retryable');await context.setOffline(false);await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent?.startsWith('Connected'),{},{timeout:20000});
 await page.reload();await visible(page.locator(`[data-approve^="${access.task}:"]`));
 await page.setViewportSize({width:375,height:812});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await screenshot('approval-mobile');
 console.log('Browser: completing payment');await page.locator(`[data-approve^="${access.task}:"]`).click();await visible(page.getByRole('heading',{name:'Research report',exact:true}));assert.match(await page.locator('.report').innerText(),/SIMULATED MODEL REPORT/);assert.equal(await page.getByText('Payment confirmed',{exact:true}).count(),2);assert.equal(await page.getByText('Delivery complete',{exact:true}).count(),4); // includes simulated model steps
 await screenshot('complete-mobile');
 await page.setViewportSize({width:1440,height:1000});await page.locator('.receipt details').first().evaluate(d=>d.open=true);await page.waitForTimeout(3000);assert.equal(await page.locator('.receipt details').first().evaluate(d=>d.open),true);await screenshot('complete-desktop');
 console.log('Browser: revocation');await page.locator('#revoke').click();await page.locator('#modal-submit').click();await visible(page.getByRole('heading',{name:'Revocation confirmed',exact:true}));assert.equal(await page.locator('#run-task').isDisabled(),true);await page.reload();await visible(page.getByRole('heading',{name:'Revocation confirmed',exact:true}));await screenshot('revoked');
 await page.locator('#demo-guide').click();await page.getByRole('link',{name:'Open the read-only replay instead'}).click();await visible(page.getByRole('heading',{name:'Let agents work. Keep spending under control.',exact:true}));
 for(let i=0;i<7;i++){await page.locator(`[data-scene="${i}"]`).click();assert.equal(await page.locator('nav [aria-current]').getAttribute('data-scene'),String(i));}
 await page.reload();await visible(page.getByRole('heading',{name:'The final report',exact:true}));assert.equal(await page.getByRole('link',{name:'Verify on Devnet ↗'}).count(),2);await screenshot('replay-desktop');
 await page.setViewportSize({width:375,height:812});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await screenshot('replay-mobile');
 await page.keyboard.press('Tab');assert.notEqual(await page.evaluate(()=>document.activeElement?.tagName),'BODY');
 assert.deepEqual(failures,[]);console.log('Real Chrome walkthrough passed: sign-in/error, focus/modal, allowed request, approval, offline/reconnect/refresh, actual local payments/delivery, report, confirmed revocation, replay desktop/mobile. Screenshots are private in .local/qa.');
}finally{await browser.close();}
