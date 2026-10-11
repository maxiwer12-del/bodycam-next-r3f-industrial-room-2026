import * as THREE from 'three';

/**
 * ORCA Bistro's packed _Specular textures use G for roughness and B for
 * metalness. glTF conversion retains the maps. Calibration adjusts only the
 * physical multipliers for known non-metal surfaces; all source KTX2 images
 * and their spatial detail remain untouched.
 *
 * Some upstream normal textures use DirectX Y. Apply the Y correction ONCE
 * per material; previous per-mesh traversal flipped shared materials back
 * and forth depending on how many meshes used them.
 */
const calibrated=new WeakSet<THREE.Material>();
export function calibrateBistroMaterial(material:THREE.Material):void {
 if(calibrated.has(material))return;
 calibrated.add(material);
 if(!(material instanceof THREE.MeshStandardMaterial))return;
 const name=(material.name||'').toLowerCase();
 if(material.normalMap)material.normalScale.y=-Math.abs(material.normalScale.y);
 const road=/^pavement_/.test(name);
 const wetRoad=road&&/wet|ground_wet/.test(name);
 if(road){
  // Cobblestones, curbs and asphalt aren't metallic, even if legacy packed
  // specular map channels contain stray high blue values.
  material.metalness=0;
  material.roughness=Math.max(material.roughness,wetRoad?.84:.96);
  material.envMapIntensity=wetRoad?.38:.24;
 }else if(/^(master_concrete|concrete\d*|master_brick_|master_wood_painted|plaster|balcony_concrete)/.test(name)){
  material.metalness=0;
  material.roughness=Math.max(material.roughness,.78);
  material.envMapIntensity=.44;
 }else{
  material.envMapIntensity=.68;
 }
 material.needsUpdate=true;
}
