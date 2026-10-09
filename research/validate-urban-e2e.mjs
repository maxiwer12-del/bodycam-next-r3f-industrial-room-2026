import{chromium,webkit,devices}from'@playwright/test';
const mode=process.argv[2]||'chromium';
const engine=mode==='webkit'?webkit:chromium;
const opts=mode==='webkit'?{headless:true}:{headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']};
const browser=await engine.launch(opts);
const context=await browser.newContext(mode==='webkit'?{...devices['iPhone 15 Pro'],viewport:{width:852,height:393},deviceScaleFactor:1,hasTouch:true,isMobile:true}:{viewport:{width:720,height:406},deviceScaleFactor:1});
const page=await context.newPage(),errors=[],badRequests=[];
page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('CONSOLE_ERROR',m.text().slice(0,360))}else if(m.text().includes('URBAN_REAL_SCENE_READY'))console.log('READY_EVENT',m.text().slice(0,650))});
page.on('pageerror',e=>{errors.push(e.message);console.log('ERROR',e.stack?.slice(0,450))});
page.on('requestfailed',r=>badRequests.push(r.url()));
try{
 const start=Date.now();
 await page.goto('http://127.0.0.1:3000/?qa=1',{waitUntil:'domcontentloaded',timeout:24000});
 await page.getByRole('button',{name:/ВОЙТИ НА КАРТУ/}).click({timeout:16000});
 await page.waitForFunction(()=>!!window.__URBAN_QA__,null,{timeout:100000});
 const before=await page.evaluate(()=>({cam:window.__URBAN_QA__.camera(),colliders:window.__URBAN_QA__.colliders,meshes:window.__URBAN_QA__.meshCount}));
 console.log('READY',mode,JSON.stringify(before),'SECONDS',Math.round((Date.now()-start)/1000));
 await page.keyboard.down('w');await page.waitForTimeout(1000);await page.keyboard.up('w');
 const after=await page.evaluate(()=>window.__URBAN_QA__.camera());
 console.log('MOVEMENT',JSON.stringify({before:before.cam,after,delta:Math.hypot(...after.map((n,i)=>n-before.cam[i]))}));
 await page.waitForTimeout(1500);
 console.log('STATUS',JSON.stringify({errors,badRequests,body:(await page.locator('body').innerText()).slice(0,350),canvas:(await page.locator('canvas').count())}));
}catch(e){console.log('FAIL',mode,String(e).slice(0,700));process.exitCode=1}finally{await browser.close()}

