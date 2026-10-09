import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export type BistroBatchReport={sourceMeshes:number;mergedMeshes:number;hiddenMeshes:number;retainedMeshes:number};
type BatchPart={mesh:THREE.Mesh;material:THREE.Material};
const LIMIT=32;

/** Static opaque mesh batching. Materials/PBR stay intact, while all original
 * triangle geometry remains available to BVH collisions, hidden from rendering.
 * Glass, alpha cutouts and physically transmissive surfaces keep per-mesh
 * sorting and original geometry. Meshes are merged in world coordinates. */
export function batchBistroStaticGeometry(root:THREE.Group):{
 visuals:THREE.Group;report:BistroBatchReport
}{
 root.updateMatrixWorld(true);
 const groups=new Map<string,BatchPart[]>();
 const report:BistroBatchReport={sourceMeshes:0,mergedMeshes:0,hiddenMeshes:0,retainedMeshes:0};
 root.traverse(node=>{
  if(!(node instanceof THREE.Mesh))return;
  report.sourceMeshes++;
  const mesh=node,geometry=mesh.geometry;
  const mat=Array.isArray(mesh.material)?null:mesh.material;
  if(!mat||!geometry||geometry.morphAttributes?.position?.length||geometry.groups.length>1||mesh.isSkinnedMesh){
   report.retainedMeshes++;return;
  }
  const physical=mat instanceof THREE.MeshPhysicalMaterial;
  if(!(mat instanceof THREE.MeshStandardMaterial)||mat.transparent||mat.opacity<.999||mat.alphaTest>0||
     mat.side===THREE.DoubleSide||(physical&&mat.transmission>0)){
   report.retainedMeshes++;return;
  }
  const attrs=Object.entries(geometry.attributes);
  if(attrs.some(([,a])=>a.isInterleavedBufferAttribute||a.itemSize<=0)){
   report.retainedMeshes++;return;
  }
  const signature=attrs.map(([name,a])=>name+':'+a.itemSize+':'+a.normalized+':'+a.array.constructor.name).sort().join('|');
  const key=mat.uuid+'--'+(geometry.index?'indexed':'nonindexed')+'--'+signature;
  const list=groups.get(key)||[];
  list.push({mesh,material:mat});groups.set(key,list);
 });
 const visuals=new THREE.Group();
 visuals.name='BistroOpaqueRenderBatches';
 let number=0;
 for(const list of groups.values()){
  for(let n=0;n<list.length;n+=LIMIT){
   const parts=list.slice(n,n+LIMIT);
   if(parts.length<2){report.retainedMeshes+=parts.length;continue;}
   const temporary:THREE.BufferGeometry[]=[];
   try{
    for(const item of parts)temporary.push(item.mesh.geometry.clone().applyMatrix4(item.mesh.matrixWorld));
    const merged=mergeGeometries(temporary,false);
    if(!merged){report.retainedMeshes+=parts.length;continue;}
    merged.computeBoundingSphere();merged.computeBoundingBox();
    const m=new THREE.Mesh(merged,parts[0].material);
    m.name='BistroOpaqueBatch_'+number++;
    m.castShadow=parts.some(x=>x.mesh.castShadow);
    m.receiveShadow=parts.some(x=>x.mesh.receiveShadow);
    m.frustumCulled=true;
    m.userData.bistroRenderOnly=true;
    visuals.add(m);
    for(const item of parts)item.mesh.visible=false;
    report.hiddenMeshes+=parts.length;
    report.mergedMeshes++;
   }catch(e){
    console.warn('BISTRO_STATIC_BATCH_SKIPPED',String(e).slice(0,170));
    report.retainedMeshes+=parts.length;
   }finally{for(const g of temporary)g.dispose();}
  }
 }
 return {visuals,report};
}
