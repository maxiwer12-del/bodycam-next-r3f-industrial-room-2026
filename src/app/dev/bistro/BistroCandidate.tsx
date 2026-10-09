'use client';
import {Canvas,useThree,useFrame} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {useEffect,useRef,useState,useCallback} from 'react';
import * as THREE from 'three';
type LoadReport={nodes:number;meshes:number;tris:number;drawCalls:number;fps:number;renderer:string;dimension:[number,number,number];boundsCenter:[number,number,number]};
declare global{interface Window{__BISTRO_INSPECT__?:{camera:(pos:number[],target:number[])=>void;report:()=>LoadReport|null;objects:()=>string[]}}}
function CandidateContent({onProgress,onLoaded,onError}:{onProgress:(label:string)=>void;onLoaded:(stats:LoadReport)=>void;onError:(err:string)=>void}){
 const {gl,scene,camera}=useThree();
 const lowGPU=new URLSearchParams(window.location.search).has("lowgpu");
 const root=useRef<THREE.Object3D|null>(null),loaderRef=useRef<KTX2Loader|null>(null);
 const [loaded,setLoaded]=useState(false);
 const report=useRef<LoadReport|null>(null);
 const fps=useRef({frames:0,elapsed:0});
 useEffect(()=>{
   if(root.current)return;
   let cancelled=false;
   const transcoder=new KTX2Loader().setTranscoderPath('/basis/').setWorkerLimit(2);
   transcoder.detectSupport(gl);
   loaderRef.current=transcoder;
   let envTex:THREE.DataTexture|undefined;
   const hdri=new HDRLoader();
   if(!lowGPU)hdri.load('/maps/bistro-zone/san_giuseppe_1k.hdr',(t)=>{
     if(cancelled){t.dispose();return}
     envTex=t;envTex.mapping=THREE.EquirectangularReflectionMapping;
     scene.environment=envTex;scene.environmentIntensity=.63;
     scene.background=envTex;scene.backgroundIntensity=.42;
   },undefined,err=>console.warn('HDR_ENV_UNAVAILABLE',err));
   const loader=new GLTFLoader().setKTX2Loader(transcoder);
   const src='/maps/bistro-zone/scene.gltf';
   const start=performance.now();
   onProgress('Loading verified Amazon Bistro glTF + KTX2…');
   loader.load(src,gltf=>{
     if(cancelled)return;
     const sceneRoot=gltf.scene;root.current=sceneRoot;scene.add(sceneRoot);
     let meshes=0,tris=0;
     const b=new THREE.Box3().setFromObject(sceneRoot);
     sceneRoot.traverse(o=>{
       if(o instanceof THREE.Mesh){
         meshes++;
         o.castShadow=!lowGPU;o.receiveShadow=!lowGPU;
         const index=o.geometry?.getIndex();tris+=index?index.count/3:o.geometry.getAttribute('position')?.count/3||0;
         const materials=Array.isArray(o.material)?o.material:[o.material];
         for(const m of materials){
           if(m instanceof THREE.MeshStandardMaterial){
             m.envMapIntensity=.75;
             if(m.normalMap)m.normalScale.y*=-1;
             m.needsUpdate=true;
           }
         }
       }
     });
     const center=b.getCenter(new THREE.Vector3());const size=b.getSize(new THREE.Vector3());
     camera.position.set(-9,2.1,6);camera.lookAt(new THREE.Vector3(-9,2,-7));
     const stats:LoadReport={nodes:gltf.scene.children.length,meshes,tris,drawCalls:0,fps:0,renderer:gl.capabilities.isWebGL2?'WebGL2':'WebGL1',dimension:size.toArray() as [number,number,number],boundsCenter:center.toArray() as [number,number,number]};
     report.current=stats;
     onLoaded(stats);
     console.info('BISTRO_LOADED',JSON.stringify({...stats,loadMs:Math.round(performance.now()-start)}));
     if(typeof window!=='undefined'){
       window.__BISTRO_INSPECT__={
        camera:(pos,tgt)=>{camera.position.fromArray(pos);camera.lookAt(new THREE.Vector3(...tgt));},
        report:()=>report.current,
        objects:()=>gltf.scene.children.map(x=>x.name)
       };
     }
     setLoaded(true);
   },event=>{
     if(event.total)onProgress('Geometry download '+Math.round(event.loaded/event.total*100)+'%');
   },err=>{console.error('BISTRO_MODEL_LOADING_FAILED',err);onError(String(err));});
   return ()=>{cancelled=true;if(root.current)scene.remove(root.current);loaderRef.current?.dispose();envTex?.dispose();window.__BISTRO_INSPECT__=undefined};
 },[scene,gl,camera,onProgress,onLoaded,onError]);
 useFrame((_,dt)=>{if(!loaded||!report.current)return;fps.current.elapsed+=dt;fps.current.frames++;
   if(fps.current.elapsed>1.2){report.current.fps=fps.current.frames/fps.current.elapsed;report.current.drawCalls=gl.info.render.calls;fps.current={frames:0,elapsed:0}}
 });
 return <>
  <hemisphereLight intensity={1.3} color="#dfedff" groundColor="#8c7c73"/>
  <directionalLight position={[14,32,-10]} intensity={3.2} color="#fff5df" castShadow={!lowGPU} shadow-mapSize={[1536,1536]} shadow-camera-near={1} shadow-camera-far={130} shadow-camera-left={-35} shadow-camera-right={35} shadow-camera-top={35} shadow-camera-bottom={-35} shadow-bias={-0.00015}/>
  <OrbitControls makeDefault enableDamping dampingFactor={.11} minDistance={.5} maxDistance={70} target={[-9,2,-7]}/>
 </>;
}
export default function BistroCandidate(){
 const [message,setMessage]=useState('Initializing WebGL2 inspection renderer…'),[stats,setStats]=useState<LoadReport|null>(null),[err,setErr]=useState('');
 const onProgress=useCallback((s:string)=>setMessage(s),[]);const onLoaded=useCallback((s:LoadReport)=>{setStats(s);setMessage('');},[]);const onError=useCallback((s:string)=>setErr(s),[]);
 const lowGPU=typeof window!=="undefined"&&new URLSearchParams(window.location.search).has("lowgpu");
 return <main style={{height:'100dvh',background:'#161d20',color:'#edf3ef',position:'relative',fontFamily:'Arial'}}>
  <Canvas shadows={!lowGPU} dpr={lowGPU?.7:1} camera={{fov:76,near:.07,far:260}} gl={{antialias:true,powerPreference:'high-performance',alpha:false,outputColorSpace:THREE.SRGBColorSpace,toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.0}} onCreated={({gl,scene})=>{gl.setClearColor(0x7d8c94);scene.background=new THREE.Color('#8798a6')}}>
   <CandidateContent onProgress={onProgress} onLoaded={onLoaded} onError={onError}/>
  </Canvas>
  <div style={{position:'absolute',left:18,top:18,background:'#10181ad4',padding:14,fontSize:12,zIndex:10,maxWidth:320,letterSpacing:'.06em',pointerEvents:'none'}}>
    <b>BODYCAM NEXT / MAP ASSET INSPECTION</b>
    <p style={{fontSize:10,opacity:.8}}>Amazon Lumberyard Bistro — REAL GLTF · CC BY 4.0</p>
    {stats?<><p>Meshed objects: {stats.meshes} · Triangles: {Math.round(stats.tris).toLocaleString()}</p><p>Geometry AABB: {stats.dimension.map(x=>x.toFixed(1)).join(' × ')} m</p><p>Source region: 32 × 32 m · FPS: {stats.fps.toFixed(1)}</p><p>Orbit drag / pinch to inspect. Not an approved level.</p></>:<p>{message}</p>}
    {err&&<p style={{color:'#f99'}}>Load error: {err}</p>}
  </div>
 </main>;
}

