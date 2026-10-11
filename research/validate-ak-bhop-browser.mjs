import {chromium} from '@playwright/test';
import fs from 'node:fs';
const base=process.env.TEST_BASE_URL||'http://localhost:3020';
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader',
 '--enable-webgl','--enable-unsafe-swiftshader'
]});
const report={errors:[],events:[],passed:[],failed:[]};
const captureDir='research/ak-bhop-qa';
fs.mkdirSync(captureDir,{recursive:true});
const page=await browser.newPage({viewport:{width:1180,height:670},deviceScaleFactor:1});
page.on('pageerror',e=>report.errors.push('pageerror '+e.message));
page.on('console',m=>{if(/Shader Error|COMBAT_ASSET_FAILURE|TypeError|Warning/.test(m.text()))report.errors.push(m.text().slice(0,500))});
page.on('response',r=>{if(r.status()>=400&&/combat|maps|basis/.test(r.url()))report.errors.push('HTTP '+r.status()+' '+r.url())});
async function take(file){try{await page.screenshot({path:captureDir+'/'+file+'.png',timeout:9000});report.passed.push('capture '+file)}catch(e){report.events.push('screenshot unavailable: '+file+' '+String(e).slice(0,120))}}
function ok(flag,label){if(!flag){report.failed.push(label);throw Error(label)}report.passed.push(label)}
try{
 await page.goto(base+'/dev/combat?qa=1',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>window.__COMBAT_QA__?.snapshot().ready===true,null,{timeout:65000});
 const rig=await page.evaluate(()=>window.__COMBAT_QA__.snapshot());
 ok(rig.animations.some(s=>s.includes('Idle')),'authored rig idle loaded');
 ok(rig.rigScale[0]>.22,'larger AK/arm scene (>1.3x)');
 report.events.push({rifle:rig.cameraRig,rigScale:rig.rigScale,clips:rig.animations});
 await take('01-ak-larger-higher');
 await page.getByRole('button',{name:'Pistol'}).click();
 await page.waitForFunction(()=>window.__COMBAT_QA__?.snapshot().weapon==='pistol',null,{timeout:22000});
 await take('02-pistol-shared-arms');
 await page.getByRole('button',{name:'AK-74M'}).click();
 await take('03-ak-after-switch');
 await page.goto(base+'/?qa=1',{waitUntil:'domcontentloaded',timeout:45000});
 await page.getByRole('button',{name:/ВОЙТИ НА КАРТУ/}).click();
 await page.waitForFunction(()=>window.__URBAN_QA__?.movement, null,{timeout:100000});
 const snap=()=>page.evaluate(()=>window.__URBAN_QA__.movement());
 let baseline=await snap();
 ok(baseline.grounded===true,'city initial ground');
 await page.keyboard.down('Shift');
 await page.keyboard.down('w');
 await page.waitForTimeout(1050);
 let moving=await snap();
 ok(moving.sprinting&&moving.speed>3.7,'Shift sprint moves faster than walking');
 await page.keyboard.down('Space');
 await page.waitForFunction(()=>window.__URBAN_QA__.movement().jumps===1,null,{timeout:8000});
 const airborne=await snap();
 ok(!airborne.grounded,'Space triggers actual vertical jump');
 // Space remains down: no repeat even across entire landing.
 await page.waitForTimeout(1300);
 const afterHold=await snap();
 ok(afterHold.jumps===1,'holding Space cannot bunnyhop');
 await page.keyboard.up('Space');
 await page.keyboard.up('Shift');
 await page.keyboard.up('w');
 report.events.push({baseline,moving,airborne,afterHold});
 await take('04-city-movement');
 console.log('BROWSER_BHOP_PASS',JSON.stringify(report.passed));
}catch(e){report.failed.push(String(e));console.log('BROWSER_BHOP_FAIL',String(e));}
finally{
 fs.writeFileSync(captureDir+'/report.json',JSON.stringify(report,null,2));
 console.log('BROWSER_BHOP_REPORT',JSON.stringify(report));
 await browser.close();
}
if(report.failed.length)process.exitCode=1;
