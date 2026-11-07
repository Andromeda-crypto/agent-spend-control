import{chromium}from'playwright';
import{readFile,mkdir}from'node:fs/promises';
import{spawn}from'node:child_process';
import{once}from'node:events';
import assert from'node:assert/strict';
const base=process.env.BROWSER_DEMO_URL??'http://127.0.0.1:5174';assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const access=JSON.parse(await readFile('.local/local-demo-v2/access.json','utf8'));
const gateway=process.env.BROWSER_GATEWAY_URL??'http://127.0.0.1:3101';assert.ok(['127.0.0.1','localhost'].includes(new URL(gateway).hostname));
async function tool(dataset){
 const child=spawn(process.execPath,['--import','tsx','examples/existing-agent/main.ts',dataset],{env:{PATH:process.env.PATH,SPEND_GATEWAY_URL:gateway,SPEND_TASK_ID:access.task,SPEND_AGENT_TOKEN:access.agentToken,AGENT_OPERATION_ID:`browser-pilot/${dataset}`},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',c=>output+=c);child.stderr.resume();
 const [code]=await once(child,'close');assert.equal(code,0,'External agent process must succeed');return JSON.parse(output.slice(output.indexOf('{')));
}
const b=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const p=await b.newPage({viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto(base);await p.locator('#auth-toggle').click();try{await p.getByLabel('Owner key',{exact:true}).fill(access.ownerToken);}catch{throw Error('Masked sign-in unavailable');}await p.getByRole('button',{name:'Open workspace',exact:true}).click();
 await p.getByRole('button',{name:'Integration',exact:true}).click();await p.locator('#integration-task').selectOption(access.task);
 await p.getByText('Task is ready for a reference-tool submission',{exact:true}).waitFor();
 await p.getByRole('button',{name:'Copy example',exact:true}).click();await p.getByText('Example copied. Supply the agent credential privately.',{exact:true}).waitFor();
 const basic=await tool('basic');assert.equal(basic.charged,'20');assert.equal(basic.delivery,'delivered');
 const alreadySettled=await p.getByText('Confirmed charge: 40 · delivery delivered',{exact:true}).count()>0;
 const premium=tool('premium');
 if(!alreadySettled){await p.getByRole('button',{name:'Review pending approvals',exact:true}).click();const approval=p.locator(`[data-approve^="${access.task}:"]`);await approval.waitFor({timeout:30000});await approval.click();}
 const paid=await premium;assert.equal(paid.charged,'40');assert.equal(paid.delivery,'delivered');
 await p.getByRole('button',{name:'Integration',exact:true}).click();await p.getByText('Confirmed charge: 40 · delivery delivered',{exact:true}).waitFor({timeout:15000});
 await mkdir('.local/qa',{recursive:true});
 for(const width of [1440,375]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const text=await p.locator('body').innerText();assert.ok(!text.includes(access.ownerToken)&&!text.includes(access.agentToken));await p.screenshot({path:`.local/qa/integration-${width}.png`,fullPage:false});}
 const retry=await tool('basic');assert.equal(retry.request,basic.request,'Restarted agent must reuse the original purchase');
 assert.deepEqual(errors,[]);console.log('Existing-agent CLI → gateway → local token payments → browser owner approval → Integration receipts passed. Desktop/mobile, no credential rendering, and same-job retry verified.');
}catch(error){console.log('Browser JS errors:',JSON.stringify(errors));console.log('Notice:',await p.locator('.notice').innerText().catch(()=>'(none)'));throw error;}finally{await b.close();}
