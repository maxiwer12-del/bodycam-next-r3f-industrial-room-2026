import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

const out='public';
const gltf=path.join(out,'maps/bistro-zone/scene-merged.gltf');
const bin=path.join(out,'maps/bistro-zone/BistroMerged.bin');
const basis=path.join(out,'basis/basis_transcoder.wasm');
const valid=()=>fs.existsSync(gltf)&&fs.statSync(gltf).size>50000&&fs.existsSync(bin)&&fs.statSync(bin).size>10000000&&fs.existsSync(basis)&&fs.statSync(basis).size>200000;
if(valid()){console.log('PREPARED_ASSETS_PRESENT');process.exit(0)}
const url='https://github.com/maxiwer12-del/bodycam-next-r3f-industrial-room-2026/releases/download/urban-bistro-assets-v1/urban-bistro-web-assets-v1.tar.gz';
const temp='/tmp/bodycam-urban-bistro-assets-v1.tar.gz';
let downloaded=false;
for(let attempt=0;attempt<4;attempt++){
 try{
  console.log('FETCH_LICENSED_ASSETS',attempt+1,url);
  const r=await fetch(url,{redirect:'follow',headers:{'User-Agent':'BodycamNext-AssetRelease/1.0'},signal:AbortSignal.timeout(120000)});
  if(!r.ok||!r.body)throw Error('HTTP '+r.status+' while fetching free CC-BY asset bundle');
  await pipeline(Readable.fromWeb(r.body),fs.createWriteStream(temp));
  if(fs.statSync(temp).size<40000000)throw Error('Release archive smaller than expected');
  downloaded=true;break;
 }catch(e){console.error('FETCH_RETRY',String(e).slice(0,240));fs.rmSync(temp,{force:true});if(attempt===3)throw e;await new Promise(res=>setTimeout(res,(attempt+1)*2000))}
}
if(!downloaded)throw Error('Asset release download failed');
const compressed=fs.readFileSync(temp);
const actualHash=createHash('sha256').update(compressed).digest('hex');
const expectedHash=process.env.BODYCAM_BUNDLE_SHA256;
if(expectedHash&&actualHash!==expectedHash)throw Error('Asset archive SHA-256 does not match pinned manifest');
console.log('ARCHIVE_RECEIVED',compressed.length,'SHA256',actualHash);
const bytes=zlib.gunzipSync(compressed,{maxOutputLength:600000000});
console.log('ARCHIVE_UNPACKED_BYTES',bytes.length);
const block=512;let cursor=0,created=0,expectedPath=null;
function safePath(name){
 if(name.startsWith('/')||name.includes('\\')||name.split('/').includes('..'))throw Error('Unsafe archive pathname');
 if(!(name==='maps/'||name==='maps'||name==='basis/'||name==='basis'||name.startsWith('maps/bistro-zone/')||name.startsWith('basis/')))throw Error('Unexpected path '+name);
 return path.join(out,name);
}
for(;cursor+block<=bytes.length;){
 const head=bytes.subarray(cursor,cursor+block);cursor+=block;
 if(head.every(v=>v===0))break;
 const field=(start,end)=>head.subarray(start,end).toString('utf8').replace(/\0.*$/s,'');
 const name=field(0,100),prefix=field(345,500),type=head[156],octal=field(124,136).trim();
 const size=parseInt(octal.replace(/\s+/g,''),8);
 if(!Number.isFinite(size)||size<0||size>100000000||cursor+size>bytes.length)throw Error('Corrupt tar member size: '+name);
 const raw=bytes.subarray(cursor,cursor+size);cursor+=Math.ceil(size/block)*block;
 if(type===76){expectedPath=raw.toString('utf8').replace(/\0.*$/s,'');continue} // GNU long name
 if(type===120){const lines=raw.toString('utf8').split('\n');for(const line of lines){const match=line.match(/\s+path=(.*)$/);if(match)expectedPath=match[1]}continue} // PAX extended metadata
 const original=expectedPath||((prefix?prefix+'/':'')+name);expectedPath=null;
 const target=safePath(original);
 if(type===53){fs.mkdirSync(target,{recursive:true});continue}
 if(type!==0&&type!==48)throw Error('Unexpected tar member type '+type+' '+original);
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,raw);
 created++;
}
fs.rmSync(temp,{force:true});
if(!valid())throw Error('Extracted assets failed size/presence checks');
console.log('BROWSER_READY_3D_ASSETS',created,'files',fs.statSync(bin).size,'bin bytes');
