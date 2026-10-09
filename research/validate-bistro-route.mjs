import fs from 'node:fs';
import * as T from 'three';
import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';
const shift=new T.Vector3(-4,0,-2.4);
const names=['BistroExterior','BistroInterior'];
const tracked=[];
function parse(name){
 const root='research/large-bistro/Bistro/'+name+'.';
 const g=JSON.parse(fs.readFileSync(root+'gltf')); const bin=fs.readFileSync(root+'bin');
 const parent=g.nodes[g.scenes[0].nodes[0]];
 const pm=new T.Matrix4().compose(new T.Vector3(...(parent.translation||[0,0,0])),new T.Quaternion(...(parent.rotation||[0,0,0,1])),new T.Vector3(...(parent.scale||[1,1,1])));
 pm.setPosition(new T.Vector3().setFromMatrixPosition(pm).add(shift));
 const sourceBounds=JSON.parse(fs.readFileSync('research/bistro-'+(name==='BistroExterior'?'exterior':'interior')+'-worldbounds.json'));
 const region=new T.Box3(new T.Vector3(-11,-2,-10),new T.Vector3(-1,5,3));
 const aType={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
 const item=(i)=>{let a=g.accessors[i],v=g.bufferViews[a.bufferView];if(a.sparse)throw Error('sparse');let constructor=aType[a.componentType];let n=a.type==='VEC3'?3:1;let offset=(v.byteOffset||0)+(a.byteOffset||0);if(v.byteStride&&v.byteStride!==n*constructor.BYTES_PER_ELEMENT)throw Error('interleaved '+i);return new constructor(bin.buffer,bin.byteOffset+offset,a.count*n)};
 for(let e of sourceBounds){
  const world=new T.Box3(new T.Vector3(...e.min),new T.Vector3(...e.max)).translate(shift);
  if(!region.intersectsBox(world))continue;
  let n=g.nodes[e.i],m=g.meshes[n.mesh],matNames=m.primitives.map(p=>g.materials[p.material]?.name||'');
  for(let p of m.primitives){
   if(!p.attributes.POSITION)continue;
   let geometry=new T.BufferGeometry();
   geometry.setAttribute('position',new T.BufferAttribute(item(p.attributes.POSITION),3));
   if(p.indices!==undefined)geometry.setIndex(new T.BufferAttribute(item(p.indices),1));
   geometry.computeBoundingSphere();
   let mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));
   const cm=new T.Matrix4().compose(new T.Vector3(...(n.translation||[0,0,0])),new T.Quaternion(...(n.rotation||[0,0,0,1])),new T.Vector3(...(n.scale||[1,1,1])));
   mesh.matrixAutoUpdate=false;mesh.matrixWorld.multiplyMatrices(pm,cm);mesh.raycast=acceleratedRaycast;
   const material=g.materials[p.material]?.name||'';
   if(/MASTER_Bistro_Main_Door/i.test(material)){
     const attr=geometry.attributes.position,indices=geometry.index?.array,at=i=>indices?indices[i]:i,keep=[],v=[new T.Vector3(),new T.Vector3(),new T.Vector3()];
     let removed=0;
     const len=indices?.length??attr.count;
     for(let j=0;j<len;j+=3){
       const idx=[at(j),at(j+1),at(j+2)];
       for(let k=0;k<3;k++)v[k].fromBufferAttribute(attr,idx[k]).applyMatrix4(mesh.matrixWorld);
       const pt=v[0].clone().add(v[1]).add(v[2]).multiplyScalar(1/3);
       const dx=pt.x+5.26,dz=pt.z+4.1;
       const along=Math.abs(dx*.42+dz*.91),depth=Math.abs(dx*-.91+dz*.42);
       if(along<.88&&depth<.72&&pt.y>.38&&pt.y<2.95){removed++;continue}
       keep.push(...idx);
     }
     geometry.setIndex(keep);
     if(removed>0)console.log('CARVED_ORIGINAL_DOOR',name,n.name,removed);
   }
   const t=geometry.index?.count?geometry.index.count/3:geometry.attributes.position.count/3;
   if(t<180000){geometry.boundsTree=new MeshBVH(geometry,{maxLeafTris:32})}
   tracked.push({name:name+':'+n.name,mat:g.materials[p.material]?.name,mesh,box:world,triangles:t});
  }
 }
}
for(const n of names)parse(n);
console.log('ROUTE_CANDIDATES',tracked.length,'triangles',tracked.reduce((s,a)=>s+a.triangles,0));
function hitRay(origin,direction,far,ground=false){
 const ray=new T.Raycaster(origin,direction,0,far),res=[];
 for(const obj of tracked){
  if(ground&&(origin.x<obj.box.min.x||origin.x>obj.box.max.x||origin.z<obj.box.min.z||origin.z>obj.box.max.z))continue;
  if(!ground&&!obj.box.clone().expandByScalar(.6).intersectsBox(new T.Box3().setFromCenterAndSize(origin.clone().addScaledVector(direction,far/2),new T.Vector3(far+1,3,far+1))))continue;
  for(const hit of ray.intersectObject(obj.mesh,false).slice(0,4)){
   const norm=hit.face?.normal?.clone().transformDirection(hit.object.matrixWorld);if(!norm)continue;
   if(ground&&Math.abs(norm.y)<.77)continue;
   res.push({at:hit.point.toArray().map(x=>+x.toFixed(2)),distance:+hit.distance.toFixed(2),name:obj.name,mat:obj.mat,norm:norm.toArray().map(x=>+x.toFixed(2))});
  }
 }
 return res.sort((a,b)=>a.distance-b.distance);
}
for(let x of [-8,-7,-6,-5,-4,-3,-2])for(let z of [-7,-5,-4,-3,-1]){
 let hit=hitRay(new T.Vector3(x,3.7,z),new T.Vector3(0,-1,0),5.3,true).find(h=>h.at[1]<2);
 console.log('FLOOR',x,z,hit?.at[1]??null,hit?.mat?.slice(0,40)??'none');
}
const outside=new T.Vector3(-7.4,1.45,-3.32),inside=new T.Vector3(-3.1,1.45,-4.95),dir=inside.clone().sub(outside),len=dir.length();dir.normalize();
console.log('DOOR_CROSSING_RAY',JSON.stringify(hitRay(outside,dir,len+1).slice(0,25),null,2));
