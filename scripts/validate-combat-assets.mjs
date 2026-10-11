import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('public','combat');
const glbFiles=['soldier.glb','arms.glb','pistol.glb','shotgun.glb'];
for(const file of glbFiles){
 const bytes=await fs.readFile(path.join(root,file));
 if(bytes.length<10000||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(8)!==bytes.length)throw Error('Invalid GLB or LFS pointer: '+file);
 console.log('COMBAT_GLTF_PASS',file,bytes.length);
}
const gltf=JSON.parse(await fs.readFile(path.join(root,'ak74','scene.gltf'),'utf8'));
if(!gltf.skins?.length||!gltf.animations?.length||!gltf.meshes?.length)throw Error('Original animated rifle assets invalid');
let files=0,totalBytes=0;
for(const item of [...(gltf.images||[]),...(gltf.buffers||[])]){
 if(!item.uri||item.uri.startsWith('data:'))continue;
 const name=path.resolve(root,'ak74',item.uri);
 if(!name.startsWith(path.join(root,'ak74')+path.sep))throw Error('Unsafe asset path');
 const bytes=await fs.readFile(name);
 if(bytes.length<50)throw Error('Missing or empty AK74 dependency: '+item.uri);
 files++;totalBytes+=bytes.length;
}
const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
for(const id of ['rifle','pistol','shotgun']){
 const name=manifest.audio?.[id];if(!name)throw Error('Audio manifest entry missing for '+id);
 const sample=await fs.readFile(path.join(root,name));
 if(sample.length<10000||sample.toString('ascii',0,4)!=='RIFF'||sample.toString('ascii',8,12)!=='WAVE')throw Error('Invalid licensed audio: '+id);
 console.log('COMBAT_AUDIO_PASS',id,sample.length);
}
if(!manifest.licensing||!manifest.animationClips?.length)throw Error('License/animation manifest missing');
console.log('COMBAT_VALIDATION_PASS',JSON.stringify({animations:gltf.animations.map(a=>a.name),skins:gltf.skins.length,meshes:gltf.meshes.length,dependencies:files,sourceBytes:totalBytes}));
