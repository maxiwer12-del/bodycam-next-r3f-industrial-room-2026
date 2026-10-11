# BODYCAM NEXT — AK-74M muzzle direction and first-person grip

## Problem and root cause

The October 11 city screenshot showed the round muzzle facing the viewer, not the street. The glTF scene contains Sketchfab/FBX hierarchy rotations that are nontrivial to normalize. Earlier hip pose `pitch:-0.58, yaw:-0.30` placed the source AK's positive-Z muzzle at camera-space z≈-0.35, while the stock was farther away at z≈-0.87. The muzzle therefore faced the player even though both gloves were attached.

## Corrected pose

The original **Cransh** AK-74M, magazine and both skinned arms remain one animation hierarchy. No separate wrist/bone rotations, primitives, changes to city geometry, or additional weapons are introduced.

- Hip: camera-space position `(0.15, 0.02, -0.67)`, rotation Euler XYZ `(0.40, -2.90, -0.02)`, normalized scale `1.05`.
- ADS: position `(0.08, 0.10, -0.74)`, rotation `(0.44, -2.95, -0.02)`, normalized scale `1.02`.
- Smooth quaternion interpolation and authored shot/reload/idle clips are retained.
- The source weapon muzzle has positive local mesh Z, the butt has negative mesh Z. The QA snapshot `barrel` transforms skinned mesh samples into camera coordinates; correct orientation requires `muzzle.z < stock.z` in both hip and ADS. Visual WebGL calibration and 3D point checks were performed on the real model rather than a placeholder.
- AK-74M is the **only** available weapon. The old Pistol/Shotgun UI, keys and loader paths remain disabled.

## Validation

Run `npx tsc --noEmit`, a production `next build --webpack`, then `GRIP_TEST_URL=http://localhost:3041 node research/validate-ak-grip.mjs`. The browser QA captures actual skinned WebGL frames and asserts that the muzzle is further downrange in hip and ADS, that both hands are present and that keys 2/3 do not change weapons. For final acceptance, inspect the full city on target devices, including firing and ADS.
