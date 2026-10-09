import fs from 'node:fs/promises';import path from 'node:path';import {NodeIO} from '@gltf-transform/core';import {KHRTextureTransform, KHRMaterialsEmissiveStrength, KHRMaterialsTransmission} from '@gltf-transform/extensions';import {getBounds,prune} from '@gltf-transform/functions';
await fs.mkdir('public/models',{recursive:true});await fs.mkdir('data',{recursive:true});
const out=[];
for(const id of await fs.readdir('assets-source')){
 const dir='assets-source/'+id;
 let m;try{m=JSON.parse(await fs.readFile(dir+'/meta.json','utf8'))}catch{continue}
 const doc=await new NodeIO().registerExtensions([KHRTextureTransform,KHRMaterialsEmissiveStrength,KHRMaterialsTransmission]).read(dir+'/'+m.gltf);
 if(id==='modular_urban_apartments_facade'){
  let keep=new Set(['wall_standard_standard_01','wall_window_centered_large_01','wall_window_centered_double_02','wall_door_centered_large_01','window_centered_large_01','window_centered_double_02','door_centered_large_01','cornice_standard_standard_01','dado_standard_standard_01']);
  for(const node of doc.getRoot().listNodes())if(!keep.has(node.getName()))node.dispose();else node.setTranslation([0,0,0]);
  await doc.transform(prune());
 }
 const bounds={};for(const n of doc.getRoot().listNodes())if(n.getMesh()){let b=getBounds(n);bounds[n.getName()]={min:b.min,max:b.max,dimensions:b.min.map((v,i)=>b.max[i]-v)}}
 const dest='public/models/'+id+'.glb';await new NodeIO().write(dest,doc);
 out.push({id,url:'/models/'+id+'.glb',source:'https://polyhaven.com/a/'+id,license:'CC0',originalBytes:m.totalBytes,bytes:(await fs.stat(dest)).size,bounds});
 console.log(id,'meshes',Object.keys(bounds).length,'MB',((await fs.stat(dest)).size/1e6).toFixed(2));
}
await fs.writeFile('data/catalog.json',JSON.stringify(out,null,2));

