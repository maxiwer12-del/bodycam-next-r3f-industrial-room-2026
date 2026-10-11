/**
 * Authored AK-74M + arms visual pose, calibrated from *our running WebGL game*
 * against the original Cransh skinned glTF (not the screenshots of original Bistro).
 *
 * Source glTF rotates its long barrel axis through a Sketchfab/FBX hierarchy;
 * a naive yaw=Math.PI leaves the rifle vertical and the gloved hands ballooned
 * toward the lens. Transform the entire existing skinned hierarchy together.
 * All values are camera-space meters, radians (Euler XYZ), and unitless scale.
 * No per-hand bone shifts: the original licensed artist's grip stays intact.
 */
export type ViewmodelPose={
 x:number;y:number;z:number;
 pitch:number;yaw:number;roll:number;
 scale:number;
};
export const AK_VIEWMODEL_POSES:Readonly<{
 hip:Readonly<ViewmodelPose>;
 ads:Readonly<ViewmodelPose>;
}>=Object.freeze({
 hip:Object.freeze({
  x:.26,y:-.16,z:-.84,
  pitch:-.58,yaw:-.30,roll:-.02,
  scale:.95
 }),
 ads:Object.freeze({
  x:.14,y:-.06,z:-.88,
  pitch:-.55,yaw:-.16,roll:0,
  scale:.92
 })
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
  pitch:blend(a.pitch,b.pitch),yaw:blend(a.yaw,b.yaw),
  roll:blend(a.roll,b.roll),scale:blend(a.scale,b.scale)
 };
}
