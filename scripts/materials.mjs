import fs from 'node:fs';import {execFileSync} from 'node:child_process';
fs.mkdirSync('public/textures',{recursive:true});
for (const n of ['worn_concrete_floor','concrete_wall_004']){
 const j=JSON.parse(execFileSync('curl',['-sSfL','https://api.polyhaven.com/files/'+n],{encoding:'utf8'}));
 for(const [k,out] of [['Diffuse','color'],['nor_gl','normal'],['Rough','roughness']]){
 const rec=j[k]?.['2k']?.jpg;if(!rec)continue;const dest='public/textures/'+n+'-'+out+'.jpg';execFileSync('curl',['-sSfL',rec.url,'-o',dest]);console.log(dest,fs.statSync(dest).size)
 }
}
const h=JSON.parse(execFileSync('curl',['-sSfL','https://api.polyhaven.com/files/old_depot'],{encoding:'utf8'}));
execFileSync('curl',['-sSfL',h.hdri['1k'].hdr.url,'-o','public/textures/old_depot.hdr']);console.log('HDR downloaded');

