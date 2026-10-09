import fs from'node:fs/promises';
import path from'node:path';
import sharp from'sharp';
import {promisify}from'node:util';
import{execFile}from'node:child_process';
const run=promisify(execFile);
const root='public/maps/bistro-zone/Textures';
const ktx='research/tools/ktx/KTX-Software-4.4.2-Linux-x86_64/bin/ktx';
let checked=0,fixed=0,failures=[];
for(const file of(await fs.readdir(root)).filter(f=>f.endsWith('.ktx2'))){
 const p=path.join(root,file),buf=await fs.readFile(p);
 const width=buf.readUInt32LE(20),height=buf.readUInt32LE(24);checked++;
 if(width%4===0&&height%4===0)continue;
 if(width!==1||height!==1||!file.endsWith('_Normal.ktx2')){failures.push('Non-standard compressed dimensions '+file+' '+width+'x'+height);continue}
 const tmp='/tmp/bistro-normal-'+process.pid+'-'+fixed;
 try{
  await run(ktx,['extract','--level','0',p,tmp+'.png'],{timeout:10000});
  const meta=await sharp(tmp+'.png').metadata();
  await sharp(tmp+'.png').resize(4,4,{kernel:'nearest'}).png().toFile(tmp+'-padded.png');
  const format=meta.hasAlpha?'R8G8B8A8_UNORM':'R8G8B8_UNORM';
  await run(ktx,['create','--format',format,'--assign-tf','linear','--generate-mipmap','--encode','uastc','--zstd','5',tmp+'-padded.png',tmp+'.ktx2'],{timeout:15000});
  await run(ktx,['validate',tmp+'.ktx2'],{timeout:10000});
  await fs.rename(tmp+'.ktx2',p);fixed++;
 }catch(e){failures.push(file+': '+String(e).slice(0,160))}
 finally{for(const ext of['.png','-padded.png','.ktx2'])await fs.rm(tmp+ext,{force:true}).catch(()=>{})}
}
console.log('TINY_KTX2_VALIDATION',{checked,fixed,failures});
if(failures.length)process.exitCode=1;
