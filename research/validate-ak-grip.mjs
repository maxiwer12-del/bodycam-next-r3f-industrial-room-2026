/**
 * Reproducible, real Chromium + software WebGL check, run against a build
 * containing the actual licensed /public/combat/ak74 GLTF and textures.
 * Never substitutes canned Bistro screenshots for rendered frames.
 */
import fs from 'node:fs';
import {chromium} from '@playwright/test';
const out='research/ak-grip-proof';
fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],screenshots:[],status:'running'};
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader',
 '--enable-webgl','--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1170,height:680},deviceScaleFactor:1});
const url=process.env.GRIP_TEST_URL||'http://localhost:3040';
page.on('pageerror',e=>report.errors.push(e.message));
page.on('console',m=>{if(/COMBAT_ASSET_FAILURE|Shader Error/.test(m.text()))report.errors.push(m.text().slice(0,500))});
function check(ok,name){if(!ok)throw Error(name);report.checks.push(name);console.log('PASS',name)}
async function snap(){return page.evaluate(()=>window.__COMBAT_QA__?.snapshot())}
try{
 await page.goto(url+'/dev/combat?qa=1',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>window.__COMBAT_QA__?.snapshot().ready===true,null,{timeout:75000});
 await page.waitForTimeout(650);
 const hip=await snap();
 check(hip.weapon==='rifle'&&hip.models.includes('rifle')&&hip.animations.includes('Rig|AK_Idle'),'Original licensed AK skinned viewmodel loaded');
 check(hip.rigRotation[0]<-.7&&hip.rigRotation[1]<-.6,'All gun + hand meshes share corrected orientation');
 check(Math.abs(hip.cameraRig[0]-.25)<.055,'Corrected hip placement');
 await page.screenshot({path:out+'/01-ak-hip.png',timeout:20000});report.screenshots.push('01-ak-hip.png');
 await page.waitForTimeout(900);
 const stable=await snap();
 check(Math.abs(stable.rigRotation[0]-hip.rigRotation[0])<.025,'No idle rotation jitter');
 await page.getByRole('button',{name:'ADS hold'}).hover();await page.mouse.down();
 await page.waitForTimeout(1100);
 const aim=await snap();
 check(aim.aimNow&&aim.adsAlpha>.9&&aim.rigRotation[0]>hip.rigRotation[0]+.15,'Smooth authored ADS posture');
 await page.screenshot({path:out+'/02-ak-ads.png',timeout:20000});report.screenshots.push('02-ak-ads.png');
 await page.mouse.up();
 await page.getByRole('button',{name:'Pistol'}).click();
 await page.waitForFunction(()=>window.__COMBAT_QA__?.snapshot().weapon==='pistol',null,{timeout:12000});
 check((await snap()).pistolOneHand===true,'Secondary pistol hand setup preserved');
 await page.getByRole('button',{name:'Shotgun'}).click();
 await page.waitForFunction(()=>window.__COMBAT_QA__?.snapshot().weapon==='shotgun',null,{timeout:12000});
 check((await snap()).weapon==='shotgun','Shotgun switching preserved');
 await page.getByRole('button',{name:'AK-74M'}).click();
 await page.waitForFunction(()=>window.__COMBAT_QA__?.snapshot().weapon==='rifle',null,{timeout:12000});
 check((await snap()).rigRotation[0]<-.7,'Rifle grip restored after switching');
 if(report.errors.length)throw Error(report.errors.join(' / '));
 report.status='passed';
}catch(e){report.status='failed';report.error=String(e);process.exitCode=1;}
finally{report.completedAt=new Date().toISOString();fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log('AK_GRIP_QA',report.status,JSON.stringify(report.checks));
