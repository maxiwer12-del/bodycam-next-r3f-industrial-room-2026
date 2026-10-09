import fs from'node:fs';
import path from'node:path';
import {createHash}from'node:crypto';
import{pipeline}from'node:stream/promises';
import{Readable}from'node:stream';

const dir=process.env.BISTRO_SOURCE_DIR||'research/large-bistro/Bistro';
const base='https://raw.githubusercontent.com/qian-o/GLTF-Assets/main/Bistro/';
const binUrl='https://media.githubusercontent.com/media/qian-o/GLTF-Assets/main/Bistro/BistroExterior.bin';
const expectedBinSHA='46f97557874e1441b998c611314a755f9a3a4d52e5d405330edca5ac176cacdc';
const binaryPath=path.join(dir,'BistroExterior.bin'),gltfPath=path.join(dir,'BistroExterior.gltf');
const validKtx=(file)=>{try{const fd=fs.openSync(file,'r'),b=Buffer.alloc(12);fs.readSync(fd,b,0,12,0);fs.closeSync(fd);return b.equals(Buffer.from([0xab,0x4b,0x54,0x58,0x20,0x32,0x30,0xbb,0x0d,0x0a,0x1a,0x0a]))}catch{return false}};
const sha256=async file=>new Promise((resolve,reject)=>{const h=createHash('sha256'),s=fs.createReadStream(file);s.on('data',b=>h.update(b));s.on('end',()=>resolve(h.digest('hex')));s.on('error',reject)});
async function download(url,file,kind='binary'){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 for(let attempt=0;attempt<4;attempt++){
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(180000),headers:{'User-Agent':'BodycamNext-WebGL-AssetPipeline'}});
   if(!response.ok||!response.body)throw new Error('HTTP '+response.status+' '+url.slice(-85));
   const temp=file+'.partial-'+process.pid;
   await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(temp));
   const bytes=fs.statSync(temp).size;
   if(bytes<(kind==='ktx2'?112:256))throw new Error('Short '+kind+' file '+bytes+' bytes');
   if(kind==='ktx2'&&!validKtx(temp))throw new Error('Bad KTX2 signature');
   fs.renameSync(temp,file);
   return bytes;
  }catch(e){
   try{fs.rmSync(file+'.partial-'+process.pid,{force:true})}catch{}
   if(attempt===3)throw e;
   await new Promise(r=>setTimeout(r,1200*(attempt+1)));
  }
 }
}
fs.mkdirSync(path.join(dir,'Textures'),{recursive:true});
const start=Date.now();
if(!fs.existsSync(gltfPath)||fs.statSync(gltfPath).size<1000000)await download(base+'BistroExterior.gltf',gltfPath,'gltf');
const gltf=JSON.parse(fs.readFileSync(gltfPath,'utf8'));
if(gltf.asset?.version!=='2.0'||gltf.images.length<380)throw Error('Unexpected upstream glTF model');
if(!fs.existsSync(binaryPath)||fs.statSync(binaryPath).size!==179963220||await sha256(binaryPath)!==expectedBinSHA){
 await download(binUrl,binaryPath,'geometry');
 if(await sha256(binaryPath)!==expectedBinSHA)throw Error('Official Bistro binary SHA256 verification failed');
}
const hdr=path.join(dir,'san_giuseppe_bridge_4k.hdr');
if(!fs.existsSync(hdr)||fs.statSync(hdr).size<10000000)await download(base+'san_giuseppe_bridge_4k.hdr',hdr,'hdri');
const paths=[...new Set(gltf.images.map(i=>i.uri))];
let next=0,done=0,bytes=0,errors=[];
const concurrency=8;
async function worker(){
 while(next<paths.length){
  const uri=paths[next++];
  if(typeof uri!=='string'||!/^Textures\/[A-Za-z0-9_.-]+\.ktx2$/i.test(uri))throw Error('Unexpected image URI '+uri);
  const file=path.join(dir,uri);
  try{
   if(!validKtx(file)){bytes+=await download(base+uri,file,'ktx2');}
   done++;
   if(done%40===0||done===paths.length)console.log('DOWNLOADED_MATERIALS',done,'/',paths.length,'newMB',Math.round(bytes/1e6),'elapsedSec',Math.round((Date.now()-start)/1000));
  }catch(e){errors.push({uri,error:String(e).slice(0,180)})}
 }
}
await Promise.all(Array.from({length:concurrency},worker));
console.log('SOURCE_ASSET_DOWNLOAD',JSON.stringify({images:paths.length,materials:gltf.materials.length,meshes:gltf.meshes.length,newBytes:bytes,seconds:(Date.now()-start)/1000,errors}));
if(errors.length)process.exitCode=1;
