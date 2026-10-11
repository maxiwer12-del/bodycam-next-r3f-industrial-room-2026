/** Real browser (software WebGL) smoke test for the deployed assets. No canned Bistro screenshots. */
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const OUT='research/character-qa-captures';
fs.mkdirSync(OUT,{recursive:true});
const report={started:new Date().toISOString(),steps:[],errors:[],status:'running'};
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3012';
let browser,page;
const mark=(name,data)=>{report.steps.push({name,data,time:new Date().toISOString()});console.log('COMBAT_QA',name,JSON.stringify(data||{}))};
try{
 browser=await chromium.launch({
  headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader',
   '--enable-webgl','--enable-unsafe-swiftshader','--disable-web-security']
 });
 page=await browser.newPage({viewport:{width:736,height:414},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push('PAGE '+e.message));
 page.on('console',msg=>{
  const text=msg.text();
  if(msg.type()==='error')report.errors.push('CONSOLE '+text.slice(0,500));
  if(/COMBAT_REAL_ASSETS_READY|COMBAT_SECONDARY_WEAPONS|URBAN_REAL_SCENE_READY|COMBAT_ASSET_FAILURE/.test(text))mark('console',text.slice(0,800));
 });
 page.on('response',res=>{
  if(res.status()>=400&&/combat|maps|basis/.test(res.url()))report.errors.push('HTTP '+res.status()+' '+res.url().slice(0,200));
 });
 await page.goto(base+'/?qa=1',{waitUntil:'domcontentloaded',timeout:45000});
 await page.getByRole('button',{name:/ВОЙТИ НА КАРТУ/}).click({timeout:10000});
 mark('entered');
 await page.waitForFunction(()=>!!window.__URBAN_QA__,null,{timeout:170000});
 const urban=await page.evaluate(()=>({meshes:window.__URBAN_QA__.meshCount,sky:window.__URBAN_QA__.sky()}));
 if(!urban.meshes||!urban.sky.cloudDome)throw Error('City core or cloud dome missing');
 mark('urbanLoaded',urban);
 await page.waitForFunction(()=>window.__COMBAT_QA__?.snapshot().ready===true,null,{timeout:100000});
 const rifle=await page.evaluate(()=>window.__COMBAT_QA__.snapshot());
 if(!rifle.models.includes('rifle')||!rifle.models.includes('soldier')||!rifle.animations.some(x=>/reload/i.test(x)))
  throw Error('Animated source rifle or rigged humans missing');
 if(!rifle.targets.length||!rifle.targets.every(x=>x.skinned))throw Error('Target is not a skinned mesh');
 mark('rifleReady',rifle);
 await page.waitForTimeout(900);
 // Screenshot readback on SwiftShader can stall in CI. Gameplay assertions run first;
 // evidence capture is best effort and its failure is separately recorded.
 await page.getByRole('button',{name:'Выстрел'}).click();
 await page.waitForFunction(()=>window.__COMBAT_QA__.snapshot().ammo===29,null,{timeout:30000});
 mark('fired',await page.evaluate(()=>window.__COMBAT_QA__.snapshot()));
 await page.getByRole('button',{name:'Перезарядка'}).click();
 await page.waitForFunction(()=>window.__COMBAT_QA__.snapshot().ammo===30,null,{timeout:30000});
 mark('reloaded',await page.evaluate(()=>window.__COMBAT_QA__.snapshot()));
 await page.getByRole('button',{name:/2 · Pistol/}).click();
 await page.waitForFunction(()=>window.__COMBAT_QA__.snapshot().weapon==='pistol'&&window.__COMBAT_QA__.snapshot().models.includes('pistol'),null,{timeout:30000});
 mark('pistolReady',await page.evaluate(()=>window.__COMBAT_QA__.snapshot()));
 await page.getByRole('button',{name:/3 · Shotgun/}).click();
 await page.waitForFunction(()=>window.__COMBAT_QA__.snapshot().weapon==='shotgun'&&window.__COMBAT_QA__.snapshot().models.includes('shotgun'),null,{timeout:30000});
 mark('shotgunReady',await page.evaluate(()=>window.__COMBAT_QA__.snapshot()));
 const quality=page.getByRole('combobox',{name:'Качество графики'});
 await quality.selectOption('Cinematic Max');
 await page.waitForTimeout(2000);

 // Real frames (not internet asset previews). Try smaller Chromium viewport and
 // software compositor capture; inability to read back is recorded, not a gameplay pass.
 try{
  await page.setViewportSize({width:640,height:360});
  await page.waitForTimeout(600);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Page.enable');
  const data=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:70,fromSurface:false});
  fs.writeFileSync(OUT+'/04-cinematic-max.jpg',Buffer.from(data.data,'base64'));
  mark('capturedActualWebGLFrame',{bytes:data.data.length});
  await cdp.detach();
 }catch(e){mark('screenshotReadbackUnavailable',String(e).slice(0,320));}

 mark('cinematic',await page.evaluate(()=>({quality:document.querySelector('select')?.value,combat:window.__COMBAT_QA__?.snapshot(),sky:window.__URBAN_QA__?.sky()})));
 if(report.errors.some(e=>/HTTP 404|COMBAT_ASSET_FAILURE|Shader Error|WebGLProgram|PAGE/.test(e)))throw Error('Runtime console/network error');
 report.status='passed';
 console.log('COMBAT_BROWSER_QA_PASS');
}catch(error){
 report.status='failed';report.failure=String(error);console.error('COMBAT_BROWSER_QA_FAIL',String(error));
 if(page){try{await page.screenshot({path:OUT+'/failure.png',timeout:7000})}catch{}}
 process.exitCode=1;
}finally{
 report.ended=new Date().toISOString();
 fs.writeFileSync(OUT+'/report.json',JSON.stringify(report,null,2));
 if(browser)await browser.close();
}
