'use client';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {useGLTF} from '@react-three/drei';
import * as THREE from 'three';
import {Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import catalog from '../../data/catalog.json';
import level from '../../data/level.layout.json';
type Item=typeof level.objects[number];
function Instance({item,showBounds=false}:{item:Item,showBounds?:boolean}){
 const entry=catalog.find(a=>a.id===item.asset);
 if(!entry)return null;
 const gltf=useGLTF(entry.url);
 const object=useMemo(()=>{
  const scene=gltf.scene;
  let clone:THREE.Object3D;
  if(item.variant){
   const source=scene.getObjectByName(item.variant);
   if(!source)return new THREE.Group();
   clone=source.clone(true);
  }else clone=scene.clone(true);
  clone.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(clone);
  const center=bounds.getCenter(new THREE.Vector3());
  const size=bounds.getSize(new THREE.Vector3());
  // Preserve imported hierarchy; apply normalization only at a parent wrapper.
  const normalize=new THREE.Group();
  const facing=new THREE.Group();
  normalize.add(facing);facing.add(clone);
  if(item.variant){clone.position.sub(center);clone.position.y+=size.y/2;}
  else {clone.position.x-=center.x;clone.position.z-=center.z;clone.position.y-=bounds.min.y;}
  normalize.userData.dimensions=size.toArray();
  clone.traverse(child=>{
   if(child instanceof THREE.Mesh){child.castShadow=true;child.receiveShadow=true;}
  });
  return normalize;
 },[gltf.scene,item.variant]);
 return <group position={item.position as [number,number,number]} rotation={item.rotation as [number,number,number]} scale={item.scale as [number,number,number]}>
   <primitive object={object}/>
   {showBounds&&<mesh position={[0,.65,0]}><boxGeometry args={[.6,1.3,.6]}/><meshBasicMaterial wireframe color="#88ffb8"/></mesh>}
 </group>;
}
function ConcretePlane({roof=false}:{roof?:boolean}){
 const texture=useMemo(()=>new THREE.TextureLoader().load('/textures/worn_concrete_floor-color.jpg',t=>{t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(4,4);}),[]);
 const normal=useMemo(()=>new THREE.TextureLoader().load('/textures/worn_concrete_floor-normal.jpg',t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(4,4);}),[]);
 return <mesh rotation={[-Math.PI/2,0,0]} position={[0,roof?6:-.055,0]} receiveShadow>
 <planeGeometry args={[12,12]}/><meshStandardMaterial map={texture} normalMap={normal} metalness={0} roughness={.91} side={THREE.DoubleSide}/></mesh>
}
function CameraMotion({stick,look}:{stick:React.RefObject<{x:number;y:number}>;look:React.RefObject<{x:number;y:number}>}){
 const {camera}=useThree();const pressed=useRef(new Set<string>());const yaw=useRef(0),pitch=useRef(0);
 useEffect(()=>{
 camera.position.set(-.4,1.68,1.8);
 const down=(e:KeyboardEvent)=>pressed.current.add(e.key.toLowerCase());
 const up=(e:KeyboardEvent)=>pressed.current.delete(e.key.toLowerCase());
 const blur=()=>pressed.current.clear();window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
 return ()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur)};
 },[camera]);
 useFrame((_,dt)=>{
 const dx=look.current?.x||0,dy=look.current?.y||0;if(look.current){look.current.x=0;look.current.y=0}
 yaw.current-=dx*.003;pitch.current=Math.max(-1.28,Math.min(1.28,pitch.current-dy*.003));
 camera.rotation.order='YXZ';camera.rotation.set(pitch.current,yaw.current,0);
 let x=(stick.current?.x||0)+(pressed.current.has('d')?1:0)-(pressed.current.has('a')?1:0);
 let z=(stick.current?.y||0)+(pressed.current.has('w')?1:0)-(pressed.current.has('s')?1:0);
 const len=Math.hypot(x,z);if(len>.05){
 x/=Math.max(1,len);z/=Math.max(1,len);
 const speed=Math.min(dt,.05)*2.45;
 camera.position.x+=(-Math.sin(yaw.current)*z+Math.cos(yaw.current)*x)*speed;
 camera.position.z+=(-Math.cos(yaw.current)*z-Math.sin(yaw.current)*x)*speed;
 // Camera bounds only: coarse collisions until mesh-aware validator is approved.
 camera.position.x=THREE.MathUtils.clamp(camera.position.x,-5.55,5.55);
 camera.position.z=THREE.MathUtils.clamp(camera.position.z,-5.55,5.55);
 }
 });
 return null;
}
function PerformanceReport({onMetric}:{onMetric:(fps:number,info:THREE.WebGLInfo)=>void}){
 const {gl}=useThree();const count=useRef(0),time=useRef(0);
 useFrame((_,dt)=>{time.current+=dt;count.current++;if(time.current>1.25){onMetric(count.current/time.current,gl.info);time.current=0;count.current=0}});
 return null;
}
function SceneLoaded({onReady}:{onReady:()=>void}){useEffect(()=>onReady(),[onReady]);return null}
function World({stick,look,quality,onMetric,debug,onReady,onFatal}:{stick:React.RefObject<{x:number;y:number}>;look:React.RefObject<{x:number;y:number}>;quality:string;onMetric:(fps:number,info:THREE.WebGLInfo)=>void;debug:boolean;onReady:()=>void;onFatal:(message:string)=>void}){
 return <Canvas shadows dpr={quality==='Cinematic Max'?window.devicePixelRatio:quality==='Ultra'?1.65:1.1}
 camera={{fov:77,near:.06,far:75}} gl={{antialias:true,powerPreference:'high-performance',alpha:false,outputColorSpace:THREE.SRGBColorSpace,toneMapping:THREE.ACESFilmicToneMapping}} onCreated={({gl,scene})=>{
  gl.setClearColor('#11191d');scene.background=new THREE.Color('#2c3334');
  gl.domElement.addEventListener('webglcontextlost',()=>onFatal('Графический контекст WebGL потерян. Перезагрузите страницу.'));
  gl.domElement.addEventListener('webglcontextcreationerror',()=>onFatal('WebGL не удалось инициализировать.'));
 }}>
 <ambientLight intensity={.46} color="#d3dae1"/><hemisphereLight args={['#b8cce5','#282321',.72]}/>
 <directionalLight castShadow position={[-6,11,-8]} color="#fff1d9" intensity={3.1} shadow-mapSize={quality==='Cinematic Max'?4096:quality==='Ultra'?2048:1024} shadow-bias={-.0003} shadow-normalBias={.02}/>
 <pointLight position={[0,4.5,1.2]} color="#fde2b7" intensity={8} distance={11} decay={2}/>
 <Suspense fallback={null}>
 <ConcretePlane/><ConcretePlane roof/>
 {level.objects.map(i=><Instance key={i.id} item={i} showBounds={debug&&i.anchor==='FloorAnchor'}/>)}
 <SceneLoaded onReady={onReady}/>
 </Suspense>
 <CameraMotion stick={stick} look={look}/><PerformanceReport onMetric={onMetric}/>
 </Canvas>
}
export default function Experience(){
 const [running,setRunning]=useState(false),[quality,setQuality]=useState('High'),[debug,setDebug]=useState(false),[report,setReport]=useState({fps:0,triangles:0,calls:0});
 const [ready,setReady]=useState(false),[loadSlow,setLoadSlow]=useState(false),[fatal,setFatal]=useState<string|null>(null);
 const markReady=useCallback(()=>setReady(true),[]);
 const reportFatal=useCallback((error:string)=>setFatal(error),[]);
 useEffect(()=>{if(!running||ready)return; const id=window.setTimeout(()=>setLoadSlow(true),16000);return ()=>window.clearTimeout(id)},[running,ready]);
 const stick=useRef({x:0,y:0}),look=useRef({x:0,y:0}),left=useRef<number|null>(null),right=useRef<number|null>(null),prev=useRef({x:0,y:0});
 function inputMove(e:React.PointerEvent){const rect=(e.currentTarget as HTMLElement).getBoundingClientRect();if(e.pointerId===left.current){let x=(e.clientX-(rect.left+rect.width*.14))/70,y=(e.clientY-(rect.top+rect.height*.78))/70;stick.current={x:THREE.MathUtils.clamp(x,-1,1),y:THREE.MathUtils.clamp(-y,-1,1)}}else if(e.pointerId===right.current){look.current.x+=e.clientX-prev.current.x;look.current.y+=e.clientY-prev.current.y;prev.current={x:e.clientX,y:e.clientY}}}
 return <main className="game">
 {running&&<World stick={stick} look={look} quality={quality} debug={debug} onReady={markReady} onFatal={reportFatal} onMetric={(fps,i)=>setReport({fps,triangles:i.render.triangles,calls:i.render.calls})}/>}
 {running&&!ready&&!fatal&&<div role="status" style={{position:'absolute',zIndex:40,left:'50%',top:'52%',transform:'translate(-50%,-50%)',padding:'18px 24px',background:'#0b1214d9',border:'1px solid #7d8d8a',color:'#f0eee5',fontSize:12,letterSpacing:'.08em',textAlign:'center',minWidth:275,pointerEvents:'auto'}}>
 <strong>ЗАГРУЖАЕМ ПРОМЫШЛЕННУЮ КОМНАТУ</strong>
 <p style={{fontSize:11,letterSpacing:'normal',marginBottom:0,color:'#adb9b2'}}>{loadSlow?'Загрузка занимает больше времени, чем ожидалось. Проверьте сеть или попробуйте обновить страницу.':'Подготовка моделей и материалов…'}</p>
 {loadSlow&&<button onClick={()=>location.reload()} style={{marginTop:12,padding:'10px 18px',background:'#d5b79a',border:0,color:'#182020'}}>ПОВТОРИТЬ</button>}
 </div>}
 {running&&fatal&&<div role="alert" style={{position:'absolute',zIndex:50,left:'50%',top:'50%',transform:'translate(-50%,-50%)',padding:24,background:'#111a1af0',border:'1px solid #d5b79a',maxWidth:360,textAlign:'center',color:'#fff',fontSize:13}}>
 <strong>ОШИБКА 3D-РЕНДЕРА</strong><p>{fatal}</p><button onClick={()=>location.reload()} style={{padding:'12px 18px',background:'#d5b79a',border:0,color:'#182020'}}>ПЕРЕЗАГРУЗИТЬ</button></div>}
 {!running?<section className="intro"><div className="subtle">BODYCAM: NEXT GENERATION <span> / 001</span></div><h1>THE<br/>AFTER<span>SHIFT</span></h1><div className="intro-rule"/><p>INDUSTRIAL ROOM — FIRST ENVIRONMENT STUDY.<br/>REAL 3D ASSETS. REAL TIME LIGHT. NO COMBAT.</p><button onClick={()=>setRunning(true)}>ENTER ENVIRONMENT <span>↗</span></button><small>DESIGNED FOR LANDSCAPE · iPHONE / ANDROID / DESKTOP</small></section>:<>
 <div className="hud-title"><span className="record"/> BODYCAM / NEXT <em>— ENVIRONMENT STUDY</em></div>
 <div className="hud-info"><span>{report.fps.toFixed(0)} FPS</span><button onClick={()=>setDebug(v=>!v)}>BOUNDS {debug?'ON':'OFF'}</button><select value={quality} onChange={e=>setQuality(e.target.value)}><option>High</option><option>Ultra</option><option>Cinematic Max</option></select><button onClick={()=>document.documentElement.requestFullscreen?.()}>⛶</button></div>
 <div className="reticle"/>
 <div className="touch-layer" onPointerDown={e=>{if(e.clientX<innerWidth*.44&&left.current===null)left.current=e.pointerId;else if(right.current===null){right.current=e.pointerId;prev.current={x:e.clientX,y:e.clientY}};e.currentTarget.setPointerCapture(e.pointerId);inputMove(e)}} onPointerMove={inputMove} onPointerUp={e=>{if(e.pointerId===left.current){left.current=null;stick.current={x:0,y:0}}if(e.pointerId===right.current)right.current=null}} onPointerCancel={()=>{left.current=right.current=null;stick.current={x:0,y:0}}}/>
 <div className="stick-guide"><span/></div><div className="bottom-note">001 — INDUSTRIAL INTERIOR <span> / </span> THREE.JS + R3F</div>
 </>}
 </main>;
}

