import {chromium} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1024,height:576},deviceScaleFactor:1});
const problems=[];
page.on('console',msg=>{if(msg.type()==='error'||/COMBAT_REAL_ASSETS_READY|COMBAT_SECONDARY_WEAPONS|COMBAT_ASSET_FAILURE/.test(msg.text()))problems.push(msg.type()+': '+msg.text().slice(0,300))});
page.on('pageerror',e=>problems.push('pageerror:'+e.message));
try{
 await page.goto('http://localhost:3015/dev/combat?qa=1',{waitUntil:'domcontentloaded',timeout:50000});
 await page.waitForFunction(()=>window.__COMBAT_QA__?.snapshot().ready,{timeout:65000});
 fs.mkdirSync('research/char-fix-qa',{recursive:true});
 for(const [name,button] of [['rifle',null],['pistol','Pistol'],['shotgun','Shotgun']]){
  if(button)await page.getByRole('button',{name:button}).click();
  await page.waitForFunction((w)=>window.__COMBAT_QA__?.snapshot().models.includes(w),name,{timeout:24000});
  await page.waitForTimeout(900);
  console.log('STATUS',name,JSON.stringify(await page.evaluate(()=>window.__COMBAT_QA__.snapshot())));
  try{await page.screenshot({path:'research/char-fix-qa/'+name+'.png',timeout:15000});console.log('SCREENSHOT',name)}catch(e){console.log('CAPTURE_FAILED',name,String(e).slice(0,170))}
 }
}catch(e){problems.push('exception:'+String(e));console.log('EXCEPTION',String(e))}
finally{console.log('PROBLEMS',JSON.stringify(problems.slice(0,8)));await browser.close()}
