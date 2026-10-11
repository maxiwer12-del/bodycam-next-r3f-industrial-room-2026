/**
 * Stage reproducible, licensed third-party combat assets.
 * No source files are checked into our repo; check non-LFS downloads and sizes.
 * The high detail AK74 viewmodel is intentionally decoded on demand in game.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root=path.resolve('public','combat');
const sources={
 soldier:'https://raw.githubusercontent.com/mrdoob/three.js/11738a9d55e502fb484cefffcea3a66dc44e9fe9/examples/models/gltf/Soldier.glb',
 ak:'https://raw.githubusercontent.com/Ayush-Mohanty/FPS-Arms-3D/c80a452e680c5a27c9e936176eb17e446869529a/Models/fps_ak-74m_animations/'
};
async function get(url){
 let error;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(90000)});
   if(!response.ok)throw Error('HTTP '+response.status+' '+url);
   const bytes=Buffer.from(await response.arrayBuffer());
   if(bytes.subarray(0,60).toString().startsWith('version https://git-lfs.github.com/spec/v1'))throw Error('Git LFS pointer, not model: '+url);
   if(!bytes.length)throw Error('Empty response: '+url);
   return bytes;
  }catch(e){error=e;console.warn('COMBAT_DOWNLOAD_RETRY',attempt+1,String(e).slice(0,140))}
 }
 throw error;
}
async function binary(file,url){
 const bytes=await get(url);
 if(bytes.length<10000||bytes.toString('ascii',0,4)!=='glTF')throw Error('Invalid GLB: '+file);
 const version=bytes.readUInt32LE(4),length=bytes.readUInt32LE(8);
 if(version!==2||length!==bytes.length)throw Error('Invalid GLB header: '+file);
 const target=path.join(root,file);await fs.mkdir(path.dirname(target),{recursive:true});
 await fs.writeFile(target,bytes);
 console.log('COMBAT_ASSET_OK',file,bytes.length);
}
await fs.mkdir(root,{recursive:true});
await binary('soldier.glb',sources.soldier);
const operativeSource='https://raw.githubusercontent.com/StarKnightt/counter-strike-in-browser/92f3e6ddee40c6b531c0788c2cf3db4c56853a37/public/models/';
for(const variant of ['mask','wrap_goggles','mask_cap']){
 await binary('operatives/'+variant+'.glb',operativeSource+'bot_'+variant+'.glb');
}
await Promise.all(['arms.glb','pistol.glb','shotgun.glb'].map(file=>fs.rm(path.join(root,file),{force:true})));
const document=JSON.parse((await get(sources.ak+'scene.gltf')).toString('utf8'));
if(!document.meshes?.length||!document.animations?.length||!document.skins?.length)throw Error('AK74 file is missing meshes, animations or skinning');
const outDir=path.join(root,'ak74');await fs.mkdir(outDir,{recursive:true});
for(const buffer of document.buffers||[]){
 if(!buffer.uri||buffer.uri.startsWith('data:'))continue;
 if(buffer.uri.includes('..'))throw Error('Unsafe buffer path');
 const data=await get(sources.ak+buffer.uri.split('/').map(encodeURIComponent).join('/'));
 if(data.length<10000)throw Error('Invalid animation buffer');
 const target=path.join(outDir,buffer.uri);await fs.mkdir(path.dirname(target),{recursive:true});
 await fs.writeFile(target,data);
}
for(let i=0;i<(document.images||[]).length;i++){
 const image=document.images[i];
 if(!image.uri||image.uri.startsWith('data:'))continue;
 if(image.uri.includes('..'))throw Error('Unsafe texture path');
 const original=await get(sources.ak+image.uri.split('/').map(encodeURIComponent).join('/'));
 if(original.length<512)throw Error('Invalid texture');
 const meta=await sharp(original).metadata();
 // Max 2048, not a blanket 1024 reduction. Maintain channels and transparency.
 const name='tex-'+i+'.png';
 const converted=await sharp(original)
  .resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true})
  .png({compressionLevel:9,effort:8}).toBuffer();
 await fs.writeFile(path.join(outDir,name),converted);
 image.uri=name;
 delete image.mimeType;
 console.log('COMBAT_TEXTURE_OK',i,meta.width+'x'+meta.height,'->',converted.length);
}
await fs.writeFile(path.join(outDir,'scene.gltf'),JSON.stringify(document));
await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify({
 version:1,
 models:{soldier:'soldier.glb',operatives:['operatives/mask.glb','operatives/wrap_goggles.glb','operatives/mask_cap.glb'],rifle:'ak74/scene.gltf'},
 animationClips:document.animations.map(a=>a.name||'(unnamed)'),
 ak74Skins:document.skins.length,
 licensing:[
  {model:'AK-74m arms + animation',author:'Cransh',license:'CC-BY-4.0',source:'https://sketchfab.com/3d-models/fps-ak-74m-animations-94be8385c402474cacd39bc096c6ca14'},
  {model:'Masked tactical operative variants',author:'StarKnightt, derived from Mixamo Vanguard rig',license:'Original model modifications MIT, underlying Mixamo animations retain source terms',source:'https://github.com/StarKnightt/counter-strike-in-browser/tree/92f3e6ddee40c6b531c0788c2cf3db4c56853a37/public/models'},
  {model:'Soldier rig',author:'Mixamo / Vanguard by T. Choonyung',license:'Mixamo asset terms — embedded game use',source:'https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf'}
 ]},null,2));
console.log('COMBAT_ASSETS_READY',document.animations.map(a=>a.name).join(' | '));
