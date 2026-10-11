# BODYCAM NEXT: AK stability, sprint and skill bunnyhop

Implementation: \`fix/ak-stability-sprint-bhop-2026\` (derived from the existing \`fix/realistic-fps-rig-ads\` branch). Three.js, React Three Fiber and all original Bistro environment assets are preserved.

## Root cause and FPS rig changes

The FPS arm animation controller previously selected the source \`Walk\` and \`Run\` clips on camera movement thresholds. The imported animation transforms have much larger motion than is suitable for a camera-attached viewmodel and the movement estimator also included camera height changes caused by street snapping. This produced an unstable weapon pose and a large swing while walking.

- Viewmodel locomotion now keeps the **licensed authored AK Idle clip** as the stable base, with more controlled time scale. Actual \`Shot\` and \`Reload\` clips remain connected.
- Fully automatic gunfire no longer resets an already-playing shot clip every 115 ms. Ballistics and subtle procedural kick remain independent.
- Large walking sway and bob have been reduced to millimetre-scale, driven by the actual horizontal movement velocity rather than camera displacement or jump height.
- AK model normalization grows from an effective 0.91 scene unit to 1.70; the camera-space profile moves the rifle higher and more centrally. ADS interpolates smoothly instead of abruptly jumping FOV from any nonzero blend factor.
- The imported \`Mag_2\` secondary magazine mesh no longer floats below the gun in idle; it is visible only during the appropriate reload interval.

This work is not a newly fabricated low-poly rifle: it keeps the original licensed AK-74M skinned viewmodel.

## Player movement and controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Walk | WASD | Left virtual joystick |
| Sprint | Hold Shift | Hold RUN |
| Jump | **Fresh** Space key press | **Fresh** tap JUMP |
| Look around | Mouse | Drag on right half |
| Aim | Right mouse | ADS toggle |
| Fire | Left click / FIRE | FIRE |
| Reload | R | R |
| Weapon selection | 1/2/3 | Weapon selector |

Skill movement: Gravity, true upward jumps, ground support sampled from **original Bistro collider triangles**, wall contact and axis sliding. No jumping through walls or freely moving beyond the geometric street. Walk ~2.75 m/s; sprint ~4.75 m/s. Hop momentum is rewarded only when **each jump uses a fresh input press** within 110 ms after landing, or a buffered press within 85 ms before landing, while sprinting and steering. Missing the window resets the hop chain. Air strafing is weaker than grounded acceleration. Speed is capped at 7.1 m/s and cannot increase without limit by holding Space.

Camera height remains coupled to real road/interior floors; the system does not build a new primitive ground mesh or restore the old invisible MAX_DISTANCE=13 box.

## Verification

- \`npx tsc --noEmit\` — pass.
- \`node research/validate-bhop.mjs\` — six automated cases passed (walk/sprint speeds, one jump on held Space, timed hop chaining, mistimed chain reset, 30 Hz integration, no crossing a missing physical floor).
- Chromium software WebGL production-style test confirmed the actual city loaded and Shift sprint, Space jump, held Space anti-autojump passed. The local test environment initially did not include its linked \`/basis\` directory, resulting in missing optional texture-transcoder requests; these do not establish a problem in the published Vercel build.
- Source runtime \`__URBAN_QA__.movement()\` reports speed, grounded status, chain count and jump total for repeatable checks.

## Remaining acceptance

- Inspect new preview on iPhone 16 Pro and Galaxy S24 in both High and Cinematic Max; measure actual FPS and verify no GPU crashes.
- Compare fixed screen angles for AK placement, ADS alignment, muzzle flash and reload motion before production.
- The enemy rig and optional weapons are unchanged beyond preserving the existing build. This is an isolated movement/viewmodel repair, not a new production approval.
