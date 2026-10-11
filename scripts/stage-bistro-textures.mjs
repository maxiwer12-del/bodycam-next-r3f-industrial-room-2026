/**
 * Stage every original ORCA Bistro KTX2 image as a first-party static asset.
 * In previous previews 246 images were still fetched from GitHub at runtime,
 * including most additional facade and interior BaseColor/Normal textures.
 */
import fs from 'node:fs';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

const root='public/maps/bistro-overhaul';
const dest='public/maps/bistro-zone/Textures';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const chunks=[...manifest.exterior,manifest.interior];
const docs=chunks.map(chunk=>({chunk,file:path.join('public',chunk.url),
 gltf:JSON.parse(fs.readFileSync(path.join('public',chunk.url),'utf8'))}));
const magic=Buffer.from([0xab,0x4b,0x54,0x58,0x20,0x32,0x30,0xbb,0x0d,0x0a,0x1a,0x0a]);
const expected=new Map();
for(const doc of docs)for(const img of doc.gltf.images||[]){
 const uri=img.uri||'';
 const match=uri.match(/(?:^|\/)Textures\/([A-Za-z0-9_.-]+\.ktx2)$/);
 if(!match)throw Error('Unexpected image URI: '+uri);
 const basename=match[1];
 expected.set(basename,basename);
}
fs.mkdirSync(dest,{recursive:true});
function valid(file){
 if(!fs.existsSync(file)||fs.statSync(file).size<150)return false;
 const fd=fs.openSync(file,'r');
 try{const buf=Buffer.alloc(12);fs.readSync(fd,buf,0,12,0);return buf.equals(magic)}
 finally{fs.closeSync(fd)}
}
const missing=[...expected.keys()].filter(x=>!valid(path.join(dest,x)));
let pointer=0,completed=0,downloadBytes=0;
async function worker(){
 while(pointer<missing.length){
  const name=missing[pointer++];
  const file=path.join(dest,name);
  const url='https://raw.githubusercontent.com/qian-o/GLTF-Assets/main/Bistro/Textures/'+name;
  let lastError;
  for(let attempt=0;attempt<4;attempt++){
   const tmp=file+'.part-'+process.pid;
   try{
    const response=await fetch(url,{headers:{'User-Agent':'BodycamNext-KTX2-Assets/2.0'},signal:AbortSignal.timeout(100000)});
    if(!response.ok||!response.body)throw Error('HTTP '+response.status+' '+name);
    await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(tmp));
    if(!valid(tmp))throw Error('Corrupt KTX2 / LFS pointer: '+name);
    const bytes=fs.statSync(tmp).size;
    fs.renameSync(tmp,file);
    completed++;downloadBytes+=bytes;
    lastError=null;break;
   }catch(e){
    lastError=e;fs.rmSync(tmp,{force:true});
    if(attempt<3)await new Promise(ok=>setTimeout(ok,(attempt+1)*750));
   }
  }
  if(lastError)throw Error('Bistro source texture unavailable: '+name+'; '+String(lastError));
 }
}
await Promise.all(Array.from({length:8},worker));
for(const name of expected.keys())if(!valid(path.join(dest,name)))throw Error('Missing or invalid staged Bistro texture '+name);
for(const doc of docs){
 for(const img of doc.gltf.images||[]){
  const name=img.uri.match(/(?:^|\/)Textures\/([A-Za-z0-9_.-]+\.ktx2)$/)?.[1];
  if(!name)throw Error('Invalid URI while rewriting '+doc.file);
  img.uri='/maps/bistro-zone/Textures/'+name;
 }
 fs.writeFileSync(doc.file,JSON.stringify(doc.gltf));
}
console.log('BISTRO_KTX2_FIRST_PARTY_READY',JSON.stringify({
 unique:expected.size,downloaded:completed,bytes:downloadBytes,
 missingAfter:0,rewrittenChunks:docs.length,baseUrl:'/maps/bistro-zone/Textures/'
}));
