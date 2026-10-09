'use client';
import {Canvas,useThree,useFrame} from '@react-three/fiber';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';
import {useState,useEffect,useRef,useCallback} from 'react';
import * as THREE from 'three';

type Quality='High'|'Cinematic Max';
type Axis={x:number;y:number};
type Metrics={fps:number;calls:number;triangles:number;gpu:'WebGL2'|'WebGL1';meshes:number};
type Collider={mesh:THREE.Mesh;box:THREE.Box3;solid:boolean};
const START=new THREE.Vector3(-9,2.08,6);
const MAX_DISTANCE=13;
const PLAYER_HEIGHT=1.7;
const PLAYER_RADIUS=.3;

function FPSWorld({stick,look,quality,onStatus,onReady,onError,onMetric,loadedRef}:{
 stick:React.RefObject<Axis>;look:React.RefObject<Axis>;quality:Quality;
 onStatus:(s:string)=>void;onReady:()=>void;onError:(s:string)=>void;onMetric:(m:Metrics)=>void;
 loadedRef:React.RefObject<boolean>;
}){
 const {camera,gl,scene}=useThree();
 const world=useRef<THREE.Group|null>(null);
 const colliders=useRef<Collider[]>([]);
 const rotation=useRef({yaw:0,pitch:0});
 const keys=useRef(new Set<string>());
 const stats=useRef({frames:0,elapsed:0});
 const ready=useRef(false);
 const lastReport=useRef<Metrics>({fps:0,calls:0,triangles:0,gpu:gl.capabilities.isWebGL2?'WebGL2':'WebGL1',meshes:0});
 const forward=useRef(new THREE.Vector3()),right=useRef(new THREE.Vector3());
 const queryBox=useRef(new THREE.Box3());
 const tempRay=useRef(new THREE.Raycaster());
 const candidate=useRef(new THREE.Vector3());
 const spin=useRef(new THREE.Euler(0,0,0,'YXZ'));
 const rootTexture=useRef<THREE.DataTexture|null>(null);

 useEffect(()=>{
  function keydown(e:KeyboardEvent){if(['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){keys.current.add(e.code);e.preventDefault();}}
  function keyup(e:KeyboardEvent){keys.current.delete(e.code);}
  function blur(){keys.current.clear();stick.current.x=0;stick.current.y=0;look.current.x=0;look.current.y=0;}
  function pointer(e:MouseEvent){if(document.pointerLockElement===gl.domElement){look.current.x+=e.movementX;look.current.y+=e.movementY;}}
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);window.addEventListener('mousemove',pointer);
  gl.domElement.addEventListener('click',()=>{if(!('ontouchstart'in window))gl.domElement.requestPointerLock?.().catch(()=>{});});
  camera.position.copy(START);camera.rotation.order='YXZ';camera.rotation.set(0,0,0);
  return()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);window.removeEventListener('mousemove',pointer)}
 },[camera,gl,stick,look]);

 useEffect(()=>{
  let disposed=false;
  const transcoder=new KTX2Loader().setTranscoderPath('/basis/').setWorkerLimit(2);
  transcoder.detectSupport(gl);
  const renderer=new GLTFLoader().setKTX2Loader(transcoder);
  const hdr=new HDRLoader();
  hdr.load('/maps/bistro-zone/san_giuseppe_1k.hdr',(env)=>{
   if(disposed){env.dispose();return}
   rootTexture.current=env;env.mapping=THREE.EquirectangularReflectionMapping;
   scene.environment=env;scene.environmentIntensity=1.1;
   scene.background=env;scene.backgroundIntensity=.42;
  },undefined,(error)=>console.warn('ENVIRONMENT_WARNING',error));
  onStatus('Загрузка городской карты · GLTF + KTX2...');
  const started=performance.now();
  renderer.load('/maps/bistro-zone/scene-merged.gltf',gltf=>{
   if(disposed)return;
   world.current=gltf.scene;scene.add(gltf.scene);
   gltf.scene.updateMatrixWorld(true);
   let count=0;
   const used=new Set<THREE.Material>();
   const region=new THREE.Box3(new THREE.Vector3(-MAX_DISTANCE,-4,-MAX_DISTANCE),new THREE.Vector3(MAX_DISTANCE,20,MAX_DISTANCE));
   const physics:Collider[]=[];
   gltf.scene.traverse(node=>{
    if(!(node instanceof THREE.Mesh))return;
    count++;
    const mat=Array.isArray(node.material)?node.material[0]:node.material;
    const name=mat?.name?.toLowerCase()||'';
    if(!used.has(mat)){
      used.add(mat);
      if(mat instanceof THREE.MeshStandardMaterial){
       mat.envMapIntensity=1.1;
       if(mat.normalMap)mat.normalScale.y*=-1;
       if(/brick|concrete|stone|pavement|wood|ground|roof|cobble|plaster/i.test(name))mat.roughness=Math.max(.84,mat.roughness);
       if(/foliage|leaf|hedge|flower/.test(name)){mat.roughness=Math.max(.78,mat.roughness);mat.metalness=0;}
       mat.needsUpdate=true;
      }
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
      camera:()=>camera.position.toArray(),colliders:physics.length,
      meshCount:count,loadedAt:Date.now()
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
   if(world.current)scene.remove(world.current);
   if(scene.environment===rootTexture.current)scene.environment=null;
   rootTexture.current?.dispose();transcoder.dispose();
  };
 },[camera,gl,scene,quality,onStatus,onReady,onError,loadedRef]);

 useFrame((_,dt)=>{
  if(!ready.current)return;
  const step=Math.min(dt,.055);
  const yaw=rotation.current;
  yaw.yaw-=look.current.x*.003; yaw.pitch=Math.max(-1.38,Math.min(1.38,yaw.pitch-look.current.y*.0028));
  look.current.x=0;look.current.y=0;
  spin.current.set(yaw.pitch,yaw.yaw,0,'YXZ');camera.quaternion.setFromEuler(spin.current);
  const k=keys.current;
  const x=THREE.MathUtils.clamp(stick.current.x+(k.has('KeyD')||k.has('ArrowRight')?1:0)-(k.has('KeyA')||k.has('ArrowLeft')?1:0),-1,1);
  const y=THREE.MathUtils.clamp(stick.current.y+(k.has('KeyW')||k.has('ArrowUp')?1:0)-(k.has('KeyS')||k.has('ArrowDown')?1:0),-1,1);
  const magnitude=Math.min(1,Math.hypot(x,y));
  if(magnitude>.04){
   const dir=forward.current.set(Math.sin(yaw.yaw)*-y+Math.cos(yaw.yaw)*x,0,Math.cos(yaw.yaw)*-y-Math.sin(yaw.yaw)*x);
   dir.normalize();const delta=step*2.65*magnitude;
   const pos=camera.position;
   const next=candidate.current.copy(pos).addScaledVector(dir,delta);
   const hasBounds=Math.abs(next.x)<=MAX_DISTANCE&&Math.abs(next.z)<=MAX_DISTANCE;
   if(hasBounds){
    let blocked=false;
    // Check two body-height rays against actual imported triangles, using BVH.
    for(const height of [-1.35,-.45]){
      if(blocked)break;
      const origin=new THREE.Vector3(pos.x,pos.y+height,pos.z);
      tempRay.current.set(origin,dir);tempRay.current.near=0;tempRay.current.far=delta+PLAYER_RADIUS;
      for(const c of colliders.current){
        if(!c.box.clone().expandByScalar(.4).intersectsBox(queryBox.current.setFromCenterAndSize(origin,new THREE.Vector3(.85,2,.85))))continue;
        const hits=tempRay.current.intersectObject(c.mesh,false);
        if(hits.length){
          const normal=hits[0].face?.normal;
          if(normal&&Math.abs(normal.y)<.65){blocked=true;break}
        }
      }
    }
    if(!blocked){
      // Contact is calculated from the imported road mesh rather than a fake floor plane.
      const origin=new THREE.Vector3(next.x,pos.y+.65,next.z);
      tempRay.current.set(origin,new THREE.Vector3(0,-1,0));
      tempRay.current.near=0;tempRay.current.far=3.4;
      let footY:number|null=null;
      for(const c of colliders.current){
        if(next.x<c.box.min.x||next.x>c.box.max.x||next.z<c.box.min.z||next.z>c.box.max.z)continue;
        const hits=tempRay.current.intersectObject(c.mesh,false);
        for(const h of hits){
          if(h.point.y>pos.y-PLAYER_HEIGHT+.4||h.point.y<pos.y-PLAYER_HEIGHT-.48)continue;
          const face=h.face?.normal;
          if(!face)continue;
          const normal=face.clone().transformDirection(c.mesh.matrixWorld);
          if(Math.abs(normal.y)<.77)continue;
          if(footY===null||h.point.y>footY)footY=h.point.y;
        }
      }
      if(footY!==null){pos.x=next.x;pos.z=next.z;pos.y=THREE.MathUtils.lerp(pos.y,footY+PLAYER_HEIGHT,Math.min(1,dt*14));}
    }
   }
  }
  stats.current.frames++;stats.current.elapsed+=dt;
  if(stats.current.elapsed>=1.5){
   const m={fps:stats.current.frames/stats.current.elapsed,calls:gl.info.render.calls,triangles:gl.info.render.triangles,gpu:gl.capabilities.isWebGL2?'WebGL2' as const:'WebGL1' as const,meshes:lastReport.current.meshes};
   lastReport.current=m;onMetric(m);stats.current={frames:0,elapsed:0};
  }
 });
 return <>
 <hemisphereLight intensity={2.05} color="#f0f3ff" groundColor="#b0a19a"/>
 <directionalLight position={[14,30,-10]} intensity={3.2} color="#fff3e2"
 castShadow={quality==='Cinematic Max'}
 shadow-camera-left={-18} shadow-camera-right={18} shadow-camera-top={18} shadow-camera-bottom={-18}
 shadow-camera-near={.8} shadow-camera-far={95} shadow-mapSize={[2048,2048]} shadow-bias={-.0001}/>
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
 const [entered,setEntered]=useState(false),[quality,setQuality]=useState<Quality>('High');
 const [loading,setLoading]=useState(''),[error,setError]=useState('');
 const [stats,setStats]=useState<Metrics>({fps:0,calls:0,triangles:0,gpu:'WebGL2',meshes:0});
 const [landscape,setLandscape]=useState(true);
 const status=useCallback((x:string)=>setLoading(x),[]);
 const fail=useCallback((x:string)=>setError(x),[]);
 const ready=useCallback(()=>setLoading(''),[]);
 const metric=useCallback((m:Metrics)=>setStats(m),[]);
 useEffect(()=>{const check=()=>setLandscape(window.innerWidth>=window.innerHeight);check();window.addEventListener('resize',check);return()=>window.removeEventListener('resize',check)},[]);
 useEffect(()=>{document.body.style.touchAction='none';return()=>{document.body.style.touchAction=''}},[]);
 const fullscreen=()=>document.documentElement.requestFullscreen?.().catch(()=>{});
 return <main style={{position:'fixed',inset:0,overflow:'hidden',touchAction:'none',background:'#172027',fontFamily:'Arial,Helvetica,sans-serif',color:'#fff'}}>
 {entered?<Canvas key={quality} shadows={quality==='Cinematic Max'} dpr={quality==='Cinematic Max'?(typeof window!=='undefined'?window.devicePixelRatio:1):Math.min(1.25,typeof window!=='undefined'?window.devicePixelRatio:1)}
 camera={{position:START.toArray(),fov:78,near:.055,far:215}} gl={{antialias:true,alpha:false,powerPreference:'high-performance',toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.32,outputColorSpace:THREE.SRGBColorSpace}}
 onCreated={({gl,scene})=>{gl.setClearColor(0x95a3a7);scene.background=new THREE.Color('#aab9bc');gl.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();setError('GPU-контекст потерян. Попробуй перезапустить сцену.')});}}>
 <FPSWorld stick={stick} look={look} quality={quality} onStatus={status} onReady={ready} onError={fail} onMetric={metric} loadedRef={loadedRef}/>
 </Canvas>:<div style={{position:'absolute',inset:0,display:'flex',justifyContent:'center',alignItems:'center',flexDirection:'column',padding:24,background:'linear-gradient(135deg,#182a32,#29312e 65%,#181e22)'}}>
 <div style={{fontSize:10,letterSpacing:'.32em',opacity:.76}}>AMAZON LUMBERYARD BISTRO · CC BY 4.0</div>
 <h1 style={{fontSize:'clamp(36px,8vw,88px)',letterSpacing:'-.085em',margin:'20px 0 0'}}>BODYCAM <span style={{color:'#d9b58d'}}>NEXT</span></h1>
 <p style={{fontSize:12,letterSpacing:'.16em',opacity:.78,textAlign:'center'}}>URBAN BLOCK / ART TEST 01 · NO WEAPONS · NO MULTIPLAYER</p>
 <button onClick={()=>{setEntered(true);setError('');setLoading('Инициализация сцены…')}} style={{border:0,background:'#e4c39a',color:'#212527',padding:'17px 29px',marginTop:20,fontWeight:800,letterSpacing:'.15em',cursor:'pointer'}}>ВОЙТИ НА КАРТУ →</button>
 <p style={{fontSize:10,opacity:.6,marginTop:35}}>На телефоне: левый стик — ходьба, справа — обзор. На ПК: WASD и мышь.</p>
 </div>}
 {entered&&<><LookPad look={look}/><JoyStick value={stick}/>
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

