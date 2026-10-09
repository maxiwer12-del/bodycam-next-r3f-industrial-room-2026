/**
 * Incremental, original-mesh-preserving spatial preparation of ORCA Bistro.
 * The urban core is still supplied by the already optimized stage-1 bundle.
 * Every additional source mesh is assigned ONCE to an independent spatial file;
 * geometry is not cut at chunk edges. Very large source meshes intersecting
 * the core are kept in the always-loaded core rather than clipped.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
const upstream='https://raw.githubusercontent.com/qian-o/GLTF-Assets/main/Bistro/';
const binaryCDN='https://media.githubusercontent.com/media/qian-o/GLTF-Assets/main/Bistro/';
const staging='research/large-bistro/Bistro',target='public/maps/bistro-overhaul';
const sourceFiles=[
 ['BistroExterior.gltf',2830929,null],['BistroExterior.bin',179963220,'46f97557874e1441b998c611314a755f9a3a4d52e5d405330edca5ac176cacdc'],
 ['BistroInterior.gltf',3226227,null],['BistroInterior.bin',42180576,'a02b152bc600f79104a2bfc56bc1f4198b3edcef1dc74f1474b809501015a29e']];
const digest=file=>new Promise((ok,bad)=>{let h=createHash('sha256');fs.createReadStream(file).on('data',x=>h.update(x)).on('end',()=>ok(h.digest('hex'))).on('error',bad)});
const version='spatial-v2.0-20261009-b';
async function download(name,size,sha){
 const dest=path.join(staging,name);await fsp.mkdir(staging,{recursive:true});
 if(fs.existsSync(dest)&&fs.statSync(dest).size===size&&(!sha||await digest(dest)===sha))return;
 for(let attempts=0;attempts<3;attempts++)try{
  const url=name.endsWith('.bin')?binaryCDN+name:upstream+name;
  const r=await fetch(url,{headers:{'User-Agent':'BodycamNext-BistroSpatial/2.0'},signal:AbortSignal.timeout(150000)});
  if(!r.ok||!r.body)throw Error('Download failed '+name+': '+r.status);
  const tmp=dest+'.partial';await pipeline(Readable.fromWeb(r.body),fs.createWriteStream(tmp));
  const byteCount=fs.statSync(tmp).size;
  if(byteCount!==size)throw Error(name+' is '+byteCount+' bytes, expected '+size+' (LFS pointer?)');
  if(sha&&await digest(tmp)!==sha)throw Error('SHA256 mismatch: '+name);
  await fsp.rename(tmp,dest);return;
 }catch(e){await fsp.rm(dest+'.partial',{force:true});if(attempts===2)throw e}
}
const readyFile=path.join(target,'manifest.json');
if(fs.existsSync(readyFile)&&JSON.parse(fs.readFileSync(readyFile)).version===version){
 console.log('SPATIAL_BISTRO_ALREADY_BUILT');process.exit(0)
}
for(const [file,size,sha] of sourceFiles)await download(file,size,sha);
const coreSource={cx:250,cy:150,halfExtent:1000};
const shift=[-coreSource.cx*.016,0,-coreSource.cy*.016];
const geometryRoot=path.join(target,'chunks');await fsp.mkdir(geometryRoot,{recursive:true});
const gltfCache={};
function open(name){
 const g=JSON.parse(fs.readFileSync(path.join(staging,name+'.gltf'),'utf8'));
 const bin=fs.readFileSync(path.join(staging,name+'.bin'));
 if(g.buffers.length!==1||g.buffers[0].byteLength!==bin.length)throw Error('Invalid buffer manifest '+name);
 gltfCache[name]={g,bin};return {g,bin};
}
function nodeBoxes(g){
 const root=g.nodes[g.scenes[0].nodes[0]],out=[];
 for(let i=0;i<g.nodes.length-1;i++){
  const n=g.nodes[i];if(n.mesh==null)continue;
  const l=new THREE.Box3();
  for(const p of g.meshes[n.mesh].primitives){
   const a=g.accessors[p.attributes.POSITION];
   if(a?.min&&a?.max)l.union(new THREE.Box3(new THREE.Vector3(...a.min),new THREE.Vector3(...a.max)));
  }
  if(l.isEmpty())continue;
  const q=new THREE.Quaternion().fromArray(n.rotation||[0,0,0,1]),v=new THREE.Vector3().fromArray(n.translation||[0,0,0]),s=new THREE.Vector3().fromArray(n.scale||[1,1,1]);
  const child=new THREE.Matrix4().compose(v,q,s);const srcBox=l.clone().applyMatrix4(child);
  const rv=new THREE.Vector3().fromArray(root.translation||[0,0,0]),rq=new THREE.Quaternion().fromArray(root.rotation||[0,0,0,1]),rs=new THREE.Vector3().fromArray(root.scale||[1,1,1]);
  const rootMatrix=new THREE.Matrix4().compose(rv,rq,rs);
  const finalBox=srcBox.clone().applyMatrix4(rootMatrix).translate(new THREE.Vector3(...shift));
  out.push({id:i,source:srcBox,world:finalBox});
 }
 return out;
}
function buildSubset(key,ids,name){
 const {g,bin}=gltfCache[key];const chosen=new Set(ids);
 const remesh=new Map(),remat=new Map(),reaccess=new Map(),review=new Map(),retex=new Map(),reimg=new Map(),resampler=new Map();
 const meshes=[],nodes=[],materials=[],accessors=[],bufferViews=[],textures=[],images=[],samplers=[];
 const usedBufferViews=new Set();
 const mapper=(map,array,old,fn)=>{
  if(old===undefined||old===null)return old;
  if(!map.has(old)){const next=array.length;map.set(old,next);array.push(fn(old))}
  return map.get(old);
 };
 const copyTexRef=o=>{if(o?.index!==undefined)o.index=useTex(o.index)};
 const useImage=i=>mapper(reimg,images,i,x=>{
  const image=structuredClone(g.images[x]);const uri=image.uri||'';
  if(!/^Textures\/[A-Za-z0-9_.-]+\.ktx2$/.test(uri))throw Error('Unsafe upstream texture path '+uri);
  const local=path.join('public/maps/bistro-zone',uri);
  image.uri=fs.existsSync(local)?'/maps/bistro-zone/'+uri:upstream+uri;
  return image;
 });
 const useSampler=i=>mapper(resampler,samplers,i,x=>structuredClone(g.samplers[x]));
 const useTex=i=>mapper(retex,textures,i,x=>{
  let obj=structuredClone(g.textures[x]);
  if(obj.source!==undefined)obj.source=useImage(obj.source);
  if(obj.extensions?.KHR_texture_basisu?.source!==undefined)obj.extensions.KHR_texture_basisu.source=useImage(obj.extensions.KHR_texture_basisu.source);
  if(obj.sampler!==undefined)obj.sampler=useSampler(obj.sampler);
  return obj;
 });
 const useMaterial=i=>mapper(remat,materials,i,x=>{
  let m=structuredClone(g.materials[x]);
  const spec=m.extensions?.KHR_materials_specular;
  if(spec?.specularTexture){
   // Upstream packs G=roughness and B=metalness, exactly glTF MR layout.
   m.pbrMetallicRoughness??={};
   m.pbrMetallicRoughness.metallicRoughnessTexture={index:spec.specularTexture.index};
   delete m.extensions.KHR_materials_specular;
   if(Object.keys(m.extensions).length===0)delete m.extensions;
   // Do not bind occlusion blindly: R of some converted packs is zero.
  }
  if(m.extensions?.KHR_materials_specular?.specularColorFactor){
    m.extensions.KHR_materials_specular.specularColorFactor=m.extensions.KHR_materials_specular.specularColorFactor.map(x=>Math.min(1,Math.max(0,x)));
  }
  for(const o of [m.pbrMetallicRoughness?.baseColorTexture,m.pbrMetallicRoughness?.metallicRoughnessTexture,m.normalTexture,m.occlusionTexture,m.emissiveTexture,m.extensions?.KHR_materials_transmission?.transmissionTexture,m.extensions?.KHR_materials_clearcoat?.clearcoatTexture])copyTexRef(o);
  return m;
 });
 const useAccessor=i=>mapper(reaccess,accessors,i,x=>{
  const a=structuredClone(g.accessors[x]);if(a.sparse)throw Error('Sparse accessor requires special handling');
  if(a.bufferView!==undefined){usedBufferViews.add(a.bufferView);a.bufferView=0/* patched below */;a._oldView=g.accessors[x].bufferView}
  return a;
 });
 const useMesh=i=>mapper(remesh,meshes,i,x=>{
  const mesh=structuredClone(g.meshes[x]);
  for(const primitive of mesh.primitives){
   for(const key of Object.keys(primitive.attributes||{}))primitive.attributes[key]=useAccessor(primitive.attributes[key]);
   if(primitive.indices!==undefined)primitive.indices=useAccessor(primitive.indices);
   if(primitive.material!==undefined)primitive.material=useMaterial(primitive.material);
   if(primitive.targets)for(const t of primitive.targets)for(const k of Object.keys(t))t[k]=useAccessor(t[k]);
  }
  return mesh;
 });
 for(const i of ids){
  const n=structuredClone(g.nodes[i]);if(n.children?.length)throw Error('Nested mesh subtree not supported, avoid splitting parent');
  n.mesh=useMesh(n.mesh);nodes.push(n);
 }
 let root=structuredClone(g.nodes[g.scenes[0].nodes[0]]);
 root.children=nodes.map((_,i)=>i);root.translation=shift;
 const rootIndex=nodes.push(root)-1;
 const sorted=[...usedBufferViews].sort((a,b)=>a-b);const newViews=new Map();
 const parts=[];let cursor=0;
 for(const old of sorted){
  const view=structuredClone(g.bufferViews[old]);
  if(view.buffer!==0)throw Error('Unexpected buffer');
  while(cursor%4){parts.push(Buffer.alloc(1));cursor++}
  const source=bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);
  view.byteOffset=cursor;view.buffer=0;
  newViews.set(old,bufferViews.length);bufferViews.push(view);parts.push(source);cursor+=source.length;
 }
 for(const a of accessors)if(a._oldView!==undefined){a.bufferView=newViews.get(a._oldView);delete a._oldView}
 const bytes=Buffer.concat(parts,cursor);const file=name+'.bin';
 const json={
  asset:{version:'2.0',generator:'Bodycam Next ORCA spatial preservation'},
  scene:0,scenes:[{nodes:[rootIndex]}],nodes,meshes,materials,accessors,bufferViews,
  buffers:[{uri:file,byteLength:bytes.byteLength}],images,textures,samplers,
  extensionsUsed:['KHR_texture_basisu',...(materials.some(m=>m.extensions?.KHR_materials_transmission)?['KHR_materials_transmission']:[]),...(materials.some(m=>m.extensions?.KHR_materials_specular)?['KHR_materials_specular']:[])],
  extensionsRequired:['KHR_texture_basisu']
 };
 const folder=path.join(geometryRoot,name);
 fs.mkdirSync(folder,{recursive:true});
 // textures and local paths are absolute URLs, geometry is relative.
 fs.writeFileSync(path.join(folder,name+'.gltf'),JSON.stringify(json));
 fs.writeFileSync(path.join(folder,file),bytes);
 const b=new THREE.Box3();
 for(const item of nodeBoxes(g).filter(v=>chosen.has(v.id)))b.union(item.world);
 return {id:name,url:'/maps/bistro-overhaul/chunks/'+name+'/'+name+'.gltf',bounds:[b.min.toArray(),b.max.toArray()],meshCount:ids.length,materialCount:materials.length,compressedTextures:images.length,geometryBytes:bytes.byteLength};
}
const ext=open('BistroExterior');
const b=nodeBoxes(ext.g),assigned=new Map(),core=[];
for(const node of b){
 const src=node.source;
 const intersects=src.max.x>=coreSource.cx-coreSource.halfExtent&&src.min.x<=coreSource.cx+coreSource.halfExtent&&src.max.y>=coreSource.cy-coreSource.halfExtent&&src.min.y<=coreSource.cy+coreSource.halfExtent;
 if(intersects){core.push(node.id);continue}
 const c=node.world.getCenter(new THREE.Vector3());
 const tx=Math.floor((c.x+16)/32),tz=Math.floor((c.z+16)/32);
 const id='ex-'+(tx<0?'m'+(-tx):'p'+tx)+'-'+(tz<0?'m'+(-tz):'p'+tz);
 if(!assigned.has(id))assigned.set(id,[]);
 assigned.get(id).push(node.id);
}
const exterior=[];
for(const [id,ids] of assigned)exterior.push(buildSubset('BistroExterior',ids,id));
const interiorSource=open('BistroInterior');
const interiorNodes=nodeBoxes(interiorSource.g);
const interior=buildSubset('BistroInterior',interiorNodes.map(x=>x.id),'interior-main');
const sourceMeshTotal=b.length;
const unique=new Set([...core,...[...assigned.values()].flat()]);
if(unique.size!==sourceMeshTotal)throw Error('Spatial coverage mismatch: '+unique.size+'/'+sourceMeshTotal);
const doorProfile={version,units:'metres',alignment:{position:shift,rotation:[0,0,0,1],scale:[1,1,1]},reason:'Exterior core was translated by [-250*0.016,0,-150*0.016], and source Interior has coincident, matching facade coordinates before that translation.',exteriorDoorApprox:[-5.26,1.42,-4.4],doorwayCheck:'Geometry-level opening and player route must be measured before acceptance',status:'TRANSFORM_ALIGNED_ROUTE_UNVERIFIED'};
fs.writeFileSync(path.join(target,'interior-transform-profile.json'),JSON.stringify(doorProfile,null,2));
const report={version,source:'NVIDIA ORCA Amazon Lumberyard Bistro, CC BY 4.0',conversion:'qian-o/GLTF-Assets',sourceExteriorMeshes:sourceMeshTotal,coreMeshCount:core.length,additionalExteriorMeshes:sourceMeshTotal-core.length,cityChunks:exterior.length,interiorMeshes:interior.meshCount,exterior,interior,alignment:doorProfile,sourceTextures:'Original KTX2, use prebuilt local copy when available and upstream CDN on demand'};
fs.writeFileSync(readyFile,JSON.stringify(report,null,2));
console.log('BISTRO_SPATIAL_PREPARED',JSON.stringify({core:core.length,additional:sourceMeshTotal-core.length,chunks:exterior.length,geometryBytes:exterior.reduce((s,c)=>s+c.geometryBytes,0),interiorBytes:interior.geometryBytes,meshCoverage:unique.size,interiorMeshes:interior.meshCount}));
