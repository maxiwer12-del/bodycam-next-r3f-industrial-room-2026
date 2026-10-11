/**
 * Licensed gunshot PCM samples, trimmed/resampled into short mobile-friendly WAVs.
 * All source files: petroulacl/fps-asset-kit (CC0), pinned public revision.
 * No synthetic "beep" audio and no third-party audio runtime dependency.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
const origin='https://raw.githubusercontent.com/petroulacl/fps-asset-kit/a19b7458a593598211c95ec46ef4eb4b6d1f94d7/sfx/firearm_sfx/Prepared%20SFX%20Library/';
const inputs={
 rifle:origin+'AK-47/C_27P.wav'
};
const root=path.resolve('public/combat/audio');
await fs.mkdir(root,{recursive:true});
await Promise.all(['pistol.wav','shotgun.wav'].map(file=>fs.rm(path.join(root,file),{force:true})));
async function download(url){
 const r=await fetch(url,{signal:AbortSignal.timeout(90000)});
 if(!r.ok)throw Error('SFX HTTP '+r.status+' '+url);
 const b=Buffer.from(await r.arrayBuffer());
 if(b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WAVE')throw Error('Not a WAV source: '+url);
 return b;
}
function parseWav(b){
 let offset=12,fmt=null,data=null;
 while(offset+8<=b.length){
  const tag=b.toString('ascii',offset,offset+4);
  const len=b.readUInt32LE(offset+4);
  if(len<0||offset+8+len>b.length)break;
  if(tag==='fmt '){
   fmt={format:b.readUInt16LE(offset+8),channels:b.readUInt16LE(offset+10),rate:b.readUInt32LE(offset+12),align:b.readUInt16LE(offset+20),bits:b.readUInt16LE(offset+22)};
  }
  if(tag==='data')data={start:offset+8,length:len};
  offset+=8+len+(len%2);
 }
 if(!fmt||!data||!fmt.channels||!fmt.align||!fmt.rate)throw Error('Missing WAV format or data');
 if(![1,3].includes(fmt.format)||![16,24,32].includes(fmt.bits))throw Error('Unsupported WAV codec');
 const frames=Math.floor(data.length/fmt.align);
 const read=(n)=>{
  const i=data.start+n*fmt.align;
  if(fmt.format===3&&fmt.bits===32)return Math.max(-1,Math.min(1,b.readFloatLE(i)));
  if(fmt.bits===16)return b.readInt16LE(i)/32768;
  if(fmt.bits===24){let x=b.readUIntLE(i,3);if(x&0x800000)x-=0x1000000;return x/8388608}
  return b.readInt32LE(i)/2147483648;
 };
 return {frames,rate:fmt.rate,read};
}
function encodeSample(wav){
 const {frames,rate,read}=parseWav(wav);
 let max=0;const stride=Math.max(1,Math.floor(rate/16000));
 for(let i=0;i<frames;i+=stride)max=Math.max(max,Math.abs(read(i)));
 let onset=0;
 const threshold=Math.max(.025,max*.22);
 for(let i=0;i<frames;i+=Math.max(1,Math.floor(rate/6000))){
  if(Math.abs(read(i))>threshold){onset=i;break}
 }
 const first=Math.max(0,onset-Math.round(rate*.016));
 const sr=32000;
 const frameCount=Math.min(Math.round(sr*1.22),Math.ceil((frames-first)/rate*sr));
 const out=Buffer.alloc(44+frameCount*2);
 out.write('RIFF',0);out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);
 out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);
 out.writeUInt32LE(sr,24);out.writeUInt32LE(sr*2,28);
 out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);
 out.writeUInt32LE(frameCount*2,40);
 const gain=max>.01?Math.min(1.3,.82/max):1;
 for(let i=0;i<frameCount;i++){
  const source=first+i*rate/sr;
  const a=Math.min(frames-1,Math.floor(source));
  const t=source-a;
  const sample=read(a)*(1-t)+read(Math.min(frames-1,a+1))*t;
  const fade=i>frameCount-sr*.12?Math.max(0,(frameCount-i)/(sr*.12)):1;
  out.writeInt16LE(Math.round(Math.max(-1,Math.min(1,sample*gain*fade))*32767),44+i*2);
 }
 return {buffer:out,sourceHz:rate,sourceFrames:frames,onsetSec:onset/rate};
}
const results={};
for(const [id,url] of Object.entries(inputs)){
 try{
  const original=await download(url),result=encodeSample(original);
  await fs.writeFile(path.join(root,id+'.wav'),result.buffer);
  results[id]='audio/'+id+'.wav';
  console.log('COMBAT_AUDIO_OK',id,original.length,'->',result.buffer.length,'sourceHz='+result.sourceHz,'onset='+result.onsetSec.toFixed(2));
 }catch(error){throw new Error('Cannot prepare licensed '+id+' sample: '+String(error))}
}
const manifestPath=path.resolve('public/combat/manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.audio=results;
manifest.licensing.push({model:'AK-74M gunshot sample',author:'Free Firearm Sound Library via fps-asset-kit',license:'CC0-1.0 as stated by kit',source:'https://github.com/petroulacl/fps-asset-kit/tree/a19b7458a593598211c95ec46ef4eb4b6d1f94d7/sfx'});
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2));
