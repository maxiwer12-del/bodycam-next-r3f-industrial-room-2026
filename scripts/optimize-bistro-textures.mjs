import fs from 'node:fs/promises';import path from 'node:path';import{execFileSync}from'node:child_process';import sharp from 'sharp';
const root='public/maps/bistro-zone/Textures',files=(await fs.readdir(root)).filter(f=>f.endsWith('.ktx2'));
const ktx='research/tools/ktx/KTX-Software-4.4.2-Linux-x86_64/bin/ktx';
const jobs=[];
for(const f of files){const stat=await fs.stat(root+'/'+f);if(stat.size>950000)jobs.push({file:f,size:stat.size});}
jobs.sort((a,b)=>b.size-a.size);
console.log('OPT_PLAN',jobs.length,'assets',Math.round(jobs.reduce((a,b)=>a+b.size,0)/1e6),'inputMB');
const maxWorkers=2;let idx=0,done=0,fail=[],newbytes=0,savedbytes=0;const t=Date.now();
async function worker(){
 while(true){
  let j=idx++;if(j>=jobs.length)return;
  let {file,size}=jobs[j],f=path.join(root,file);
  const tmp=path.join('/tmp','bistro-tx-'+process.pid+'-'+j);
  try{
   execFileSync(ktx,['extract','--level','0',f,tmp+'.png'],{stdio:'pipe',timeout:30000});
   const image=sharp(tmp+'.png',{limitInputPixels:50000000});const meta=await image.metadata();
   const side=Math.min(1024,meta.width||1024);
   const width=Math.max(4,Math.ceil(side/4)*4);
   await image.resize({width,kernel:'lanczos3'}).png().toFile(tmp+'-small.png');
   const isColor=/(BaseColor|Emissive|Diffuse)/i.test(file);
   const format=(meta.hasAlpha?'R8G8B8A8_':'R8G8B8_')+(isColor?'SRGB':'UNORM');
   execFileSync(ktx,['create','--format',format,'--assign-tf',isColor?'srgb':'linear','--generate-mipmap','--encode','uastc','--zstd','10',tmp+'-small.png',tmp+'.ktx2'],{stdio:'pipe',timeout:45000});
   execFileSync(ktx,['validate',tmp+'.ktx2'],{stdio:'pipe',timeout:10000});
   const bytes=(await fs.stat(tmp+'.ktx2')).size;
   if(bytes>=size*1.05){console.log('KEEP_ORIGINAL',file,size,bytes)}
   else {await fs.rename(tmp+'.ktx2',f);savedbytes+=size-bytes;newbytes+=bytes;}
   done++;if(done%10===0||done===jobs.length)console.log('PROGRESS',done,'/',jobs.length,'savedMB',Math.round(savedbytes/1e6),'elapsedSec',Math.round((Date.now()-t)/1000));
  }catch(e){fail.push({file,message:String(e).slice(0,120)});console.log('FAIL',file,String(e).slice(0,190))}
  finally{for(const suffix of ['.png','-small.png','.ktx2'])await fs.rm(tmp+suffix,{force:true}).catch(()=>{})}
 }
}
await Promise.all(Array.from({length:maxWorkers},()=>worker()));
const stats={total:files.length,candidates:jobs.length,converted:done,failed:fail,bytesSaved:savedbytes,elapsedSec:(Date.now()-t)/1000};await fs.writeFile('research/texture-optimization.json',JSON.stringify(stats,null,2));console.log('COMPLETE',JSON.stringify(stats));
if(fail.length)process.exitCode=1;

