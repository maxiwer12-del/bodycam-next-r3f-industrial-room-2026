'use client';
import * as THREE from 'three';
import {useEffect,useRef,useState} from 'react';
import {useFrame,useThree} from '@react-three/fiber';

export type CombatPulse={shots:number;hits:number;eliminations:number;ammo:number;reserve:number;reload:boolean};
type TargetState={health:number;fall:number;hit:number};
const targetSpots:[number,number,number][]=[[-8,.35,-7.3],[-10,.35,-11.2],[-4,.35,-12.5]];
export function BistroCombat({trigger,reload,onStatus}:{trigger:React.RefObject<number>;reload:React.RefObject<number>;onStatus:(value:CombatPulse)=>void}){
 const {camera,scene}=useThree(),view=useRef<THREE.Group>(null);
 const [targets,setTargets]=useState<TargetState[]>(targetSpots.map(()=>({health:100,fall:0,hit:0})));
 const current=useRef(targets);current.current=targets;
 const ammo=useRef(12),reserve=useRef(60),shots=useRef(0),hits=useRef(0),eliminations=useRef(0);
 const lastTrigger=useRef(0),lastReload=useRef(0),lastFire=useRef(0),reloadUntil=useRef(0),recoil=useRef(0);
 const ray=new THREE.Raycaster(),origin=new THREE.Vector3(),forward=new THREE.Vector3();
 const sync=()=>onStatus({shots:shots.current,hits:hits.current,eliminations:eliminations.current,ammo:ammo.current,reserve:reserve.current,reload:reloadUntil.current>performance.now()});
 useEffect(()=>{const id=window.setInterval(sync,300);return()=>window.clearInterval(id)},[]);
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{if(e.code==='KeyR'){reload.current++}};
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[reload]);
 useFrame((_,dt)=>{
  const now=performance.now();
  if(lastReload.current!==reload.current){lastReload.current=reload.current;if(ammo.current<12&&reserve.current>0&&reloadUntil.current<=now)reloadUntil.current=now+1250;}
  if(reloadUntil.current&&now>=reloadUntil.current){const count=Math.min(12-ammo.current,reserve.current);ammo.current+=count;reserve.current-=count;reloadUntil.current=0;sync()}
  if(lastTrigger.current!==trigger.current){
   lastTrigger.current=trigger.current;
   if(ammo.current>0&&reloadUntil.current<=now&&now-lastFire.current>=160){
    lastFire.current=now;ammo.current--;shots.current++;recoil.current=.16;
    camera.getWorldPosition(origin);camera.getWorldDirection(forward);ray.set(origin,forward);
    // Gameplay targets are explicit meshes; the architectural map is not destructible.
    const mannequins:THREE.Object3D[]=[];
    scene.traverse(o=>{if(o.userData.trainingTarget!==undefined&&o instanceof THREE.Mesh)mannequins.push(o)});
    const hit=ray.intersectObjects(mannequins,false)[0];
    if(hit&&hit.distance<85){const index=Number(hit.object.userData.trainingTarget);const t=current.current[index];
     if(t&&t.health>0){hits.current++;const newHealth=Math.max(0,t.health-45);if(!newHealth)eliminations.current++;
      setTargets(old=>old.map((v,i)=>i===index?{...v,health:newHealth,hit:1}:v));}}
    sync();
   }
  }
  recoil.current=Math.max(0,recoil.current-dt*.85);
  if(view.current){const v=view.current;v.position.set(.26-recoil.current*.14,-.26-recoil.current*.11,-.46+recoil.current*.14);
   v.rotation.x=-recoil.current*.6;}
  setTargets(previous=>{
   if(!previous.some(t=>t.hit>.01||(t.health===0&&t.fall<1)))return previous;
   return previous.map(t=>({...t,hit:Math.max(0,t.hit-dt*3),fall:t.health===0?Math.min(1,t.fall+dt*1.6):0}));
  });
 });
 const glove=new THREE.MeshStandardMaterial({color:0x323c3d,roughness:.83});
 const sleeve=new THREE.MeshStandardMaterial({color:0x343b34,roughness:.98});
 const gun=new THREE.MeshStandardMaterial({color:0x252728,metalness:.72,roughness:.38});
 return <>
 <group ref={view} position={[.26,-.26,-.46]} onUpdate={group=>{if(group.parent!==camera){camera.add(group);group.updateMatrixWorld()}}}>
  <mesh material={gun} position={[0,.02,-.21]}><boxGeometry args={[.115,.135,.4]}/></mesh>
  <mesh material={gun} position={[0,.117,-.24]}><boxGeometry args={[.065,.045,.22]}/></mesh>
  <mesh material={gun} position={[0,-.105,-.065]} rotation={[.28,0,0]}><boxGeometry args={[.083,.23,.1]}/></mesh>
  <mesh material={glove} position={[-.13,-.18,.07]} rotation={[0,0,.25]}><capsuleGeometry args={[.065,.17,5,8]}/></mesh>
  <mesh material={sleeve} position={[-.23,-.3,.22]} rotation={[0,0,-.3]}><capsuleGeometry args={[.11,.2,5,8]}/></mesh>
  <mesh material={glove} position={[.075,-.205,.1]} rotation={[0,0,-.2]}><capsuleGeometry args={[.065,.2,5,8]}/></mesh>
  <mesh material={sleeve} position={[.18,-.37,.28]} rotation={[0,0,.34]}><capsuleGeometry args={[.115,.23,5,8]}/></mesh>
 </group>
 {targets.map((t,i)=><group key={i} position={targetSpots[i]} rotation={[0,0,-t.fall*1.45]}>
  <mesh userData={{trainingTarget:i}} material={new THREE.MeshStandardMaterial({color:t.hit>0?0xa44d3a:0x5d655a,roughness:.9})} position={[0,1.04,0]}>
   <capsuleGeometry args={[.29,.78,6,10]}/>
  </mesh>
  <mesh userData={{trainingTarget:i}} position={[0,1.78,0]}>
   <sphereGeometry args={[.19,10,8]}/><meshStandardMaterial color={t.hit>0?'#cf967b':'#a39e90'}/>
  </mesh>
  <mesh position={[-.15,.35,0]}><capsuleGeometry args={[.11,.45,5,8]}/><meshStandardMaterial color="#4d534a"/></mesh>
  <mesh position={[.15,.35,0]}><capsuleGeometry args={[.11,.45,5,8]}/><meshStandardMaterial color="#4d534a"/></mesh>
 </group>)}
 </>;
}
