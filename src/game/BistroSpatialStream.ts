import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {carveBistroEntrance} from './BistroDoorway';
import {batchBistroStaticGeometry} from './BistroStaticBatcher';

export interface BistroChunk {
 id:string;
 url:string;
 bounds:[number[],number[]];
 meshCount:number;
 geometryBytes:number;
 materialCount:number;
 compressedTextures:number;
}
export interface BistroManifest {
 version:string;
 cityChunks:number;
 coreMeshCount:number;
 additionalExteriorMeshes:number;
 exterior:BistroChunk[];
 interior:BistroChunk;
}
type Loaded = {root:THREE.Group;visuals:THREE.Group;physics:boolean};
type Entry = {asset:BistroChunk;box:THREE.Box3;isInterior:boolean};
export type StreamTelemetry={
 state:'loading'|'ready'|'error';
 loaded:string[];
 inflight:string[];
 interiorLoaded:boolean;
 completedMeshCount:number;
 errors:string[];
};

const NEAR_PHYSICS=38;
const PHYSICS_RELEASE=65;
const VISUAL_DIST=122;
const UNLOAD_DIST=145;
const DOOR = new THREE.Vector3(-5.26,1.7,-4.4);
function disposeGroup(root:THREE.Group){
 const geos=new Set<THREE.BufferGeometry>(),mats=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
 root.traverse(obj=>{
  if(!(obj instanceof THREE.Mesh))return;
  geos.add(obj.geometry);
  for(const mat of Array.isArray(obj.material)?obj.material:[obj.material]){
   if(!mat)continue;
   mats.add(mat);
   for(const [k,v]of Object.entries(mat))if(v instanceof THREE.Texture && k!=='envMap')textures.add(v);
  }
 });
 for(const geo of geos){(geo as THREE.BufferGeometry&{boundsTree?:unknown}).boundsTree=undefined;geo.dispose()}
 for(const mat of mats)mat.dispose();
 for(const t of textures)t.dispose();
}
export class BistroSpatialStream {
 private loader:GLTFLoader;
 private scene:THREE.Scene;
 private entries:Entry[]=[];
 private active=new Map<string,Loaded>();
 private pending=new Set<string>();
 private failed=new Set<string>();
 private stop=false;
 private seconds=1;
 private quality:'High'|'Cinematic Max';
 private physics:(id:string,group:THREE.Group,register:boolean)=>void;
 private telemetry:StreamTelemetry={state:'loading',loaded:[],inflight:[],interiorLoaded:false,completedMeshCount:0,errors:[]};
 private frustum=new THREE.Frustum();
 private matrix=new THREE.Matrix4();
 private expanded=new THREE.Box3();
 private anchor=new THREE.Vector3();
 constructor(options:{
  loader:GLTFLoader;scene:THREE.Scene;quality:'High'|'Cinematic Max';
  onPhysics:(id:string,group:THREE.Group,register:boolean)=>void;
 }){
  this.loader=options.loader;this.scene=options.scene;this.quality=options.quality;this.physics=options.onPhysics;
 }
 async init(){
  try{
   const res=await fetch('/maps/bistro-overhaul/manifest.json',{cache:'force-cache'});
   if(!res.ok)throw new Error('Spatial manifest HTTP '+res.status);
   const manifest=await res.json() as BistroManifest;
   if(manifest.cityChunks<8||manifest.additionalExteriorMeshes<250||manifest.interior.meshCount<1000)throw new Error('Manifest incomplete');
   this.entries=[...manifest.exterior.map(a=>({asset:a,box:new THREE.Box3(new THREE.Vector3(...a.bounds[0]),new THREE.Vector3(...a.bounds[1])),isInterior:false})),
    {asset:manifest.interior,box:new THREE.Box3(new THREE.Vector3(...manifest.interior.bounds[0]),new THREE.Vector3(...manifest.interior.bounds[1])),isInterior:true}];
   this.telemetry.state='ready';
   console.info('BISTRO_CITY_STREAM_READY',JSON.stringify({chunks:manifest.cityChunks,meshes:manifest.additionalExteriorMeshes,interior:manifest.interior.meshCount}));
  }catch(e){
   this.telemetry.state='error';this.telemetry.errors.push(String(e));
   console.error('BISTRO_CITY_STREAM_FAILED',e);
  }
 }
 snapshot():StreamTelemetry{
  return {...this.telemetry,loaded:[...this.active.keys()],inflight:[...this.pending],interiorLoaded:this.active.has('interior-main')};
 }
 private load(entry:Entry){
  if(this.pending.has(entry.asset.id)||this.active.has(entry.asset.id)||this.failed.has(entry.asset.id)||this.stop)return;
  const id=entry.asset.id;
  this.pending.add(id);
  this.loader.load(entry.asset.url,gltf=>{
   this.pending.delete(id);
   if(this.stop){disposeGroup(gltf.scene);return}
   const group=gltf.scene;
   group.traverse(obj=>{
    if(!(obj instanceof THREE.Mesh))return;
    const mat=Array.isArray(obj.material)?obj.material[0]:obj.material;
    if(mat instanceof THREE.MeshStandardMaterial){
     // DirectX source normals are authored with inverted Y.
     if(mat.normalMap)mat.normalScale.y*=-1;
     mat.envMapIntensity=.72;
    }
    const n=mat?.name?.toLowerCase()||'';
    obj.castShadow=this.quality==='Cinematic Max'&&!/glass|foliage|leaf|transparent/.test(n);
    obj.receiveShadow=this.quality==='Cinematic Max';
    obj.frustumCulled=true;
   });
   this.scene.add(group);
   group.updateMatrixWorld(true);
   if(entry.isInterior)console.info('BISTRO_INTERIOR_ENTRY_GEOMETRY',JSON.stringify(carveBistroEntrance(group)));
   const optimized=batchBistroStaticGeometry(group);
   this.scene.add(optimized.visuals);
   this.active.set(id,{root:group,visuals:optimized.visuals,physics:false});
   console.info('BISTRO_SPATIAL_BATCH_RESULT',id,JSON.stringify(optimized.report));
   this.telemetry.completedMeshCount+=entry.asset.meshCount;
   console.info('BISTRO_CHUNK_LOADED',id,entry.asset.meshCount,entry.asset.geometryBytes);
  },undefined,error=>{
   this.pending.delete(id);
   this.failed.add(id);
   this.telemetry.errors.push(id+': '+String(error));
   console.error('BISTRO_CHUNK_FAILED',id,error);
  });
 }
 update(camera:THREE.Camera,dt:number){
  if(this.telemetry.state!=='ready'||this.stop)return;
  this.seconds+=dt;
  if(this.seconds<.34)return;
  this.seconds=0;
  camera.updateMatrixWorld();
  this.matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  this.frustum.setFromProjectionMatrix(this.matrix);
  const prioritized:{entry:Entry,distance:number}[]=[];
  for(const entry of this.entries){
   const distance=entry.box.distanceToPoint(camera.position);
   const interiorDistance=camera.position.distanceTo(DOOR);
   const isDesired=entry.isInterior
    ?interiorDistance<45
    :distance<VISUAL_DIST && this.frustum.intersectsBox(this.expanded.copy(entry.box).expandByScalar(14));
   const current=this.active.get(entry.asset.id);
   if(isDesired&&!current&&!this.pending.has(entry.asset.id)&&!this.failed.has(entry.asset.id))
    prioritized.push({entry,distance:entry.isInterior?interiorDistance-30:distance});
   if(current){
    const bodyDistance=entry.isInterior?interiorDistance:distance;
    if(!current.physics&&bodyDistance<NEAR_PHYSICS){
      this.physics(entry.asset.id,current.root,true);current.physics=true;
    }
    if(current.physics&&bodyDistance>PHYSICS_RELEASE){
      this.physics(entry.asset.id,current.root,false);current.physics=false;
    }
    const mayUnload=entry.isInterior?interiorDistance>65:distance>UNLOAD_DIST;
    if(mayUnload&&!isDesired){
      if(current.physics)this.physics(entry.asset.id,current.root,false);
      this.scene.remove(current.root);this.scene.remove(current.visuals);
      disposeGroup(current.visuals);disposeGroup(current.root);this.active.delete(entry.asset.id);
      console.info('BISTRO_CHUNK_UNLOADED',entry.asset.id);
    }
   }
  }
  prioritized.sort((a,b)=>a.distance-b.distance);
  const remaining=Math.max(0,2-this.pending.size);
  for(const {entry} of prioritized.slice(0,remaining))this.load(entry);
 }
 dispose(){
  this.stop=true;
  for(const [id,item]of this.active){
   if(item.physics)this.physics(id,item.root,false);
   this.scene.remove(item.root);this.scene.remove(item.visuals);disposeGroup(item.visuals);disposeGroup(item.root);
  }
  this.active.clear();this.entries=[];
 }
}
