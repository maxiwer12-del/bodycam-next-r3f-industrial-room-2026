import fs from 'node:fs';import * as THREE from 'three';
const p='research/large-bistro/Bistro/BistroExterior.gltf';const g=JSON.parse(fs.readFileSync(p));
const bbox = new THREE.Box3(),boxes=[],pos=new THREE.Vector3(),quat=new THREE.Quaternion(),scale=new THREE.Vector3(),matrix=new THREE.Matrix4();
for(let i=0;i<g.nodes.length;i++){
 const n=g.nodes[i];if(n.mesh==null)continue;
 let local=new THREE.Box3();
 for(const primitive of g.meshes[n.mesh].primitives||[]){
  const accessor=g.accessors[primitive.attributes.POSITION];
  if(accessor?.min&&accessor?.max)local.union(new THREE.Box3(new THREE.Vector3(...accessor.min),new THREE.Vector3(...accessor.max)));
 }
 if(local.isEmpty())continue;
 pos.fromArray(n.translation||[0,0,0]);quat.fromArray(n.rotation||[0,0,0,1]);scale.fromArray(n.scale||[1,1,1]);
 matrix.compose(pos,quat,scale);
 let box=local.clone().applyMatrix4(matrix);bbox.union(box);
 boxes.push({index:i,name:n.name,center:box.getCenter(new THREE.Vector3()).toArray(),size:box.getSize(new THREE.Vector3()).toArray(),boxMin:box.min.toArray(),boxMax:box.max.toArray(),mesh:n.mesh});
}
fs.writeFileSync('research/bistro-bounds.json',JSON.stringify(boxes));
console.log('GLOBAL',bbox.min.toArray(),bbox.max.toArray(),'size',bbox.getSize(new THREE.Vector3()).toArray());
console.log('NODES',boxes.length,'ROOT_COUNT',g.scenes[0].nodes.length,'TEXTURES',g.images.length);
console.log('LARGEST BY 3D DIAGONAL');
for(const b of boxes.toSorted((a,b)=>Math.hypot(...b.size)-Math.hypot(...a.size)).slice(0,24))console.log(b.index,b.name,b.center.map(x=>x.toFixed(1)),b.size.map(x=>x.toFixed(1)));
for(const axis of [0,1,2]){
 const a=boxes.map(x=>x.center[axis]),sorted=a.toSorted((a,b)=>a-b);
 console.log('AXIS',axis,'minmax',sorted[0],sorted.at(-1),'quartiles',[0.1,.25,.5,.75,.9].map(q=>sorted[Math.floor(sorted.length*q)].toFixed(2)));
}

