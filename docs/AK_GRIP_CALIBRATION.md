# BODYCAM NEXT — AK-74M grip and viewmodel orientation

This iteration corrects the existing **Cransh AK-74M and original skinned arms**. No new project, Three.js replacement, primitive substitute, or modifications to the Bistro map.

## Root cause

The imported glTF contains transforms inherited from Sketchfab/FBX. After mesh normalization the previous `rotation(-0.03, π, 0)` put the rifle along a nearly vertical axis in camera space and made forearms look like detached spheres. Shifting viewmodel position without repairing orientation could not fix the hold.

## Solution

`src/game/BistroViewmodelProfile.ts` stores empirically calibrated camera-relative hip and ADS profiles from *real running WebGL renderings*, not stock screenshots. `src/game/BistroCombat.tsx` rotates the **entire model containing AK + both hands**, preserving the original artist rig and its animation weights. Smooth quaternion interpolation avoids Euler snap. Model scale and position interpolate with ADS while returning to the existing pistol/shotgun transforms when switching. No global materials, PBR settings or city geometry are modified.

Hip: `position (0.25,-0.17,-0.78)`, `rotation (-0.80,-0.65,0)`, `scale .95 of prior normalized`.
ADS: `position (0.31,-0.035,-0.81)`, `rotation (-0.55,-0.65,0)`, `scale .92 of prior normalized`.

## Validated and pending

* `npx tsc --noEmit` passes.
* `node research/validate-ak-grip.mjs` checks the actual skinned rig, idle stability, ADS transition, and pistol/shotgun regression. It captures frames rendered by Chromium, not the original Bistro reference.
* Results are from an isolated WebGL viewmodel test; neither desktop city-loading nor iPhone 16 Pro/S24 GPU performance is established by this test. The resulting deployment is a **preview only** and should not replace the previously accepted version without human review.
