'use client';
import * as THREE from 'three';
import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';

export type WeaponId='rifle'|'pistol'|'shotgun';
export type CombatPulse={
 shots:number;hits:number;eliminations:number;ammo:number;reserve:number;
 reload:boolean;weapon:WeaponId;ready:boolean;targets:number;
};
type WeaponDefinition={
 id:WeaponId;label:string;mag:number;reserve:number;damage:number;
 fireDelay:number;reloadMs:number;model:string;length:number;
};
export const COMBAT_WEAPONS:readonly WeaponDefinition[]=[
 {id:'rifle',label:'AK-74M',mag:30,reserve:120,damage:34,fireDelay:115,reloadMs:2050,model:'/combat/ak74/scene.gltf',length:.91},
 {id:'pistol',label:'Pistol',mag:12,reserve:60,damage:46,fireDelay:190,reloadMs:1330,model:'/combat/pistol.glb',length:.38},
 {id:'shotgun',label:'Shotgun',mag:6,reserve:30,damage:80,fireDelay:740,reloadMs:2650,model:'/combat/shotgun.glb',length:.78}
];
type GunState={ammo:number;reserve:number};
type Avatar={
 root:THREE.Group;model:THREE.Object3D;mixer:THREE.AnimationMixer;
 meshes:THREE.Mesh[];health:number;hit:number;fall:number;alive:boolean;
 base:THREE.Vector3;
};
type ClipSet={idle?:THREE.AnimationAction;fire?:THREE.AnimationAction;reload?:THREE.AnimationAction;};
type ViewBank={root:THREE.Group;arms:THREE.Object3D|null;rifle:THREE.Object3D|null;guns:Map<WeaponId,THREE.Object3D>;mixer:THREE.AnimationMixer|null;clips:ClipSet;flash:THREE.PointLight;loaded:boolean};
const SPAWNS:readonly [number,number,number][]=[[-8,.35,-7.3],[-10,.35,-11.2],[-4,.35,-12.5]];
const emptyView=():ViewBank=>({
 root:new THREE.Group(),arms:null,rifle:null,guns:new Map(),mixer:null,clips:{},
 flash:new THREE.PointLight('#ffd6a0',0,2.1),loaded:false
});
function fitModel(object:THREE.Object3D,length:number){
 // Imported assets differ in source units. Normalize using the actual mesh bounds.
 const bounds=new THREE.Box3().setFromObject(object);
 const extent=bounds.getSize(new THREE.Vector3());
 const largest=Math.max(extent.x,extent.y,extent.z);
 if(!Number.isFinite(largest)||largest<.001)throw Error('Empty combat asset bounds');
 const center=bounds.getCenter(new THREE.Vector3());
 const inner=new THREE.Group();
 inner.add(object);
 object.position.sub(center);
 const frame=new THREE.Group();
 frame.scale.setScalar(length/largest);
 frame.add(inner);
 return {frame,extent};
}
function clipOf(mixer:THREE.AnimationMixer,clips:THREE.AnimationClip[],pattern:RegExp){
 const clip=clips.find(c=>pattern.test(c.name));
 return clip?mixer.clipAction(clip):undefined;
}
function playOnce(action?:THREE.AnimationAction){
 if(!action)return;
 action.reset().setLoop(THREE.LoopOnce,1);
 action.clampWhenFinished=false;
 action.fadeIn(.06).play();
}
function setTargetMaterial(model:THREE.Object3D,shadow:boolean){
 model.traverse(o=>{
  if(o instanceof THREE.Mesh){
   o.castShadow=shadow;o.receiveShadow=true;
   const materials=Array.isArray(o.material)?o.material:[o.material];
   for(const mat of materials){
    if(mat instanceof THREE.MeshStandardMaterial){
     mat.roughness=Math.max(mat.roughness,.32);
     mat.needsUpdate=true;
    }
   }
  }
 });
}
function uniqueMeshes(object:THREE.Object3D){
 const meshes:THREE.Mesh[]=[];
 object.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o)});
 return meshes;
}
function aimAtPlayer(root:THREE.Object3D,target:THREE.Vector3,delta:number){
 const dx=target.x-root.position.x;
 const dz=target.z-root.position.z;
 const face=Math.atan2(dx,dz);
 let d=((face-root.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI;
 root.rotation.y+=d*Math.min(1,delta*2.3);
}

/**
 * First-person glTF character/weapon controller. No placeholder boxes/capsules.
 * Character enemies are rigged, textured Soldier.glb clones with skeleton-safe cloning.
 * The licensed AK-74M contains its own arms, weapon, and animation clips.
 * Other guns share a lightweight CC0 rigged FPS-arms asset.
 */
export function BistroCombat({trigger,reload,select,aim,onStatus,quality,mapReady}:{
 trigger:React.RefObject<number>;reload:React.RefObject<number>;
 select:React.RefObject<number>;aim:React.RefObject<boolean>;
 onStatus:(value:CombatPulse)=>void;quality:'High'|'Cinematic Max';mapReady:React.RefObject<boolean>;
}){
 const {camera,scene}=useThree();
 const view=useRef<ViewBank>(emptyView());
 const soldiers=useRef<Avatar[]>([]);
 const current=useRef<WeaponId>('rifle');
 const counts=useRef<Record<WeaponId,GunState>>({
  rifle:{ammo:30,reserve:120},pistol:{ammo:12,reserve:60},shotgun:{ammo:6,reserve:30}
 });
 const metrics=useRef({shots:0,hits:0,eliminations:0});
 const lastFire=useRef(0),fireCounter=useRef(0),reloadCounter=useRef(0);
 const reloadUntil=useRef(0),equippedUntil=useRef(0);
 const recoil=useRef(0),sway=useRef(0),muzzleUntil=useRef(0);
 const cameraBefore=useRef(new THREE.Vector3());
 const worldRay=useRef(new THREE.Raycaster());
 const rayOrigin=useRef(new THREE.Vector3()),rayDirection=useRef(new THREE.Vector3());
 const viewport=useRef({fov:(camera as THREE.PerspectiveCamera).fov||78});
 const ready=useRef(false);
 const report=useRef<()=>void>(()=>{});
 const audio=useRef<AudioContext|null>(null);
 const audioClips=useRef(new Map<WeaponId,AudioBuffer>());
 const loadedClips=useRef<string[]>([]);
 const loadedModels=useRef<string[]>([]);
 const notify=()=>{
  const ammo=counts.current[current.current];
  onStatus({...metrics.current,ammo:ammo.ammo,reserve:ammo.reserve,
   weapon:current.current,reload:reloadUntil.current>performance.now(),
   ready:ready.current&&view.current.guns.has(current.current),targets:soldiers.current.filter(t=>t.alive).length});
 };
 report.current=notify;

 useEffect(()=>{
  let disposed=false;
  const bank=emptyView();view.current=bank;
  bank.root.position.set(.235,-.26,-.55);
  bank.flash.position.set(-.06,.10,-.75);
  bank.flash.intensity=0;
  bank.root.add(bank.flash);
  // Three.js does not draw camera children unless the camera belongs to the scene graph.
  // R3F's default camera normally has no parent, so explicitly attach it and restore on dispose.
  const originalParent=camera.parent;
  if(!camera.parent)scene.add(camera);
  camera.add(bank.root);
  const enemyLayer=new THREE.Group();enemyLayer.name='CombatCharacterLayer';
  scene.add(enemyLayer);
  const loader=new GLTFLoader();
  const load=async()=>{
   // Wait until the heavy Bistro core geometry and textures are ready.
   // Loading full-size animated hands and three humanoids in parallel with the city
   // caused excessive first-frame pressure on mobile WebGL GPU memory.
   if(!mapReady.current){await new Promise<void>((resolve,reject)=>{
    const timer=window.setInterval(()=>{
     if(disposed){clearInterval(timer);reject(Error('Scene disposed'));}
     else if(mapReady.current){clearInterval(timer);resolve();}
    },250);
   });}
   if(disposed)return;
   const [soldierGltf,akGltf]=await Promise.all([
    loader.loadAsync('/combat/soldier.glb'),
    loader.loadAsync('/combat/ak74/scene.gltf')
   ]);
   if(disposed)return;
   loadedModels.current=['soldier','rifle'];
   // Full-body humanoids use the original skinned geometry and embedded Idle/Walk/Run clips.
   SPAWNS.forEach((position,id)=>{
    const model=cloneSkinned(soldierGltf.scene);
    const box=new THREE.Box3().setFromObject(model);
    const height=box.max.y-box.min.y;
    if(!Number.isFinite(height)||height<.1)throw Error('Soldier asset is missing geometry');
    model.scale.multiplyScalar(1.8/height);
    model.updateMatrixWorld(true);
    const normalized=new THREE.Box3().setFromObject(model);
    model.position.y-=normalized.min.y;
    const root=new THREE.Group();
    root.position.set(...position);
    root.add(model);
    enemyLayer.add(root);
    const mixer=new THREE.AnimationMixer(model);
    const idle=clipOf(mixer,soldierGltf.animations,/idle/i)
      ||(soldierGltf.animations.length?mixer.clipAction(soldierGltf.animations[0]):undefined);
    idle?.play();
    const meshes=uniqueMeshes(model);
    meshes.forEach(mesh=>mesh.userData.combatTarget=id);
    setTargetMaterial(model,quality==='Cinematic Max');
    soldiers.current.push({root,model,mixer,meshes,health:100,hit:0,fall:0,alive:true,base:new THREE.Vector3(...position)});
   });
   // Animated high-detail first-person arm + AK scene (from the licensed artist).
   const ak=cloneSkinned(akGltf.scene);
   const fittedAk=fitModel(ak,COMBAT_WEAPONS[0].length);
   fittedAk.frame.rotation.set(-.03,Math.PI,0);
   bank.rifle=fittedAk.frame;
   bank.guns.set('rifle',fittedAk.frame);
   bank.root.add(fittedAk.frame);
   setTargetMaterial(ak,false);
   const mixer=new THREE.AnimationMixer(ak);
   bank.mixer=mixer;
   bank.clips={
    idle:clipOf(mixer,akGltf.animations,/idle|rest|breath/i),
    fire:clipOf(mixer,akGltf.animations,/fire|shoot|shot/i),
    reload:clipOf(mixer,akGltf.animations,/reload/i)
   };
   bank.clips.idle?.play();
   loadedClips.current=akGltf.animations.map(c=>c.name);
   console.info('COMBAT_AK74_CLIPS',JSON.stringify(loadedClips.current));
   // Optional CC0 weapons never block the primary animated rig from becoming ready.
   const optional=async()=>{
    const [armsGltf,pistolGltf,shotgunGltf]=await Promise.all([
     loader.loadAsync('/combat/arms.glb'),loader.loadAsync('/combat/pistol.glb'),loader.loadAsync('/combat/shotgun.glb')
    ]);
    if(disposed)return;
   // Real CC0 hands and independently licensed models for the alternate weapons.
   const arms=cloneSkinned(armsGltf.scene);
   const armFrame=fitModel(arms,.70).frame;
   armFrame.rotation.set(-.18,Math.PI,0);
   bank.root.add(armFrame);bank.arms=armFrame;armFrame.visible=false;
   for(const [id,modelGltf] of [['pistol',pistolGltf],['shotgun',shotgunGltf]] as const){
    const gunModel=modelGltf.scene.clone(true);
    const fitted=fitModel(gunModel,COMBAT_WEAPONS.find(w=>w.id===id)!.length);
    const {frame,extent}=fitted;
    // Automatically align the original barrel's longest geometric axis with camera -Z.
    if(extent.x>extent.y&&extent.x>extent.z)frame.rotation.y=Math.PI/2;
    else if(extent.y>extent.z)frame.rotation.x=-Math.PI/2;
    else frame.rotation.y=Math.PI;
    frame.position.set(.06,-.02,-.23);
    bank.root.add(frame);
    bank.guns.set(id,frame);
    frame.visible=false;
    setTargetMaterial(gunModel,false);
   }
    loadedModels.current.push('arms','pistol','shotgun');report.current();
    console.info('COMBAT_SECONDARY_WEAPONS_READY');
   };
   void optional().catch(err=>console.warn('COMBAT_SECONDARY_WEAPONS_WARNING',err));
   ready.current=true;bank.loaded=true;cameraBefore.current.copy(camera.position);
   report.current();
   console.info('COMBAT_REAL_ASSETS_READY',JSON.stringify({
    models:loadedModels.current,enemySkinnedMeshes:soldiers.current.map(x=>x.meshes.length),
    clips:loadedClips.current
   }));
  };
  void load().catch(err=>{console.error('COMBAT_ASSET_FAILURE',err);ready.current=false;report.current()});
  const keyboard=(e:KeyboardEvent)=>{
   if(e.code==='KeyR'){reload.current++;e.preventDefault()}
   if(e.code==='Digit1'){select.current=1}
   if(e.code==='Digit2'){select.current=2}
   if(e.code==='Digit3'){select.current=3}
   if(e.code==='ShiftLeft'||e.code==='ShiftRight')aim.current=true;
  };
  const up=(e:KeyboardEvent)=>{if(e.code==='ShiftLeft'||e.code==='ShiftRight')aim.current=false};
  const rightDown=(e:MouseEvent)=>{if(e.button===2)aim.current=true};
  const rightUp=(e:MouseEvent)=>{if(e.button===2)aim.current=false};
  window.addEventListener('keydown',keyboard);window.addEventListener('keyup',up);
  window.addEventListener('mousedown',rightDown);window.addEventListener('mouseup',rightUp);
  camera.parent?.updateMatrixWorld(true);
  const heartbeat=window.setInterval(()=>report.current(),320);
  if(new URLSearchParams(window.location.search).has('qa')){
   (window as typeof window & {__COMBAT_QA__?:unknown}).__COMBAT_QA__={
    snapshot:()=>({ready:ready.current,models:loadedModels.current,animations:loadedClips.current,
     targets:soldiers.current.map(s=>({health:s.health,alive:s.alive,skinned:s.meshes.some(m=>m instanceof THREE.SkinnedMesh)})),
     weapon:current.current,ammo:counts.current[current.current].ammo}),
    fire:()=>trigger.current++,reload:()=>reload.current++,
    select:(i:number)=>{if(i>=1&&i<=3)select.current=i}
   };
  }
  return()=>{
   disposed=true;ready.current=false;
   clearInterval(heartbeat);
   window.removeEventListener('keydown',keyboard);window.removeEventListener('keyup',up);
   window.removeEventListener('mousedown',rightDown);window.removeEventListener('mouseup',rightUp);
   bank.root.remove(bank.flash);camera.remove(bank.root);scene.remove(enemyLayer);
   if(!originalParent&&camera.parent===scene)scene.remove(camera);
   soldiers.current=[];bank.guns.clear();
   if((window as typeof window & {__COMBAT_QA__?:unknown}).__COMBAT_QA__)delete (window as typeof window & {__COMBAT_QA__?:unknown}).__COMBAT_QA__;
   void audio.current?.close();audio.current=null;
  };
 },[camera,scene,reload,select,trigger,aim,onStatus,mapReady]);

 useEffect(()=>{
  let cancelled=false,requested=false;
  const resume=()=>{
   if(!audio.current){
    try{audio.current=new AudioContext()}catch{return}
   }
   void audio.current.resume().catch(()=>{});
   if(requested)return;requested=true;
   const ctx=audio.current;
   for(const name of ['rifle','pistol','shotgun'] as const){
    void fetch('/combat/audio/'+name+'.wav',{cache:'force-cache'})
     .then(response=>{if(!response.ok)throw Error('Audio HTTP '+response.status);return response.arrayBuffer()})
     .then(bytes=>ctx.decodeAudioData(bytes))
     .then(buffer=>{if(!cancelled)audioClips.current.set(name,buffer)})
     .catch(error=>console.warn('COMBAT_AUDIO_WARNING',name,error));
   }
  };
  // Safari/iOS requires Web Audio to be unlocked inside a user gesture.
  window.addEventListener('pointerdown',resume,{passive:true});
  window.addEventListener('keydown',resume);
  return()=>{cancelled=true;window.removeEventListener('pointerdown',resume);window.removeEventListener('keydown',resume)};
 },[]);

 useEffect(()=>{
  for(const soldier of soldiers.current)setTargetMaterial(soldier.model,quality==='Cinematic Max');
 },[quality]);

 useFrame((_,dt)=>{
  const now=performance.now(),step=Math.min(dt,.065);
  const bank=view.current;
  if(!ready.current)return;
  const choice=([null,'rifle','pistol','shotgun'] as const)[select.current]||'rifle';
  if(choice!==current.current){
   current.current=choice;equippedUntil.current=now+310;reloadUntil.current=0;
   recoil.current=0;
   report.current();
  }
  if(reloadCounter.current!==reload.current){
   reloadCounter.current=reload.current;
   const def=COMBAT_WEAPONS.find(w=>w.id===current.current)!;
   const magazine=counts.current[current.current];
   if(magazine.ammo<def.mag&&magazine.reserve>0&&reloadUntil.current<=now){
    reloadUntil.current=now+def.reloadMs;
    if(current.current==='rifle')playOnce(bank.clips.reload);
    report.current();
   }
  }
  if(reloadUntil.current>0&&now>=reloadUntil.current){
   const def=COMBAT_WEAPONS.find(w=>w.id===current.current)!;
   const magazine=counts.current[current.current];
   const count=Math.min(def.mag-magazine.ammo,magazine.reserve);
   magazine.ammo+=count;magazine.reserve-=count;reloadUntil.current=0;report.current();
  }
  if(fireCounter.current!==trigger.current){
   fireCounter.current=trigger.current;
   const def=COMBAT_WEAPONS.find(w=>w.id===current.current)!;
   const magazine=counts.current[current.current];
   if(now>=reloadUntil.current&&now>=equippedUntil.current&&magazine.ammo>0&&now-lastFire.current>=def.fireDelay){
    lastFire.current=now;
    magazine.ammo--;metrics.current.shots++;
    const ctx=audio.current;
    const buffer=audioClips.current.get(current.current);
    if(ctx&&ctx.state==='running'&&buffer){
     const source=ctx.createBufferSource();
     source.buffer=buffer;
     source.playbackRate.value=.97+Math.random()*.06;
     const gain=ctx.createGain();
     gain.gain.value=current.current==='shotgun'?.36:.26;
     source.connect(gain).connect(ctx.destination);
     source.start();
    }
    recoil.current=current.current==='shotgun'?.27:.13;
    muzzleUntil.current=now+55;
    if(current.current==='rifle')playOnce(bank.clips.fire);
    camera.getWorldPosition(rayOrigin.current);
    camera.getWorldDirection(rayDirection.current);
    worldRay.current.set(rayOrigin.current,rayDirection.current);
    worldRay.current.far=100;
    const objects=soldiers.current.filter(t=>t.alive).flatMap(t=>t.meshes);
    const hit=worldRay.current.intersectObjects(objects,false)[0];
    if(hit&&Number.isInteger(hit.object.userData.combatTarget)){
     const target=soldiers.current[Number(hit.object.userData.combatTarget)];
     if(target&&target.alive){
      metrics.current.hits++;target.hit=1;
      target.health=Math.max(0,target.health-def.damage);
      if(target.health===0){target.alive=false;metrics.current.eliminations++}
     }
    }
    report.current();
   }
  }
  // Clip driven idle/fire/reload for the licensed AK rig, procedural sway/recoil for all models.
  bank.mixer?.update(step);
  const moving=Math.min(1,camera.position.distanceTo(cameraBefore.current)/Math.max(step,.008)/3);
  cameraBefore.current.copy(camera.position);
  sway.current+=step*(moving>.05?9:2.5);
  recoil.current=Math.max(0,recoil.current-step*1.4);
  const active=current.current;
  bank.root.visible=bank.guns.has(active);
  for(const [id,obj] of bank.guns)obj.visible=id===active;
  if(bank.arms)bank.arms.visible=active!=='rifle';
  const ads=aim.current?1:0;
  const extra=active==='shotgun'?.05:0;
  const targetX=ads?.055:.235,targetY=ads?-.19:-.26;
  bank.root.position.x=THREE.MathUtils.lerp(bank.root.position.x,targetX,Math.min(1,step*11));
  bank.root.position.y=THREE.MathUtils.lerp(bank.root.position.y,targetY+Math.sin(sway.current)*moving*.01-recoil.current*.12,Math.min(1,step*18));
  bank.root.position.z=-.55+extra+recoil.current*.23;
  bank.root.rotation.x=-recoil.current*.3+(ads?-.025:0);
  bank.root.rotation.z=Math.sin(sway.current*.5)*moving*.009+recoil.current*.05;
  bank.flash.intensity=now<muzzleUntil.current?3.2:0;
  const perspective=camera as THREE.PerspectiveCamera;
  const newFov=ads?59:viewport.current.fov;
  if(Math.abs(perspective.fov-newFov)>.07){
   perspective.fov=THREE.MathUtils.lerp(perspective.fov,newFov,Math.min(1,step*11));
   perspective.updateProjectionMatrix();
  }
  for(const npc of soldiers.current){
   npc.mixer.update(step);
   npc.hit=Math.max(0,npc.hit-step*4);
   if(npc.alive){
    aimAtPlayer(npc.root,camera.position,step);
    npc.model.rotation.x=npc.hit?npc.hit*.12:0;
   }else{
    npc.fall=Math.min(1,npc.fall+step*1.35);
    const blend=npc.fall*npc.fall*(3-2*npc.fall);
    npc.root.rotation.z=-blend*1.34;
    npc.root.position.y=npc.base.y-blend*.12;
   }
  }
 });
 return null;
}
