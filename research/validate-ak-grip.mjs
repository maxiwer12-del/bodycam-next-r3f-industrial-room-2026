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
 check(!!hip.leftHandPos&&!!hip.handPos,'Both original skinned hands loaded');
 check(hip.sleeveVertices>=1400,'Both textured sleeve meshes are present');
 check(hip.barrel?.pointsAway && hip.barrel.stock[2]-hip.barrel.muzzle[2]>.4,'Muzzle is forward, not facing the player');
 check(Math.abs(hip.barrel.muzzle[0])<.24&&Math.abs(hip.barrel.muzzle[1])<.3,'Barrel points near reticle, not offscreen');
 check(Math.abs(hip.cameraRig[0]-.13)<.055&&Math.abs(hip.cameraRig[2]+.45)<.08,'Corrected first-person hip placement');
 await page.screenshot({path:out+'/01-ak-hip.png',timeout:20000});report.screenshots.push('01-ak-hip.png');
 await page.waitForTimeout(900);
 const stable=await snap();
 check(Math.abs(stable.rigRotation[0]-hip.rigRotation[0])<.025,'No idle rotation jitter');
 await page.getByRole('button',{name:'ADS hold'}).hover();await page.mouse.down();
 await page.waitForTimeout(1100);
 const aim=await snap();
 check(aim.aimNow&&aim.adsAlpha>.9,'Smooth transition into ADS');
 check(aim.barrel?.pointsAway&&aim.barrel.stock[2]-aim.barrel.muzzle[2]>.4,'ADS muzzle also points downrange');
 check(aim.sights?.aligned===true,'Rear sight and front sight converge on the center of the ADS camera');
 check(Math.hypot(...aim.sights.rear)<.035 && Math.hypot(...aim.sights.front)<.035,'Both sight markers are at the camera reticle');
 await page.screenshot({path:out+'/02-ak-ads.png',timeout:20000});report.screenshots.push('02-ak-ads.png');
 await page.mouse.up();
 check((await page.getByRole('button',{name:/Pistol|Shotgun/i}).count())===0,'No removed secondary weapon buttons');
 await page.keyboard.press('2');await page.keyboard.press('3');
 check((await snap()).weapon==='rifle','Keys 2/3 do not switch away from AK');
 await page.getByRole('button',{name:'FIRE'}).click();
 await page.waitForFunction(()=>window.__COMBAT_QA__?.snapshot().ammo===29,null,{timeout:9000});
 check((await snap()).ammo===29,'AK fire consumes one round');
 await page.getByRole('button',{name:'RELOAD'}).click();
 await page.waitForFunction(()=>window.__COMBAT_QA__?.snapshot().ammo===30,null,{timeout:9000});
 check((await snap()).ammo===30,'AK reload works');
 if(report.errors.length)throw Error(report.errors.join(' / '));
 report.status='passed';
}catch(e){report.status='failed';report.error=String(e);process.exitCode=1;}
finally{report.completedAt=new Date().toISOString();fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log('AK_GRIP_QA',report.status,JSON.stringify(report.checks));
