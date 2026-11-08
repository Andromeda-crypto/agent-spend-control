import {chromium} from 'playwright';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
export async function encodeWalkthrough(folder){
 const b=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{const p=await b.newPage({viewport:{width:1440,height:38}});await p.setContent('<style>body{margin:0;background:#182638;color:white;font:16px Arial;padding:10px 18px}</style>RECORDED LOCAL VALIDATOR | SELF-OPERATED TEST SERVICE | SIMULATED MODEL | NO LIVE PUBLIC EXECUTION');await p.screenshot({path:`${folder}/disclosure.png`});}finally{await b.close();}
 const r=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate','2','-i',`${folder}/%05d.jpg`,'-loop','1','-i',`${folder}/disclosure.png`,'-filter_complex','[0:v][1:v]overlay=0:0:shortest=1','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',`${folder}/walkthrough.mp4`],{stdio:'pipe'});
 assert.equal(r.status,0,'Video encoding failed; private frames retained for review');
}
