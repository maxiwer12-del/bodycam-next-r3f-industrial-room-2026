import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
const catalog=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
for(const a of catalog){
 const original=path.join('public',a.url);const tmp=original+'.tmp.glb';
 execFileSync('./node_modules/.bin/gltf-transform',['webp',original,tmp,'--quality','80'],{stdio:'ignore'});
 fs.renameSync(tmp,original);
 a.bytes=fs.statSync(original).size;
 console.log('Optimized',a.id,a.bytes);
}
fs.writeFileSync('data/catalog.json',JSON.stringify(catalog,null,2));
