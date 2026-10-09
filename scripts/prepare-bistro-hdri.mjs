import fs from'node:fs';import{HDRLoader}from'three/addons/loaders/HDRLoader.js';import{DataUtils}from'three';
const source='research/large-bistro/Bistro/san_giuseppe_bridge_4k.hdr',output='public/maps/bistro-zone/san_giuseppe_1k.hdr';
const buf=fs.readFileSync(source),hdr=new HDRLoader().parse(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.length));
const W=1024,H=512,sw=hdr.width,sh=hdr.height,block=sw/W;
if(sw!==4096||sh!==2048)throw Error('unexpected HDR dimensions');
const channels=Array.from({length:4},()=>new Uint8Array(W));const out=[];
function encode(pixel){
 const max=Math.max(...pixel);if(max<1e-32)return[0,0,0,0];
 const e=Math.floor(Math.log2(max))+1;const scale=256/Math.pow(2,e);
 return[...pixel.map(v=>Math.min(255,Math.round(v*scale))),Math.min(255,Math.max(0,e+128))];
}
function pack(scan){let i=0;while(i<scan.length){
 let run=1;while(i+run<scan.length&&scan[i+run]===scan[i]&&run<127)run++;
 if(run>=4){out.push(128+run,scan[i]);i+=run;continue}
 let begin=i; i+=run;
 while(i<scan.length&&i-begin<125){
   let match=1;while(i+match<scan.length&&scan[i+match]===scan[i]&&match<127)match++;
   if(match>=4||i-begin+match>128)break;
   i+=match;
 }
 out.push(i-begin);for(let j=begin;j<i;j++)out.push(scan[j]);
}}
for(let y=0;y<H;y++){
 for(let x=0;x<W;x++){
  const sum=[0,0,0];
  for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++){
   const offset=(((y*4+sy)*sw)+(x*4+sx))*4;
   sum[0]+=DataUtils.fromHalfFloat(hdr.data[offset]);
   sum[1]+=DataUtils.fromHalfFloat(hdr.data[offset+1]);
   sum[2]+=DataUtils.fromHalfFloat(hdr.data[offset+2]);
  }
  const values=encode(sum.map(v=>v/16));
  for(let c=0;c<4;c++)channels[c][x]=values[c];
 }
 out.push(2,2,W>>8,W&255);for(let c=0;c<4;c++)pack(channels[c]);
}
const header=Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y '+H+' +X '+W+'\n','utf8');
fs.writeFileSync(output,Buffer.concat([header,Buffer.from(out)]));
const b=fs.readFileSync(output),test=new HDRLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.length));
console.log('HDR_DOWNSAMPLED',JSON.stringify({sourceMB:(buf.length/1e6).toFixed(1),outputMB:(b.length/1e6).toFixed(2),dims:[test.width,test.height],valid:test.width===W&&test.height===H}));

