'use client';
import {useCallback,useRef,useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {BistroCombat, type CombatPulse} from '../../../game/BistroCombat';
import type {MotionTelemetry} from '../../../game/BistroMovement';
export default function CombatPreview(){
 const fire=useRef(0),reload=useRef(0),aim=useRef(false),mapReady=useRef(true);
 const [status,setStatus]=useState<CombatPulse>({shots:0,hits:0,eliminations:0,ammo:30,reserve:120,reload:false,weapon:'rifle',ready:false,targets:0,aiming:false});
 const movement=useRef<MotionTelemetry>({speed:0,sprinting:false,grounded:true,chain:0,jumps:0,airTime:0,verticalSpeed:0,groundedTime:0});
 const cb=useCallback((data:CombatPulse)=>setStatus(data),[]);
 return <main style={{height:'100dvh',background:'#acbcc8',position:'relative'}}>
 <Canvas gl={{antialias:true}} camera={{position:[0,1.6,3.4],fov:76,near:.015,far:100}}>
   <color attach="background" args={['#93a8be']}/>
   <hemisphereLight args={['#f6f7fc','#2e3340',1.3]}/>
   <directionalLight position={[4,8,6]} intensity={2.1}/>
   <BistroCombat trigger={fire} reload={reload} aim={aim} mapReady={mapReady} movement={movement} onStatus={cb} quality="High"/>
 </Canvas>
 <div style={{position:'absolute',top:10,left:10,color:'white',fontSize:12,background:'#1119',padding:8}}>
   Viewmodel QA (rendered assets, not city) · {status.weapon} · {status.ready?'ready':'loading'} · {status.ammo} ammo
 </div>
 <div style={{position:'absolute',top:45,left:10,display:'flex',gap:8}}>
  <span>AK-74M</span>
  <button onClick={()=>fire.current++}>FIRE</button>
  <button onClick={()=>reload.current++}>RELOAD</button>
  <button onPointerDown={()=>aim.current=true} onPointerUp={()=>aim.current=false} onPointerCancel={()=>aim.current=false}>ADS hold</button>
 </div>
 <div style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',color:'#fff'}}>+</div>
 </main>
}
