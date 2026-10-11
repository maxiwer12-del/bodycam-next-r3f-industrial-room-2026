import * as THREE from 'three';

/**
 * Adapt the original Cransh AK-74M FP arm glTF, never replacing its animated
 * gloves or firearm. The imported sleeve shells terminate in large hemispheric
 * elbow caps in front of the camera. They are separate mesh islands, so we
 * can isolate the two REAL textured cloth surfaces without touching any
 * skinned wrist/hand/finger geometry or animation weights.
 *
 * Each original cloth sleeve is laid onto a camera-local forearm path whose
 * lower end is outside the viewport, then attached to its original IK hand.
 * Their source UVs, triangles, and licensed fabric texture are retained.
 */
export function buildFpsSleeves(original:THREE.SkinnedMesh):{
 sleeves:{mesh:THREE.Mesh;side:number}[];vertices:number
}{
 const source=original.geometry;
 const pos=source.getAttribute('position') as THREE.BufferAttribute;
 const idx=source.getIndex();
 if(!pos||!idx)throw Error('Animated source arms have no indexed geometry');
 const parent=new Int32Array(pos.count);
 for(let i=0;i<parent.length;i++)parent[i]=i;
 const find=(v:number):number=>{
  while(parent[v]!==v){parent[v]=parent[parent[v]];v=parent[v]}
  return v;
 };
 for(let i=0;i<idx.count;i+=3){
  const a=find(idx.getX(i)),b=find(idx.getX(i+1)),c=find(idx.getX(i+2));
  parent[b]=a;
  parent[c]=a;
 }
 const islands=new Map<number,number[]>();
 for(let i=0;i<pos.count;i++){
  const root=find(i);
  const group=islands.get(root)||[];
  group.push(i);
  islands.set(root,group);
 }
 // The two imported cloth sleeves each have 743 vertices, original arms.glTF.
 const cloth=[...islands.values()].filter(group=>{
  if(group.length<650||group.length>950)return false;
  let lo=Infinity,hi=-Infinity;
  for(const v of group){
   const z=pos.getZ(v);
   lo=Math.min(lo,z);hi=Math.max(hi,z);
  }
  return lo<-.04&&hi<.33;
 });
 if(cloth.length!==2)throw Error('Cannot separate two authentic first-person sleeves');
 const sleeveGroups=new Map<number,{side:number;vertices:number[];indices:number[]}>();
 for(const vertices of cloth){
  const avgX=vertices.reduce((total,v)=>total+pos.getX(v),0)/vertices.length;
  const side=avgX>0?1:-1;
  sleeveGroups.set(find(vertices[0]),{side,vertices,indices:[]});
 }
 const keep:number[]=[];
 for(let i=0;i<idx.count;i+=3){
  const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2);
  const sleeve=sleeveGroups.get(find(a));
  if(sleeve)sleeve.indices.push(a,b,c);
  else keep.push(a,b,c);
 }
 // Original mesh keeps the artist's skinned gloves, wrists and all fingers.
 const gloved=source.clone();
 gloved.setIndex(keep);
 original.geometry=gloved;
 original.frustumCulled=false;
 const sleeves:{mesh:THREE.Mesh;side:number}[]=[];
 for(const {side,vertices,indices} of sleeveGroups.values()){
  const sleeveGeometry=source.clone();
  sleeveGeometry.setIndex(indices);
  const p=sleeveGeometry.getAttribute('position') as THREE.BufferAttribute;
  const centerX=side*.232,centerY=.045;
  for(const vertex of vertices){
   const x=pos.getX(vertex),y=pos.getY(vertex),z=pos.getZ(vertex);
   const t=THREE.MathUtils.clamp((.311-z)/.393,0,1);
   // Retain original cloth cross section; sweep its length towards an elbow
   // outside the frame. x/y at each ring provide actual authored wrinkles.
   p.setXYZ(vertex,
    -side*.24*t+(x-centerX)*(.62+.17*t),
    -.74*t,
    .10*t+(y-centerY)*.50
   );
  }
  p.needsUpdate=true;
  sleeveGeometry.computeVertexNormals();
  sleeveGeometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(sleeveGeometry,original.material);
  mesh.name=side>0?'FPS_LeftSleeve':'FPS_RightSleeve';
  mesh.castShadow=false;
  mesh.receiveShadow=false;
  mesh.frustumCulled=false;
  sleeves.push({mesh,side});
 }
 return {sleeves,vertices:cloth.reduce((total,component)=>total+component.length,0)};
}
