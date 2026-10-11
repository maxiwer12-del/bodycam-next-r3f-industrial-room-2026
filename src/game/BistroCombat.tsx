'use client';
import * as THREE from 'three';
import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {BistroRigAnimator} from './BistroRigAnimator';
import type {MotionTelemetry} from './BistroMovement';
import {AK_VIEWMODEL_POSES,interpolateViewmodel} from './BistroViewmodelProfile';

export type WeaponId='rifle';
export type CombatPulse={
 shots:number;hits:number;eliminations:number;ammo:number;reserve:number;
 reload:boolean;weapon:WeaponId;ready:boolean;targets:number;aiming:boolean;
};
type WeaponDefinition={
 id:WeaponId;label:string;mag:number;reserve:number;damage:number;
 fireDelay:number;reloadMs:number;model:string;length:number;
};
export const COMBAT_WEAPONS:readonly WeaponDefinition[]=[
 {id:'rifle',label:'AK-74M',mag:30,reserve:120,damage:34,fireDelay:115,reloadMs:2050,model:'/combat/ak74/scene.gltf',length:1.70}
];
type GunState={ammo:number;reserve:number};
type Avatar={
 root:THREE.Group;model:THREE.Object3D;mixer:THREE.AnimationMixer;
 meshes:THREE.Mesh[];health:number;hit:number;fall:number;alive:boolean;
 base:THREE.Vector3;
};
type ViewBank={
 root:THREE.Group;rifle:THREE.Object3D|null;guns:Map<WeaponId,THREE.Object3D>;
 mixer:THREE.AnimationMixer|null;animator:BistroRigAnimator|null;
 rifleMeshes:THREE.Mesh[];extraMagazine:THREE.Object3D|null;rightHand:THREE.Object3D|null;leftHand:THREE.Object3D|null;
 flash:THREE.PointLight;loaded:boolean;
};
const SPAWNS:readonly [number,number,number][]=[[-8,.35,-7.3],[-10,.35,-11.2],[-4,.35,-12.5]];
const emptyView=():ViewBank=>({
 root:new THREE.Group(),rifle:null,guns:new Map(),mixer:null,animator:null,rifleMeshes:[],extraMagazine:null,rightHand:null,leftHand:null,
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
     mat.roughness=Math.max(mat.roughness,/bot_cloth/i.test(mat.name)?0.72:0.38);
     if(/bot_cloth/i.test(mat.name))mat.metalness=0;
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
 * Keep both original gloved hands synchronized with the animated AK-74M.
 */
export function BistroCombat({trigger,reload,aim,onStatus,quality,mapReady,movement}:{
 trigger:React.RefObject<number>;reload:React.RefObject<number>;
 aim:React.RefObject<boolean>;
 onStatus:(value:CombatPulse)=>void;quality:'High'|'Cinematic Max';mapReady:React.RefObject<boolean>;
 movement:React.RefObject<MotionTelemetry>;
}){
 const {camera,scene}=useThree();
 const view=useRef<ViewBank>(emptyView());
 const soldiers=useRef<Avatar[]>([]);
 const current=useRef<WeaponId>('rifle');
 const counts=useRef<Record<WeaponId,GunState>>({rifle:{ammo:30,reserve:120}});
 const metrics=useRef({shots:0,hits:0,eliminations:0});
 const lastFire=useRef(0),fireCounter=useRef(0),reloadCounter=useRef(0);
 const reloadUntil=useRef(0);
 const recoil=useRef(0),sway=useRef(0),muzzleUntil=useRef(0);
 const lastAuthoredShot=useRef(0),reloadStarted=useRef(0);
 const adsAmount=useRef(0);
 const targetViewQuaternion=useRef(new THREE.Quaternion());
 const targetViewEuler=useRef(new THREE.Euler(0,0,0,'XYZ'));
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
   ready:ready.current&&view.current.guns.has(current.current),targets:soldiers.current.filter(t=>t.alive).length,aiming:aim.current});
 };
 report.current=notify;

 useEffect(()=>{
  let disposed=false;
  const bank=emptyView();view.current=bank;
  bank.root.position.set(AK_VIEWMODEL_POSES.hip.x,AK_VIEWMODEL_POSES.hip.y,AK_VIEWMODEL_POSES.hip.z);
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
   // The three authored masked/armoured variants have their own original skinned
   // GLBs and embedded locomotion; never generate an opponent out of primitives.
   const viewOnly=window.location.pathname==='/dev/combat';
   const [operatives,akGltf]=await Promise.all([
    viewOnly?Promise.resolve([]):Promise.all([
     loader.loadAsync('/combat/operatives/mask.glb'),
     loader.loadAsync('/combat/operatives/wrap_goggles.glb'),
     loader.loadAsync('/combat/operatives/mask_cap.glb')
    ]),
    loader.loadAsync('/combat/ak74/scene.gltf')
   ]);
   if(disposed)return;
   loadedModels.current=['soldier','operatives','rifle'];
   // Full-body humanoids use the original skinned geometry and embedded Idle/Walk/Run clips.
   if(!viewOnly)SPAWNS.forEach((position,id)=>{
    const soldierGltf=operatives[id%operatives.length];
    const model=cloneSkinned(soldierGltf.scene);
    model.updateMatrixWorld(true);
    const skinnedMeshes:THREE.SkinnedMesh[]=[];
    const rawBounds=new THREE.Box3();
    model.traverse(node=>{
     if(!(node instanceof THREE.Mesh))return;
     if(node instanceof THREE.SkinnedMesh)skinnedMeshes.push(node);
     const geometry=node.geometry as THREE.BufferGeometry;
     if(!geometry.boundingBox)geometry.computeBoundingBox();
     if(geometry.boundingBox){
      // Authored bind-pose vertices are reliable even when animated skin
      // bounds have not been evaluated on the first rendered frame.
      rawBounds.union(geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
     }
    });
    const animatedBounds=new THREE.Box3().setFromObject(model);
    const rawHeight=rawBounds.isEmpty()?0:rawBounds.getSize(new THREE.Vector3()).y;
    const posedHeight=animatedBounds.isEmpty()?0:animatedBounds.getSize(new THREE.Vector3()).y;
    const height=Math.max(rawHeight,posedHeight);
    if(id===0)console.info('COMBAT_SOLDIER_SOURCE_BOUNDS',JSON.stringify({
     rawHeight,posedHeight,skinnedMeshes:skinnedMeshes.length,
     meshes:uniqueMeshes(model).length,animations:soldierGltf.animations.map(clip=>clip.name)
    }));
    // The glTF original is authored in sub-meter units, therefore an arbitrary
    // 0.1m minimum rejects a valid skinned character. Scale to human height.
    if(!Number.isFinite(height)||height<.00001||skinnedMeshes.length===0)
      throw Error('Soldier asset has no valid skinned geometry');
    model.scale.multiplyScalar(1.8/height);
    model.updateMatrixWorld(true);
    const normalized=new THREE.Box3().setFromObject(model);
    const grounded=normalized.isEmpty()?
      rawBounds.clone().applyMatrix4(new THREE.Matrix4().makeScale(1.8/height,1.8/height,1.8/height)):
      normalized;
    model.position.y-=grounded.min.y;
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
   fittedAk.frame.rotation.set(
    AK_VIEWMODEL_POSES.hip.pitch,AK_VIEWMODEL_POSES.hip.yaw,AK_VIEWMODEL_POSES.hip.roll
   );
   fittedAk.frame.scale.multiplyScalar(AK_VIEWMODEL_POSES.hip.scale);
   fittedAk.frame.userData.baseScale=fittedAk.frame.scale.x/AK_VIEWMODEL_POSES.hip.scale;
   bank.rifle=fittedAk.frame;
   bank.guns.set('rifle',fittedAk.frame);
   bank.root.add(fittedAk.frame);
   setTargetMaterial(ak,false);
   bank.rightHand=ak.getObjectByName('Hand_R_037')||null;
   ak.traverse(node=>{if(!bank.leftHand&&/^Hand_L[_\.]/i.test(node.name))bank.leftHand=node;});
    // Spare Mag_2 must only show while the authored reload actually swaps magazines.
   bank.rifleMeshes=['Object_97'].map(name=>ak.getObjectByName(name))
     .filter((node):node is THREE.Mesh=>node instanceof THREE.Mesh);
   bank.extraMagazine=ak.getObjectByName('Object_99')||null;
   if(bank.extraMagazine)bank.extraMagazine.visible=false;
   if(bank.rifleMeshes.length!==1||!bank.rightHand)throw Error('Licensed AK rig is missing weapon meshes/hand socket');
   const mixer=new THREE.AnimationMixer(ak);
   bank.mixer=mixer;
   bank.animator=new BistroRigAnimator(mixer,akGltf.animations);
   loadedClips.current=akGltf.animations.map(c=>c.name);
   console.info('COMBAT_AK74_CLIPS',JSON.stringify(loadedClips.current));
   // Only the AK-74M viewmodel is loaded. Both arms are driven by the same skinned rig.
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
   // Shift is reserved for sprint; right mouse/mobile ADS controls aim.
  };
  const up=(_e:KeyboardEvent)=>{};
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
     weapon:current.current,ammo:counts.current[current.current].ammo,
     cameraRig:bank.root.position.toArray(),rigScale:bank.rifle?.scale.toArray(),
     rigRotation:bank.rifle?.rotation.toArray(),rigQuaternion:bank.rifle?.quaternion.toArray(),aimNow:aim.current,adsAlpha:adsAmount.current,
     handPos:(()=>{if(!bank.rightHand)return null;const v=new THREE.Vector3();bank.rightHand.getWorldPosition(v);return bank.root.worldToLocal(v).toArray()})(),
      leftHandPos:(()=>{if(!bank.leftHand)return null;const v=new THREE.Vector3();bank.leftHand.getWorldPosition(v);return bank.root.worldToLocal(v).toArray()})(),
     // QA-only: the source GLTF muzzle (+Z) must be farther from the camera than the stock (-Z).
     barrel:(()=>{
      const mesh=bank.rifleMeshes[0];
      if(!(mesh instanceof THREE.SkinnedMesh))return null;
      const attr=mesh.geometry.getAttribute('position') as THREE.BufferAttribute|undefined;
      if(!attr)return null;
      let minZ=Infinity,maxZ=-Infinity;
      for(let i=0;i<attr.count;i++){const z=attr.getZ(i);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z)}
      const threshold=(maxZ-minZ)*.03;
      const muzzle=new THREE.Vector3(),stock=new THREE.Vector3(),v=new THREE.Vector3();
      let countM=0,countS=0;
      camera.updateWorldMatrix(true,false);mesh.updateWorldMatrix(true,false);
      for(let i=0;i<attr.count;i++){
       const z=attr.getZ(i),front=z>maxZ-threshold,back=z<minZ+threshold;
       if(!front&&!back)continue;
       v.fromBufferAttribute(attr,i);
       mesh.applyBoneTransform(i,v);
       mesh.localToWorld(v);camera.worldToLocal(v);
       if(front){muzzle.add(v);countM++}else{stock.add(v);countS++}
      }
      if(!countM||!countS)return null;
      muzzle.divideScalar(countM);stock.divideScalar(countS);
      return {muzzle:muzzle.toArray(),stock:stock.toArray(),pointsAway:muzzle.z<stock.z};
     })(),
     gun:(()=>{const obj=bank.guns.get(current.current);if(!obj)return null;const box=new THREE.Box3().setFromObject(obj);const v=box.getCenter(new THREE.Vector3());return {visible:obj.visible,center:camera.worldToLocal(v).toArray(),size:box.getSize(new THREE.Vector3()).toArray(),local:obj.position.toArray(),rotation:obj.rotation.toArray()}})()
     }),
    fire:()=>trigger.current++,reload:()=>reload.current++
   };
  }
  return()=>{
   disposed=true;ready.current=false;
   clearInterval(heartbeat);
   window.removeEventListener('keydown',keyboard);window.removeEventListener('keyup',up);
   window.removeEventListener('mousedown',rightDown);window.removeEventListener('mouseup',rightUp);
   bank.animator?.dispose();
   bank.root.remove(bank.flash);camera.remove(bank.root);scene.remove(enemyLayer);
   if(!originalParent&&camera.parent===scene)scene.remove(camera);
   soldiers.current=[];bank.guns.clear();
   if((window as typeof window & {__COMBAT_QA__?:unknown}).__COMBAT_QA__)delete (window as typeof window & {__COMBAT_QA__?:unknown}).__COMBAT_QA__;
   void audio.current?.close();audio.current=null;
  };
 },[camera,scene,reload,trigger,aim,onStatus,mapReady]);

 useEffect(()=>{
  let cancelled=false,requested=false;
  const resume=()=>{
   if(!audio.current){
    try{audio.current=new AudioContext()}catch{return}
   }
   void audio.current.resume().catch(()=>{});
   if(requested)return;requested=true;
   const ctx=audio.current;
   for(const name of ['rifle'] as const){
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
  if(reloadCounter.current!==reload.current){
   reloadCounter.current=reload.current;
   const def=COMBAT_WEAPONS.find(w=>w.id===current.current)!;
   const magazine=counts.current[current.current];
   if(magazine.ammo<def.mag&&magazine.reserve>0&&reloadUntil.current<=now){
    reloadUntil.current=now+def.reloadMs;reloadStarted.current=now;
    bank.animator?.trigger('reload',def.reloadMs/1000);
    
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
   if(now>=reloadUntil.current&&magazine.ammo>0&&now-lastFire.current>=def.fireDelay){
    lastFire.current=now;
    magazine.ammo--;metrics.current.shots++;
    const ctx=audio.current;
    const buffer=audioClips.current.get(current.current);
    if(ctx&&ctx.state==='running'&&buffer){
     const source=ctx.createBufferSource();
     source.buffer=buffer;
     source.playbackRate.value=.97+Math.random()*.06;
     const gain=ctx.createGain();
     gain.gain.value=.26;
     source.connect(gain).connect(ctx.destination);
     source.start();
    }
    recoil.current=.105;
    muzzleUntil.current=now+55;
    if(now-lastAuthoredShot.current>190){
     lastAuthoredShot.current=now;
     bank.animator?.trigger('shot',.23);
    }
    
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
  // Horizontal velocity is supplied by the movement controller, not measured
  // from camera displacement (which included floor snapping and jump height).
  const motion=movement.current;
  const speed=motion.speed;
  const moving=THREE.MathUtils.clamp(speed/4.75,0,1);
  bank.animator?.update(step,speed);
  
  const distance=motion.grounded?speed*step:0;
  sway.current+=distance*3.5;
  recoil.current=THREE.MathUtils.damp(recoil.current,0,17,step);
  bank.root.visible=bank.loaded;
  bank.rifle!.visible=true;
  for(const mesh of bank.rifleMeshes)mesh.visible=true;
  if(bank.extraMagazine)bank.extraMagazine.visible=
   reloadUntil.current>now&&now-reloadStarted.current>600&&
   now-reloadStarted.current<1700;
  // Stable, larger and higher BODYCAM weapon placement. Idle is the only
  // locomotion clip; procedural feedback is deliberately sub-centimetre.
  const airborne=!motion.grounded;
  adsAmount.current=THREE.MathUtils.damp(adsAmount.current,
   aim.current&&!motion.sprinting?1:0,13,step);
  const ads=adsAmount.current;
  const riflePose=interpolateViewmodel(AK_VIEWMODEL_POSES.hip,AK_VIEWMODEL_POSES.ads,ads);
  const targetQuaternion=targetViewQuaternion.current.setFromEuler(
   targetViewEuler.current.set(riflePose.pitch,riflePose.yaw,riflePose.roll,'XYZ')
  );
  bank.rifle!.quaternion.slerp(targetQuaternion,1-Math.exp(-13*step));
  const baseScale=bank.rifle!.userData.baseScale as number;
  const nextScale=THREE.MathUtils.damp(bank.rifle!.scale.x,baseScale*riflePose.scale,13,step);
  bank.rifle!.scale.setScalar(nextScale);
  const gait=airborne?0:moving*(1-ads)*.003;
  const bob=Math.sin(sway.current)*gait;
  const drift=Math.sin(sway.current*.5)*gait*.45;
  const {x,y,z}=riflePose;
  bank.root.position.x=THREE.MathUtils.damp(bank.root.position.x,x+drift,12,step);
  bank.root.position.y=THREE.MathUtils.damp(bank.root.position.y,y+bob-recoil.current*.06,12,step);
  bank.root.position.z=THREE.MathUtils.damp(bank.root.position.z,z+recoil.current*.085,13,step);
  bank.root.rotation.x=THREE.MathUtils.damp(bank.root.rotation.x,-recoil.current*.08-ads*.012,13,step);
  bank.root.rotation.z=THREE.MathUtils.damp(bank.root.rotation.z,
   drift*.35+recoil.current*.012,12,step);
  bank.flash.intensity=now<muzzleUntil.current?3.2:0;
  const perspective=camera as THREE.PerspectiveCamera;
  const newFov=THREE.MathUtils.lerp(viewport.current.fov,59,ads);
  if(Math.abs(perspective.fov-newFov)>.07){
   perspective.fov=THREE.MathUtils.damp(perspective.fov,newFov,12,step);
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
