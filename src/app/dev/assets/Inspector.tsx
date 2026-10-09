'use client';
import {Canvas} from '@react-three/fiber';
import {OrbitControls,useGLTF,Grid} from '@react-three/drei';
import * as THREE from 'three';
import {Suspense,useMemo,useState} from 'react';
import catalog from '../../../../data/catalog.json';
function Model({id}:{id:string}){const asset=catalog.find(a=>a.id===id)!;const g=useGLTF(asset.url);const clone=useMemo(()=>{const c=g.scene.clone(true);c.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(c);const center=b.getCenter(new THREE.Vector3());c.position.sub(center);c.position.y+=b.getSize(new THREE.Vector3()).y/2;return c},[g.scene]);return <primitive object={clone}/>;}
export default function InspectionLab(){
 const [id,setId]=useState(catalog[0].id);
 const asset=catalog.find(a=>a.id===id)!;
 const names=Object.keys(asset.bounds);
 return <main style={{background:'#101719',color:'#f3f3ed',height:'100dvh',display:'flex',fontFamily:'Arial, sans-serif'}}>
 <aside style={{width:330,maxWidth:'44%',padding:23,overflow:'auto',background:'#152023'}}>
 <a href="/" style={{color:'#ddc19e',fontSize:12,textDecoration:'none'}}>← ROOM</a>
 <h2 style={{fontSize:25,marginTop:42,letterSpacing:'-.03em'}}>ASSET INSPECTION<br/>LABORATORY</h2>
 <p style={{fontSize:12,color:'#9eaaa7',lineHeight:1.7}}>Independent GLB model viewer. 1 grid unit = 1 metre. Orange ruler shows 1.8 metres.</p>
 <select value={id} onChange={e=>setId(e.target.value)} style={{width:'100%',padding:12,background:'#283332',color:'#fff',margin:'12px 0'}}>{catalog.map(a=><option key={a.id} value={a.id}>{a.id.replaceAll('_',' ')}</option>)}</select>
 <p style={{fontSize:11}}>CC0 · Poly Haven · {(asset.bytes/1e6).toFixed(2)} MB</p>
 <a href={asset.source} style={{fontSize:11,color:'#dac19f'}} target="_blank">SOURCE ↗</a>
 <h4 style={{color:'#dec29f',fontSize:11,marginTop:25}}>GEOMETRY / {names.length} MESHES</h4>
 {names.map(n=><p key={n} style={{fontSize:10,color:'#c2c9c4',borderBottom:'1px solid #344',paddingBottom:7}}>{n}<br/><b>{(asset.bounds as unknown as Record<string,{dimensions:number[]}>)[n].dimensions.map(v=>v.toFixed(2)).join(' × ')} m</b></p>)}
 </aside>
 <section style={{flex:1,position:'relative'}}>
 <Canvas key={id} camera={{position:[3,2.5,5],fov:55,near:.03,far:200}} gl={{antialias:true}}>
 <color attach="background" args={['#202c30']}/><hemisphereLight intensity={1.6}/><directionalLight position={[5,8,4]} intensity={3}/>
 <Suspense fallback={null}><Model id={id}/></Suspense>
 <Grid infiniteGrid sectionSize={1} cellSize={.5} fadeDistance={25}/>
 <axesHelper args={[1.5]}/>
 <mesh position={[1.4,.9,0]}><cylinderGeometry args={[.011,.011,1.8,8]}/><meshBasicMaterial color="orange"/></mesh>
 <OrbitControls makeDefault target={[0,1,0]}/>
 </Canvas>
 <div style={{position:'absolute',bottom:16,right:16,fontSize:10,letterSpacing:'.1em',pointerEvents:'none'}}>R3F / ORBIT · SCROLL TO ZOOM</div>
 </section>
 </main>;
}

