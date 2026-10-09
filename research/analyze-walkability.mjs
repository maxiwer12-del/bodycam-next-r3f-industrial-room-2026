import{NodeIO}from'@gltf-transform/core';import{ALL_EXTENSIONS}from'@gltf-transform/extensions';import{getBounds}from'@gltf-transform/functions';import*as THREE from'three';
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read('public/maps/bistro-zone/scene.gltf');
const points=[];for(let x=-12;x<=12;x+=3)for(let z=-12;z<=12;z+=3)points.push([x,z]);
const containers=[];
for(const n of doc.getRoot().listNodes()){
 if(!n.getMesh())continue;
 const b=getBounds(n);
 if(b.min[1]>3||b.max[1]<0||b.max[0]<-12.2||b.min[0]>12.2||b.max[2]<-12.2||b.min[2]>12.2)continue;
 const included=points.some(([x,z])=>b.min[0]<=x&&b.max[0]>=x&&b.min[2]<=z&&b.max[2]>=z);
 if(!included)continue;
 const parts=[];
 for(const p of n.getMesh().listPrimitives()){
  const position=p.getAttribute('POSITION');if(!position)continue;
  const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.BufferAttribute(position.getArray(),3));
  if(p.getIndices())geom.setIndex(new THREE.BufferAttribute(p.getIndices().getArray(),1));
  const mesh=new THREE.Mesh(geom,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  mesh.matrixAutoUpdate=false;mesh.matrixWorld.fromArray(n.getWorldMatrix());
  mesh.updateMatrixWorld(false);
  parts.push(mesh);
 }
 containers.push({name:n.getName(),box:b,parts});
}
console.log('CANDIDATE_MESH_NODES',containers.length);
const sampled=[];
for(const [x,z]of points){
 const ray=new THREE.Raycaster(new THREE.Vector3(x,2.75,z),new THREE.Vector3(0,-1,0),0,4);
 let intersections=[];
 for(const obj of containers){
  if(x<obj.box.min[0]||x>obj.box.max[0]||z<obj.box.min[2]||z>obj.box.max[2])continue;
  for(const mesh of obj.parts)intersections.push(...ray.intersectObject(mesh,false));
 }
 intersections.sort((a,b)=>a.distance-b.distance);
 const hit=intersections[0];
 let slope=null;
 if(hit?.face){
 const n=hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
 slope=Math.round(Math.acos(Math.min(1,Math.max(-1,Math.abs(n.y))))*180/Math.PI);
 }
 sampled.push({x,z,groundY:hit?+hit.point.y.toFixed(2):null,slope,name:hit?.object?.name||null,n:intersections.length});
}
const walk=sampled.filter(s=>s.groundY!==null&&s.groundY>=-.2&&s.groundY<=1.2&&(s.slope??90)<=23);
console.log('WALKABLE_SAMPLES',walk.length,'OF',sampled.length);
console.log('VALID',JSON.stringify(walk.slice(0,40)));
console.log('INVALID',JSON.stringify(sampled.filter(s=>!walk.includes(s)).slice(0,40)));

import fs from 'node:fs';
const key=(p)=>p.x+','+p.z;
const byKey=new Map(walk.map(p=>[key(p),p]));
const visited=new Set(),components=[];
for(const p of walk){
 if(visited.has(key(p)))continue;
 const queue=[p],group=[];visited.add(key(p));
 for(let i=0;i<queue.length;i++){
  const current=queue[i];group.push(current);
  for(const [dx,dz]of[[3,0],[-3,0],[0,3],[0,-3]]){
   const n=byKey.get((current.x+dx)+','+(current.z+dz));
   if(!n||visited.has(key(n))||Math.abs(n.groundY-current.groundY)>.56)continue;
   queue.push(n);visited.add(key(n));
  }
 }
 components.push(group);
}
components.sort((a,b)=>b.length-a.length);
const report={total:sampled.length,walkable:walk.length,connectedComponents:components.map(g=>g.length),largest:components[0],all:sampled};
fs.writeFileSync('data/bistro-walkability.json',JSON.stringify(report,null,2));
console.log('CONNECTED_ROUTE_COMPONENTS',JSON.stringify(components.map(g=>g.length)));
console.log('SPAWN_CHOICES',JSON.stringify(components[0].filter(p=>Math.abs(p.x)<=9&&Math.abs(p.z)<=9).slice(0,16)));
