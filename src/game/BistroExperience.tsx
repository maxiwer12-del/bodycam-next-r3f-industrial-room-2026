'use client';
import {Canvas,useThree,useFrame} from '@react-three/fiber';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';
import {BistroSpatialStream} from './BistroSpatialStream';
import {BistroCloudSky} from './BistroCloudSky';
import {calibrateBistroMaterial} from './BistroMaterialCalibration';
import {carveBistroEntrance} from './BistroDoorway';
import {BistroCombat,type CombatPulse,COMBAT_WEAPONS} from './BistroCombat';
import {BistroMovement,EYE_HEIGHT,type MotionTelemetry} from './BistroMovement';
import {useState,useEffect,useRef,useCallback} from 'react';
import * as THREE from 'three';

type Quality='High'|'Cinematic Max';
type Axis={x:number;y:number};
type Metrics={fps:number;calls:number;triangles:number;gpu:'WebGL2'|'WebGL1';meshes:number};
type Collider={mesh:THREE.Mesh;box:THREE.Box3;solid:boolean};
const START=new THREE.Vector3(-9,2.08,6);
const PLAYER_HEIGHT=EYE_HEIGHT;
const PLAYER_RADIUS=.3;

function FPSWorld({stick,look,quality,onStatus,onReady,onError,onMetric,loadedRef,fire,reload,select,aim,run,jump,onCombat,onMotion}:{
 stick:React.RefObject<Axis>;look:React.RefObject<Axis>;quality:Quality;
 onStatus:(s:string)=>void;onReady:()=>void;onError:(s:string)=>void;onMetric:(m:Metrics)=>void;
 loadedRef:React.RefObject<boolean>;
 fire:React.RefObject<number>;reload:React.RefObject<number>;select:React.RefObject<number>;aim:React.RefObject<boolean>;
 run:React.RefObject<boolean>;jump:React.RefObject<number>;
 onCombat:(value:CombatPulse)=>void;onMotion:(value:MotionTelemetry)=>void;
}){
 const {camera,gl,scene}=useThree();
 const qualityRef=useRef(quality);
 qualityRef.current=quality;
 useEffect(()=>{gl.setPixelRatio(quality==='Cinematic Max'?Math.min(window.devicePixelRatio,2.75):Math.min(window.devicePixelRatio,1.25));gl.shadowMap.enabled=quality==='Cinematic Max';gl.shadowMap.needsUpdate=true;scene.traverse(n=>{if(n instanceof THREE.Mesh){if(n.userData.isAtmosphere){n.castShadow=false;n.receiveShadow=false;return;}n.castShadow=quality==='Cinematic Max'&&!/glass|foliage|leaf|transparent/i.test((Array.isArray(n.material)?n.material[0]:n.material)?.name||'')}})},[quality,gl,scene]);
 const world=useRef<THREE.Group|null>(null);
 const streamed=useRef<BistroSpatialStream|null>(null);
 const streamedPhysics=useRef(new Map<string,Collider[]>());
 const colliders=useRef<Collider[]>([]);
 const rotation=useRef({yaw:0,pitch:0});
 const keys=useRef(new Set<string>());
 const stats=useRef({frames:0,elapsed:0});
 const ready=useRef(false);
 const lastReport=useRef<Metrics>({fps:0,calls:0,triangles:0,gpu:gl.capabilities.isWebGL2?'WebGL2':'WebGL1',meshes:0});
 const forward=useRef(new THREE.Vector3()),right=useRef(new THREE.Vector3());
 const motor=useRef(new BistroMovement());
 const motion=useRef<MotionTelemetry>(motor.current.snapshot());
 const handledJump=useRef(0),motionElapsed=useRef(0);
 const queryBox=useRef(new THREE.Box3());
 const tempRay=useRef(new THREE.Raycaster());
 const candidate=useRef(new THREE.Vector3());
 const spin=useRef(new THREE.Euler(0,0,0,'YXZ'));
 const rootTexture=useRef<THREE.DataTexture|null>(null);

 useEffect(()=>{
   function keydown(e:KeyboardEvent){
    const codes=['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight'];
    if(!codes.includes(e.code))return;
    const el=e.target;
    if(el instanceof HTMLElement&&el.closest('input,textarea,select,[contenteditable="true"]'))return;
    // Ignore keyboard autorepeat. A hop requires a release + another distinct press.
    if(e.code==='Space'&&!e.repeat&&!keys.current.has('Space'))jump.current++;
    keys.current.add(e.code);e.preventDefault();
   }
  function keyup(e:KeyboardEvent){keys.current.delete(e.code);}
   function blur(){keys.current.clear();run.current=false;stick.current.x=0;stick.current.y=0;look.current.x=0;look.current.y=0;}
  function pointer(e:MouseEvent){if(document.pointerLockElement===gl.domElement){look.current.x+=e.movementX;look.current.y+=e.movementY;}}
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);window.addEventListener('mousemove',pointer);
  gl.domElement.addEventListener('click',()=>{if(!('ontouchstart'in window))gl.domElement.requestPointerLock?.().catch(()=>{});});
  camera.position.copy(START);camera.rotation.order='YXZ';camera.rotation.set(0,0,0);motor.current.reset();handledJump.current=jump.current;
  return()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);window.removeEventListener('mousemove',pointer)}
 },[camera,gl,stick,look]);

 useEffect(()=>{
  let disposed=false;
  const transcoder=new KTX2Loader().setTranscoderPath('/basis/').setWorkerLimit(2);
  transcoder.detectSupport(gl);
  const renderer=new GLTFLoader().setKTX2Loader(transcoder);
  const physicsForChunk=(id:string,group:THREE.Group,register:boolean)=>{
    const previous=streamedPhysics.current.get(id);
    if(previous){
      const old=new Set(previous);
      colliders.current=colliders.current.filter(c=>!old.has(c));
      streamedPhysics.current.delete(id);
    }
    if(!register)return;
    const created:Collider[]=[];
    group.updateMatrixWorld(true);
    group.traverse(node=>{
      if(!(node instanceof THREE.Mesh))return;
      const mat=Array.isArray(node.material)?node.material[0]:node.material;
      const name=(mat?.name||'').toLowerCase();
      if(/foliage|leaf|flower|glass|decals|smoke|water|roadmark|shadow|paper|signage/.test(name))return;
      const box=new THREE.Box3().setFromObject(node);
      if(box.isEmpty()||box.getSize(new THREE.Vector3()).lengthSq()<.001)return;
      const proxy=new THREE.Mesh(node.geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
      proxy.matrixAutoUpdate=false;proxy.matrix.copy(node.matrixWorld);proxy.matrixWorld.copy(node.matrixWorld);
      proxy.raycast=acceleratedRaycast;
      const geo=node.geometry as THREE.BufferGeometry&{boundsTree?:MeshBVH};
      if(!geo.boundsTree)try{geo.boundsTree=new MeshBVH(geo,{maxLeafTris:24});}catch(err){console.warn('SPATIAL_BVH_FAILED',id,err);return}
      created.push({mesh:proxy,box,solid:true});
    });
    streamedPhysics.current.set(id,created);
    colliders.current.push(...created);
  };
  const city=new BistroSpatialStream({loader:renderer,scene,quality,onPhysics:physicsForChunk});
  streamed.current=city;
  void city.init();
  const hdr=new HDRLoader();
  hdr.load('/maps/bistro-zone/san_giuseppe_1k.hdr',(env)=>{
   if(disposed){env.dispose();return}
   rootTexture.current=env;env.mapping=THREE.EquirectangularReflectionMapping;
   scene.environment=env;scene.environmentIntensity=.62;
   // The HDRI is for physically based lighting/reflections only.
   // A real camera-centered cloud atmosphere renders behind the city.
  },undefined,(error)=>console.warn('ENVIRONMENT_WARNING',error));
  onStatus('Загрузка городской карты · GLTF + KTX2...');
  const started=performance.now();
  renderer.load('/maps/bistro-zone/scene-merged.gltf',gltf=>{
   if(disposed)return;
   world.current=gltf.scene;scene.add(gltf.scene);
   gltf.scene.updateMatrixWorld(true);
   const doorway=carveBistroEntrance(gltf.scene);
   console.info('BISTRO_CORE_ENTRY_GEOMETRY',JSON.stringify(doorway));
   let count=0;
   const used=new Set<THREE.Material>();
   const region=new THREE.Box3(new THREE.Vector3(-125,-10,-125),new THREE.Vector3(125,60,125));
   const physics:Collider[]=[];
   gltf.scene.traverse(node=>{
    if(!(node instanceof THREE.Mesh))return;
    count++;
    const mat=Array.isArray(node.material)?node.material[0]:node.material;
    const name=mat?.name?.toLowerCase()||'';
    if(mat&&!used.has(mat)){
      used.add(mat);
      calibrateBistroMaterial(mat);
    }
    node.castShadow=quality==='Cinematic Max'&& !/glass|foliage|leaf|hedge|transparent/.test(name);
    node.receiveShadow=quality==='Cinematic Max';
    const bounds=new THREE.Box3().setFromObject(node);
    const solid=!/foliage|leaf|flower|glass|decals|smoke|water|roadmark|shadow|paper|signage/.test(name);
    if(bounds.intersectsBox(region)&&solid){
      const clone=new THREE.Mesh(node.geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
      clone.matrixAutoUpdate=false;
      clone.matrix.copy(node.matrixWorld);
      clone.matrixWorld.copy(node.matrixWorld);
      clone.raycast=acceleratedRaycast;
      // Reusing the geometry for collision prevents an invisible replacement primitive.
      const geometry=clone.geometry as THREE.BufferGeometry&{boundsTree?:MeshBVH};
      if(!geometry.boundsTree){try{geometry.boundsTree=new MeshBVH(geometry,{maxLeafTris:24});}catch(err){console.warn('BVH_FAILED',name,err)}}
      physics.push({mesh:clone,box:bounds,solid});
    }
   });
   colliders.current=physics;
   if(new URLSearchParams(window.location.search).has('qa')){
    (window as unknown as {__URBAN_QA__?:unknown}).__URBAN_QA__={
      camera:()=>camera.position.toArray(),
      heading:()=>({yaw:rotation.current.yaw,pitch:rotation.current.pitch}),
      movement:()=>motor.current.snapshot(),
      colliders:physics.length,meshCount:count,loadedAt:Date.now(),
      spatial:()=>streamed.current?.snapshot()||null,
      sky:()=>({cloudDome:!!scene.getObjectByName('BistroCloudSky'),environmentHDR:scene.environment instanceof THREE.Texture,backgroundIsHDR:scene.background instanceof THREE.Texture}),
      setCamera:(xyz:number[])=>{if(xyz.length===3&&xyz.every(Number.isFinite))camera.position.fromArray(xyz)},
      setView:(yaw:number,pitch=0)=>{if(Number.isFinite(yaw)&&Number.isFinite(pitch))rotation.current={yaw,pitch}},
    };
   }
   camera.position.copy(START);
   ready.current=true;loadedRef.current=true;
   lastReport.current.meshes=count;
   onStatus('');
   onReady();
   console.info('URBAN_REAL_SCENE_READY',JSON.stringify({meshes:count,colliders:physics.length,loadingMs:Math.round(performance.now()-started)}));
  },ev=>{
   if(ev.total)onStatus('Загрузка геометрии '+Math.floor(100*ev.loaded/ev.total)+'%');
  },err=>{onError(String(err));});
  return()=>{
   disposed=true;loadedRef.current=false;ready.current=false;
   streamed.current?.dispose();streamed.current=null;streamedPhysics.current.clear();
   if(world.current)scene.remove(world.current);
   if(scene.environment===rootTexture.current)scene.environment=null;
   rootTexture.current?.dispose();transcoder.dispose();
  };
 },[camera,gl,scene,onStatus,onReady,onError,loadedRef]);

 useFrame((_,dt)=>{
  if(!ready.current)return;
  const step=Math.min(dt,.055);
  streamed.current?.update(camera,step);
  const yaw=rotation.current;
  yaw.yaw-=look.current.x*.003; yaw.pitch=Math.max(-1.38,Math.min(1.38,yaw.pitch-look.current.y*.0028));
  look.current.x=0;look.current.y=0;
  spin.current.set(yaw.pitch,yaw.yaw,0,'YXZ');camera.quaternion.setFromEuler(spin.current);
  const k=keys.current;
  const x=THREE.MathUtils.clamp(stick.current.x+(k.has('KeyD')||k.has('ArrowRight')?1:0)-(k.has('KeyA')||k.has('ArrowLeft')?1:0),-1,1);
  const y=THREE.MathUtils.clamp(stick.current.y+(k.has('KeyW')||k.has('ArrowUp')?1:0)-(k.has('KeyS')||k.has('ArrowDown')?1:0),-1,1);
  const magnitude=Math.min(1,Math.hypot(x,y));
  const dir=forward.current.set(0,0,0);
  if(magnitude>.04){
   dir.set(Math.sin(yaw.yaw)*-y+Math.cos(yaw.yaw)*x,0,
    Math.cos(yaw.yaw)*-y-Math.sin(yaw.yaw)*x);
   dir.normalize().multiplyScalar(magnitude);
  }
  const pressed=handledJump.current!==jump.current;
  if(pressed)handledJump.current=jump.current;
  // Sprint replaces the old Shift-to-ADS binding. RMB/mobile ADS stays.
  const sprint=run.current||k.has('ShiftLeft')||k.has('ShiftRight');
  const position=camera.position;
  const terrain={
   clear:(px:number,pz:number,dx:number,dz:number)=>{
    const distance=Math.hypot(dx,dz);
    if(distance<.0001)return true;
    const rayDir=right.current.set(dx/distance,0,dz/distance);
    for(const height of [-1.35,-.45]){
     const origin=new THREE.Vector3(px,position.y+height,pz);
     const expanded=queryBox.current.setFromCenterAndSize(origin,new THREE.Vector3(.85,2,.85));
     tempRay.current.set(origin,rayDir);tempRay.current.near=0;tempRay.current.far=distance+PLAYER_RADIUS;
     for(const c of colliders.current){
      if(c.box.max.x<expanded.min.x-.4||c.box.min.x>expanded.max.x+.4||
         c.box.max.z<expanded.min.z-.4||c.box.min.z>expanded.max.z+.4)continue;
      const hit=tempRay.current.intersectObject(c.mesh,false)[0];
      if(!hit)continue;
      const normal=hit.face?.normal;
      if(normal&&Math.abs(normal.clone().transformDirection(c.mesh.matrixWorld).y)<.65)return false;
     }
    }
    return true;
   },
   floor:(px:number,pz:number,expectedFoot:number)=>{
    // Only the actual imported street / interior triangles count as support.
    const origin=new THREE.Vector3(px,Math.max(position.y+.6,expectedFoot+1.1),pz);
    tempRay.current.set(origin,new THREE.Vector3(0,-1,0));
    tempRay.current.near=0;tempRay.current.far=5.2;
    let footY:number|null=null;
    for(const c of colliders.current){
     if(px<c.box.min.x||px>c.box.max.x||pz<c.box.min.z||pz>c.box.max.z)continue;
     const hits=tempRay.current.intersectObject(c.mesh,false);
     for(const hit of hits){
      if(hit.point.y>expectedFoot+.48||hit.point.y<expectedFoot-3.6)continue;
      const normal=hit.face?.normal;
      if(!normal||Math.abs(normal.clone().transformDirection(c.mesh.matrixWorld).y)<.77)continue;
      if(footY===null||hit.point.y>footY)footY=hit.point.y;
     }
    }
    return footY;
   }
  };
  motion.current=motor.current.update(step,position,{
   wishX:dir.x,wishZ:dir.z,sprint,jumpPressed:pressed
  },terrain);
  motionElapsed.current+=dt;
  if(motionElapsed.current>.19){motionElapsed.current=0;onMotion({...motion.current});}
  stats.current.frames++;stats.current.elapsed+=dt;
  if(stats.current.elapsed>=1.5){
   const m={fps:stats.current.frames/stats.current.elapsed,calls:gl.info.render.calls,triangles:gl.info.render.triangles,gpu:gl.capabilities.isWebGL2?'WebGL2' as const:'WebGL1' as const,meshes:lastReport.current.meshes};
   lastReport.current=m;onMetric(m);stats.current={frames:0,elapsed:0};
  }
 });
 return <>
 <BistroCloudSky quality={quality}/>
 <BistroCombat trigger={fire} reload={reload} select={select} aim={aim} quality={quality} mapReady={loadedRef} movement={motion} onStatus={onCombat}/>
 <hemisphereLight intensity={.65} color="#f0f3ff" groundColor="#b0a19a"/>
 <directionalLight position={[14,30,-10]} intensity={1.65} color="#fff5e9"
 castShadow={quality==='Cinematic Max'}
 shadow-camera-left={-18} shadow-camera-right={18} shadow-camera-top={18} shadow-camera-bottom={-18}
 shadow-camera-near={.8} shadow-camera-far={95} shadow-mapSize={[1536,1536]} shadow-bias={-.0001}/>
 </>;
}

function JoyStick({value}:{value:React.RefObject<Axis>}){
 const active=useRef<number|null>(null),origin=useRef({x:0,y:0}),[dot,setDot]=useState({x:0,y:0});
 const move=(e:React.PointerEvent<HTMLDivElement>)=>{
  if(active.current!==e.pointerId)return;
  const dx=e.clientX-origin.current.x,dy=e.clientY-origin.current.y;
  const rad=55,mag=Math.max(1,Math.hypot(dx,dy));const factor=Math.min(1,mag/rad);
  const x=dx/mag*factor,y=dy/mag*factor;
  value.current.x=x;value.current.y=-y;setDot({x:x*rad,y:y*rad});
 };
 const end=(e:React.PointerEvent<HTMLDivElement>)=>{if(active.current!==e.pointerId)return;active.current=null;value.current.x=0;value.current.y=0;setDot({x:0,y:0})};
 return <div aria-label="Стик перемещения" onPointerDown={e=>{active.current=e.pointerId;origin.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
 style={{position:'absolute',left:'max(24px,env(safe-area-inset-left))',bottom:'max(22px,env(safe-area-inset-bottom))',width:148,height:148,borderRadius:'50%',border:'1px solid #d1d3cd70',background:'#b1b5af17',touchAction:'none',zIndex:20,display:'grid',placeItems:'center',userSelect:'none'}}>
 <div style={{width:63,height:63,borderRadius:'50%',background:'#d5d8d891',border:'1px solid #ffffffaa',transform:`translate(${dot.x}px,${dot.y}px)`,pointerEvents:'none'}}/>
 </div>
}
function LookPad({look}:{look:React.RefObject<Axis>}){
 const id=useRef<number|null>(null),previous=useRef({x:0,y:0});
 const end=(e:React.PointerEvent<HTMLDivElement>)=>{if(id.current===e.pointerId)id.current=null};
 return <div aria-label="Область обзора" onPointerDown={e=>{id.current=e.pointerId;previous.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(id.current!==e.pointerId)return;look.current.x+=e.clientX-previous.current.x;look.current.y+=e.clientY-previous.current.y;previous.current={x:e.clientX,y:e.clientY}}} onPointerUp={end} onPointerCancel={end}
 style={{position:'absolute',right:0,top:62,bottom:0,left:'44%',zIndex:9,touchAction:'none',userSelect:'none',background:'transparent'}}/>;
}
export default function BistroExperience(){
 const stick=useRef<Axis>({x:0,y:0}),look=useRef<Axis>({x:0,y:0}),loadedRef=useRef(false);
 const fire=useRef(0),reload=useRef(0),select=useRef(1),aim=useRef(false),run=useRef(false),jump=useRef(0);
 const [combat,setCombat]=useState<CombatPulse>({shots:0,hits:0,eliminations:0,ammo:30,reserve:120,reload:false,weapon:'rifle',ready:false,targets:0,aiming:false});
 const [entered,setEntered]=useState(false),[quality,setQuality]=useState<Quality>('High');
 const [loading,setLoading]=useState(''),[error,setError]=useState('');
 const [motion,setMotion]=useState<MotionTelemetry>({speed:0,sprinting:false,grounded:true,chain:0,jumps:0,airTime:0,verticalSpeed:0,groundedTime:0});
 const [stats,setStats]=useState<Metrics>({fps:0,calls:0,triangles:0,gpu:'WebGL2',meshes:0});
 const [landscape,setLandscape]=useState(true);
 const status=useCallback((x:string)=>setLoading(x),[]);
 const fail=useCallback((x:string)=>setError(x),[]);
 const ready=useCallback(()=>setLoading(''),[]);
 const metric=useCallback((m:Metrics)=>setStats(m),[]);
 const onCombat=useCallback((v:CombatPulse)=>setCombat(v),[]);
 const onMotion=useCallback((v:MotionTelemetry)=>setMotion(v),[]);
 useEffect(()=>{const mouse=(e:MouseEvent)=>{if(e.button===0&&document.pointerLockElement&&!((e.target as HTMLElement)?.closest('button')))fire.current++};const context=(e:MouseEvent)=>{if(document.pointerLockElement)e.preventDefault()};window.addEventListener('mousedown',mouse);window.addEventListener('contextmenu',context);return()=>{window.removeEventListener('mousedown',mouse);window.removeEventListener('contextmenu',context)}},[]);
 useEffect(()=>{const check=()=>setLandscape(window.innerWidth>=window.innerHeight);check();window.addEventListener('resize',check);return()=>window.removeEventListener('resize',check)},[]);
 useEffect(()=>{document.body.style.touchAction='none';return()=>{document.body.style.touchAction=''}},[]);
 const fullscreen=()=>document.documentElement.requestFullscreen?.().catch(()=>{});
 return <main style={{position:'fixed',inset:0,overflow:'hidden',touchAction:'none',background:'#172027',fontFamily:'Arial,Helvetica,sans-serif',color:'#fff'}}>
 {entered?<Canvas shadows dpr={Math.min(1.25,typeof window!=='undefined'?window.devicePixelRatio:1)}
 camera={{position:START.toArray(),fov:78,near:.055,far:215}} gl={{antialias:true,alpha:false,powerPreference:'high-performance',toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:.91,outputColorSpace:THREE.SRGBColorSpace}}
 onCreated={({gl,scene})=>{gl.setClearColor(0xb0c4d6);scene.background=new THREE.Color('#b0c4d6');gl.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();setError('GPU-контекст потерян. Перезапусти сцену.');});}}>
 <FPSWorld stick={stick} look={look} quality={quality} onStatus={status} onReady={ready} onError={fail} onMetric={metric} loadedRef={loadedRef} fire={fire} reload={reload} select={select} aim={aim} run={run} jump={jump} onCombat={onCombat} onMotion={onMotion}/>
 </Canvas>:<div style={{position:'absolute',inset:0,display:'flex',justifyContent:'center',alignItems:'center',flexDirection:'column',padding:24,background:'linear-gradient(135deg,#182a32,#29312e 65%,#181e22)'}}>
 <div style={{fontSize:10,letterSpacing:'.32em',opacity:.76}}>AMAZON LUMBERYARD BISTRO · CC BY 4.0</div>
 <h1 style={{fontSize:'clamp(36px,8vw,88px)',letterSpacing:'-.085em',margin:'20px 0 0'}}>BODYCAM <span style={{color:'#d9b58d'}}>NEXT</span></h1>
 <p style={{fontSize:12,letterSpacing:'.16em',opacity:.78,textAlign:'center'}}>URBAN BLOCK / FPS COMBAT PROTOTYPE · NO MULTIPLAYER</p>
 <button onClick={()=>{setEntered(true);setError('');setLoading('Инициализация сцены…')}} style={{border:0,background:'#e4c39a',color:'#212527',padding:'17px 29px',marginTop:20,fontWeight:800,letterSpacing:'.15em',cursor:'pointer'}}>ВОЙТИ НА КАРТУ →</button>
 <p style={{fontSize:10,opacity:.6,marginTop:35}}>На телефоне: левый стик — ходьба, справа — обзор. На ПК: WASD, мышь, 1/2/3 — оружие, R — перезарядка, Shift — бег, Space — прыжок (отпускай перед следующим), ПКМ — прицел.</p>
 <p style={{fontSize:10,opacity:.6,marginTop:6,textAlign:'center',lineHeight:1.7}}>3D-окружение: <a href="https://developer.nvidia.com/orca/amazon-lumberyard-bistro" target="_blank" rel="noopener noreferrer" style={{color:'#e4c39a'}}>Amazon Lumberyard Bistro</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" style={{color:'#e4c39a'}}>CC BY 4.0</a><br/>glTF/KTX2: <a href="https://github.com/qian-o/GLTF-Assets/tree/main/Bistro" target="_blank" rel="noopener noreferrer" style={{color:'#e4c39a'}}>qian-o</a> · адаптировано и оптимизировано для веба<br/>FPS arms + AK-74M: <a href="https://sketchfab.com/3d-models/fps-ak-74m-animations-94be8385c402474cacd39bc096c6ca14" target="_blank" rel="noopener noreferrer" style={{color:'#e4c39a'}}>Cransh — CC BY 4.0</a> · Pistol/shotgun: <a href="https://3dassets.dev/packs/tactical-shooter-hill-town" target="_blank" rel="noopener noreferrer" style={{color:'#e4c39a'}}>CC0</a> · Soldier: <a href="https://www.mixamo.com/" target="_blank" rel="noopener noreferrer" style={{color:'#e4c39a'}}>Mixamo</a></p>
 </div>}
 {entered&&<><LookPad look={look}/><JoyStick value={stick}/>
  <button aria-label="Бег" onPointerDown={e=>{e.preventDefault();run.current=true;e.currentTarget.setPointerCapture(e.pointerId)}}
    onPointerUp={()=>run.current=false} onPointerCancel={()=>run.current=false}
    style={{position:'absolute',left:'max(186px,calc(env(safe-area-inset-left) + 165px))',bottom:130,zIndex:35,
      border:'1px solid #d7e9e6a3',background:motion.sprinting?'#a3c3b0e6':'#253034d9',
      color:motion.sprinting?'#122725':'white',borderRadius:13,padding:'12px 15px',
      fontSize:11,fontWeight:750,touchAction:'none'}}>RUN</button>
  <button aria-label="Прыжок" onPointerDown={e=>{e.preventDefault();jump.current++;e.currentTarget.setPointerCapture(e.pointerId)}}
    style={{position:'absolute',left:'max(191px,calc(env(safe-area-inset-left) + 168px))',bottom:62,zIndex:35,
      border:'1px solid #d7e9e6a3',background:'#253034d9',color:'white',borderRadius:13,
      padding:'13px 10px',fontWeight:750,fontSize:11,touchAction:'none'}}>JUMP</button>
 {/* Sight picture is always centered on the actual camera ray used by combat raycasts.
     Four etched reticle strokes fade to a fine dot while aiming. */}
 <div role="img" aria-label="Центральный прицел"
   style={{position:'absolute',left:'50%',top:'50%',width:40,height:40,
     transform:'translate(-50%,-50%)',zIndex:32,pointerEvents:'none',
     filter:'drop-shadow(0 1px 1px #070b0c)'}}>
  <div style={{position:'absolute',left:17,top:17,width:6,height:6,
   borderRadius:'50%',background:combat.aiming?'#ffdd9f':'#e7efe8',
   border:'1px solid #172b2c',opacity:.97,
   boxShadow:'0 0 0 1px #fff8'}}/>
  {!combat.aiming&&([
   {left:19,top:5,width:2,height:8},
   {left:19,top:27,width:2,height:8},
   {left:5,top:19,width:8,height:2},
   {left:27,top:19,width:8,height:2}
  ]).map((v,i)=><div key={i} style={{position:'absolute',...v,
   background:'#e5f0e9',border:'0.6px solid #142123'}}/>)}
 </div>
 <div aria-label="Выбор оружия" style={{position:'absolute',left:'max(15px,env(safe-area-inset-left))',top:'max(58px,env(safe-area-inset-top))',zIndex:34,display:'flex',gap:6}}>{COMBAT_WEAPONS.map((weapon,i)=><button key={weapon.id} onClick={()=>select.current=i+1} style={{border:'1px solid #b5b3a566',background:combat.weapon===weapon.id?'#cbb590dc':'#1a252ac9',color:combat.weapon===weapon.id?'#1c2628':'#ece7e2',borderRadius:4,padding:'8px 9px',fontSize:10,fontWeight:700,cursor:'pointer'}}>{i+1} · {weapon.label}</button>)}</div>
 <button aria-label="Выстрел" onPointerDown={e=>{e.preventDefault();fire.current++}} style={{position:'absolute',right:35,bottom:52,zIndex:35,border:'1px solid #ffffff80',background:'#253034bf',color:'white',borderRadius:'50%',width:86,height:86,fontSize:12,fontWeight:700,touchAction:'none'}}>FIRE</button>
 <button aria-label="Прицеливание" aria-pressed={combat.aiming} onClick={()=>{aim.current=!aim.current;}} style={{position:'absolute',right:222,bottom:70,zIndex:36,border:'1px solid #ffffff70',background:'#253034bf',color:'white',borderRadius:14,padding:'12px 12px',fontSize:11,touchAction:'none'}}>ADS</button>
 <button aria-label="Перезарядка" onClick={()=>reload.current++} style={{position:'absolute',right:142,bottom:70,zIndex:36,border:'1px solid #ffffff70',background:'#253034bf',color:'white',borderRadius:14,padding:'12px 15px',fontSize:12}}>R</button>
  <div style={{position:'absolute',bottom:9,left:'max(12px,env(safe-area-inset-left))',
    zIndex:34,fontSize:10,background:'#172329ba',padding:'5px 8px',borderRadius:4,
    pointerEvents:'none',letterSpacing:'.04em'}}>
    {Math.round(motion.speed*3.6)} km/h · {motion.sprinting?'SPRINT':'WALK'}
    {!motion.grounded?' · AIR':''}{motion.chain>0?' · BHOP ×'+motion.chain:''}
  </div>
  <div style={{position:'absolute',bottom:9,right:18,zIndex:35,fontSize:11,background:'#172329b3',padding:8}}>{combat.weapon.toUpperCase()} · {combat.ammo} / {combat.reserve} · HIT {combat.hits} · K.O. {combat.eliminations}{combat.reload?' · RELOAD':''}{!combat.ready?' · LOADING ARMS':''}</div>
 <div style={{position:'absolute',left:'max(16px,env(safe-area-inset-left))',top:'max(12px,env(safe-area-inset-top))',zIndex:30,fontSize:11,textShadow:'0 2px 8px #000'}}>
 <b>BODYCAM: NEXT</b><div style={{opacity:.77,fontSize:9,marginTop:4}}>REAL GLTF · FREE ASSETS · DEVELOPMENT PREVIEW</div>
 </div>
 <div style={{position:'absolute',right:'max(13px,env(safe-area-inset-right))',top:'max(9px,env(safe-area-inset-top))',zIndex:30,display:'flex',gap:8,alignItems:'center'}}>
 <span style={{fontSize:10,background:'#19262bab',padding:8}}>{Math.round(stats.fps)} FPS · {stats.calls} calls</span>
 <select value={quality} aria-label="Качество графики" onChange={e=>setQuality(e.target.value as Quality)} style={{background:'#23363dcf',color:'white',border:'1px solid #7f989a',fontSize:11,padding:7}}><option>High</option><option>Cinematic Max</option></select>
 <button onClick={fullscreen} style={{background:'#23363dcf',color:'white',border:'1px solid #7f989a',padding:7,cursor:'pointer'}}>⛶</button>
 </div>
 {loading&&!error&&<div role="status" style={{position:'absolute',zIndex:40,top:'50%',left:'50%',transform:'translate(-50%,-50%)',padding:18,background:'#0c1416e8',border:'1px solid #bfc2beaa',textAlign:'center',fontSize:12,minWidth:280}}>
 <div>ЗАГРУЗКА ГОРОДСКОЙ СЦЕНЫ</div><p style={{fontSize:11,color:'#ddd3c5'}}>{loading}</p>
 </div>}
 {error&&<div role="alert" style={{position:'absolute',zIndex:45,top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#161e22f2',border:'1px solid #d9b58d',padding:25,maxWidth:340,fontSize:12,textAlign:'center'}}>Ошибка загрузки 3D<p>{error}</p><button onClick={()=>location.reload()} style={{padding:12}}>Повторить</button></div>}
 {!landscape&&<div style={{position:'absolute',inset:0,background:'#152025ed',zIndex:45,display:'grid',placeItems:'center',fontSize:14}}>Поверни телефон горизонтально</div>}
 </>}
 </main>;
}

