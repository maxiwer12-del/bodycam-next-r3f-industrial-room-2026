/**
 * Calibrated against actual WebGL screenshots of the authored Bistro AK-74M rig.
 *
 * IMPORTANT: the Sketchfab glTF scene maps the weapon's authored Z axis
 * to world +Y via its import hierarchy. A simple Math.PI yaw and a near-zero
 * pitch leaves the rifle pointed vertically and its hands ballooning toward
 * the lens. Rotate the entire skinned weapon+hands rig together instead.
 *
 * Units are camera-local meters. Angles are Three.js Euler XYZ radians.
 * Never apply a separate corrective transform to wrist bones or gun meshes:
 * the original source animation already contains coordinated grip poses.
 */
export type ViewmodelPose={
 x:number;y:number;z:number;
 pitch:number;yaw:number;roll:number;
 scale:number;
};

export const AK_VIEWMODEL_POSES:Readonly<{
 hip:Readonly<ViewmodelPose>;
 ads:Readonly<ViewmodelPose>;
 secondary:Readonly<Pick<ViewmodelPose,'pitch'|'yaw'|'roll'|'scale'>>;
}>=Object.freeze({
 hip:Object.freeze({
  x:.25,y:-.17,z:-.78,
  pitch:-.8,yaw:-.65,roll:0,
  scale:.95
 }),
 ads:Object.freeze({
  x:.18,y:-.053,z:-.84,
  pitch:-.58,yaw:-.28,roll:0,
  scale:.92
 }),
 // Reuse the original hand-socket profile for secondary weapon attachments.
 secondary:Object.freeze({pitch:-.03,yaw:Math.PI,roll:0,scale:1})
});

export function interpolateViewmodel(
 a:Readonly<ViewmodelPose>,
 b:Readonly<ViewmodelPose>,
 alpha:number
):ViewmodelPose{
 const t=Math.min(1,Math.max(0,alpha));
 const blend=(p:number,q:number)=>p+(q-p)*t;
 return {
  x:blend(a.x,b.x),y:blend(a.y,b.y),z:blend(a.z,b.z),
  pitch:blend(a.pitch,b.pitch),yaw:blend(a.yaw,b.yaw),roll:blend(a.roll,b.roll),
  scale:blend(a.scale,b.scale)
 };
}
