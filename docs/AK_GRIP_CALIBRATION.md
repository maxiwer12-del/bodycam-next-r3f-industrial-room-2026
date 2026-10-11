# BODYCAM NEXT — AK-74M muzzle direction and first-person grip

## Problem and root cause

The October 11 city screenshot showed the round muzzle facing the viewer, not the street. The glTF scene contains Sketchfab/FBX hierarchy rotations that are nontrivial to normalize. Earlier hip pose `pitch:-0.58, yaw:-0.30` placed the source AK's positive-Z muzzle at camera-space z≈-0.35, while the stock was farther away at z≈-0.87. The muzzle therefore faced the player even though both gloves were attached.

## Corrected pose

The original **Cransh** AK-74M, magazine and both skinned arms remain one animation hierarchy. No separate wrist/bone rotations, primitives, changes to city geometry, or additional weapons are introduced.

- Hip: camera-space position `(0.13, -0.06, -0.45)`, rotation Euler XYZ `(0.20, -3.10, -0.02)`, normalized scale `1.13`, camera rig cant `0.40` rad. The stock should fall out of the lower-right HUD rather than appear as a side-on profile.
- ADS: position `(-0.114, 0.243, -0.62)`, rotation `(-0.0255, -3.1751, -0.02)`, normalized scale `1.05`, camera cant `0.30` rad. Numerically calibrated against the ORIGINAL weapon's rear/front iron-sight vertices (nearest source vertex positions `(0,.18,-.07)` and `(0,.201,.84)`), not just the muzzle.
- Smooth quaternion interpolation and authored shot/reload/idle clips are retained.
- The source weapon muzzle has positive local mesh Z, the butt has negative mesh Z. The QA snapshot `barrel` transforms skinned mesh samples into camera coordinates; correct orientation requires `muzzle.z < stock.z` in both hip and ADS. Visual WebGL calibration and 3D point checks were performed on the real model rather than a placeholder.
- AK-74M is the **only** available weapon. The old Pistol/Shotgun UI, keys and loader paths remain disabled.

## Validation

Run `npx tsc --noEmit`, a production `next build --webpack`, then `GRIP_TEST_URL=http://localhost:3041 node research/validate-ak-grip.mjs`. The browser QA captures real WebGL frames and asserts the original skinned muzzle is downrange, the **two iron sights project within 0.035 of the reticle during ADS**, both hands are present, and keys 2/3 do not change weapon. Note: this is an alignment test, not a substitute for visually checking pose quality on the heavy city map. For final acceptance, inspect the full city on target devices, including firing and ADS.
