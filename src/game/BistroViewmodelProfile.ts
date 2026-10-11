/**
 * Authored AK-74M + arms visual pose, calibrated from *our running WebGL game*
 * against the original Cransh skinned glTF (not the screenshots of original Bistro).
 *
 * The source AK barrel extends along its GLTF mesh's positive-Z direction.
 * Verify the skinned muzzle is farther along camera -Z than the stock:
 * the previous hip (-0.58, -0.30, -0.02) pointed the muzzle at the player.
 * Rotate AK + both hands as one skinned unit to preserve their authored grip.
 * Hip keeps the stock at the player's lower right, facing downrange.
 * ADS was solved from real rear/front sight vertices: they project to camera
 * centre within 0.004 in normalized x/z and y/z. Only the authored full rig
 * moves; the fingers and wrists retain their licensed animations.
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
  x:.13,y:-.06,z:-.45,
  pitch:.20,yaw:-3.10,roll:-.02,
  scale:1.13
 }),
 ads:Object.freeze({
  x:-.114,y:.243,z:-.62,
  pitch:-.0255,yaw:-3.1751,roll:-.02,
  scale:1.05
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
