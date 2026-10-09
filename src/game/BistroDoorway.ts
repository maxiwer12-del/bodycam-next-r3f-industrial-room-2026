import * as THREE from 'three';

/**
 * The benchmark includes CLOSED door-leaf triangles at the cafe entry.
 * Remove only triangles of the existing Bistro door-leaf material inside the
 * measured door swing envelope, retaining adjacent frame, signage and masonry.
 * This is a geometry edit on licensed source assets, not a black "door" quad.
 */
const portalCenter=new THREE.Vector3(-5.26,0,-4.1);
const tangent=new THREE.Vector3(.42,0,.91).normalize();
const outward=new THREE.Vector3(-.91,0,.42).normalize();
const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),mid=new THREE.Vector3();
export interface DoorCutReport {meshCount:number;removedTriangles:number;totalTriangles:number}
export function carveBistroEntrance(root:THREE.Object3D):DoorCutReport{
 const report:DoorCutReport={meshCount:0,removedTriangles:0,totalTriangles:0};
 root.updateMatrixWorld(true);
 root.traverse(object=>{
  if(!(object instanceof THREE.Mesh))return;
  const mats=Array.isArray(object.material)?object.material:[object.material];
  if(!mats.some(m=>/MASTER_Bistro_Main_Door/i.test(m?.name||'')))return;
  const geo=object.geometry;
  const pos=geo.getAttribute('position');
  if(!pos)return;
  const indices=geo.index?.array;
  const sourceIndex=(i:number)=>indices?indices[i]:i;
  const count=indices?.length??pos.count;
  if(count%3!==0)return;
  const keep:number[]=[];
  let removed=0;
  for(let i=0;i<count;i+=3){
   const x=sourceIndex(i),y=sourceIndex(i+1),z=sourceIndex(i+2);
   a.fromBufferAttribute(pos,x).applyMatrix4(object.matrixWorld);
   b.fromBufferAttribute(pos,y).applyMatrix4(object.matrixWorld);
   c.fromBufferAttribute(pos,z).applyMatrix4(object.matrixWorld);
   mid.copy(a).add(b).add(c).multiplyScalar(1/3).sub(portalCenter);
   const horizontal=Math.abs(mid.dot(tangent));
   const depth=Math.abs(mid.dot(outward));
   const betweenFloorAndLintel=mid.y>.38&&mid.y<2.95;
   if(horizontal<.88&&depth<.72&&betweenFloorAndLintel){removed++;continue}
   keep.push(x,y,z);
  }
  report.totalTriangles+=count/3;
  if(!removed)return;
  geo.setIndex(keep);
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  report.meshCount++;
  report.removedTriangles+=removed;
 });
 return report;
}
