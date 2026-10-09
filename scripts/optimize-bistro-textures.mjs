import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import sharp from 'sharp';

const run=promisify(execFile);
const ktx='research/tools/ktx/KTX-Software-4.4.2-Linux-x86_64/bin/ktx';
const root=process.env.BISTRO_TEXTURE_INPUT_DIR||'public/maps/bistro-zone/Textures';
const files=(await fs.readdir(root)).filter(f=>f.endsWith('.ktx2'));
const jobs=[];
for(const file of files){const stat=await fs.stat(path.join(root,file));if(stat.size>950000)jobs.push({file,size:stat.size});}
jobs.sort((a,b)=>b.size-a.size);
const maxWorkers=Number(process.env.BISTRO_TEXTURE_WORKERS||2);
if(!Number.isInteger(maxWorkers)||maxWorkers<1||maxWorkers>4)throw Error('Invalid worker setting');
console.log('OPT_PLAN',jobs.length,'assets',Math.round(jobs.reduce((s,j)=>s+j.size,0)/1e6),'inputMB','parallelWorkers',maxWorkers);

const essential=(name)=>/(Pavement|Cobble|Ground|Concrete|Brick|Facade|Bistro_Main_Door|Bistro_Sign|Window|Road|Stair)/i.test(name);
const allowed=process.env.BISTRO_TEXTURE_MODE||'hybrid';
if(!['hybrid','uastc','basis-lz'].includes(allowed))throw Error('Invalid mode '+allowed);
let next=0,converted=0,savedBytes=0,failure=[],byCodec={'uastc':0,'basis-lz':0};
const start=Date.now();
async function worker(){
 while(true){
  const index=next++;
  if(index>=jobs.length)return;
  const {file,size}=jobs[index],source=path.join(root,file);
  const tmp=path.join('/tmp','bistro-fast-'+process.pid+'-'+index);
  try{
   await run(ktx,['extract','--level','0',source,tmp+'.png'],{timeout:45000,maxBuffer:1024*512});
   const meta=await sharp(tmp+'.png').metadata();
   // Preserve source aspect ratio. Both axes MUST be multiples of four for Basis Universal.
   const width=Math.max(4,Math.round(Math.min(1024,meta.width||1024)/4)*4);
   const height=Math.max(4,Math.round((meta.height||width)*width/(meta.width||width)/4)*4);
   await sharp(tmp+'.png').resize(width,height,{kernel:'lanczos3',fit:'fill'}).png().toFile(tmp+'-small.png');
   const isColor=/(BaseColor|Emissive|Diffuse)/i.test(file);
   const format=(meta.hasAlpha?'R8G8B8A8_':'R8G8B8_')+(isColor?'SRGB':'UNORM');
   const codec=allowed==='hybrid'?(essential(file)?'uastc':'basis-lz'):allowed;
   const args=['create','--format',format,'--assign-tf',isColor?'srgb':'linear','--generate-mipmap','--encode',codec];
   if(codec==='uastc')args.push('--zstd','5');
   args.push(tmp+'-small.png',tmp+'.ktx2');
   await run(ktx,args,{timeout:55000,maxBuffer:1024*512});
   await run(ktx,['validate',tmp+'.ktx2'],{timeout:12000,maxBuffer:1024*512});
   const bytes=(await fs.stat(tmp+'.ktx2')).size;
   if(bytes>=size*1.08)console.log('KEEP_SOURCE',file,size,bytes);
   else {await fs.rename(tmp+'.ktx2',source);savedBytes+=size-bytes;byCodec[codec]++;}
   converted++;
   if(converted%10===0||converted===jobs.length)console.log('PROGRESS',converted,'/',jobs.length,'savedMB',Math.round(savedBytes/1e6),'elapsedSec',Math.round((Date.now()-start)/1000));
  }catch(e){failure.push({file,message:String(e).slice(0,380)});console.error('FAILED',file,String(e).slice(0,180))}
  finally{for(const suffix of ['.png','-small.png','.ktx2'])await fs.rm(tmp+suffix,{force:true}).catch(()=>{})}
 }
}
await Promise.all(Array.from({length:maxWorkers},()=>worker()));
const report={total:files.length,candidates:jobs.length,converted,failed:failure,bytesSaved:savedBytes,elapsedSec:(Date.now()-start)/1000,codecCounts:byCodec};
await fs.writeFile('research/texture-optimization.json',JSON.stringify(report,null,2));
console.log('COMPLETE',JSON.stringify(report));
if(failure.length)process.exitCode=1;
