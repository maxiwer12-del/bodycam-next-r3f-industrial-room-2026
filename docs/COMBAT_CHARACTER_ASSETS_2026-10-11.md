# BODYCAM NEXT — combat asset provenance and QA

Branch: `feat/real-character-weapons-animation`. This extends the existing Bistro environment. No new engine or replacement map.

## Licensed external assets used

| Role | Author / provenance | License stated by source | Pinned source |
| --- | --- | --- | --- |
| Animated AK-74M + FPS arms | Cransh, distributed in Ayush Mohanty's FPS-Arms-3D example | **CC BY 4.0**. Must credit Cransh | [FPS AK-74m animations](https://sketchfab.com/3d-models/fps-ak-74m-animations-94be8385c402474cacd39bc096c6ca14), [source license.txt](https://github.com/Ayush-Mohanty/FPS-Arms-3D/blob/c80a452e680c5a27c9e936176eb17e446869529a/Models/fps_ak-74m_animations/license.txt) |
| Alternate rigged FPS hands | wriks / WRAD ARMS | **CC0 1.0** | [source](https://github.com/wwwriks/wrad-arms/tree/f3987244176c33d2c20d4f9e139980af12684d87) |
| Pistol and pump shotgun | fps-asset-kit, OpenGameArt flat weapons pack | **CC0 1.0** stated by kit | [source](https://github.com/petroulacl/fps-asset-kit/tree/a19b7458a593598211c95ec46ef4eb4b6d1f94d7/weapons) |
| Fully-rigged humanoid opponents | Soldier.glb used by three.js example, originally Mixamo Vanguard by T. Choonyung | **Adobe Mixamo asset terms, NOT CC0/MIT**. In-game embedded use only; review restrictions before redistributing standalone assets | [three.js source](https://github.com/mrdoob/three.js/blob/11738a9d55e502fb484cefffcea3a66dc44e9fe9/examples/models/gltf/Soldier.glb) |
| Gunshot samples (AK-47 / 1911 / Mossberg) | Free Firearm Sound Library via fps-asset-kit | **CC0 1.0** stated by kit | [source WAV archive](https://github.com/petroulacl/fps-asset-kit/tree/a19b7458a593598211c95ec46ef4eb4b6d1f94d7/sfx) |

**Required public credit for the CC-BY rifle (copy exactly):**

> This work is based on "FPS AK-74m animations" (https://sketchfab.com/3d-models/fps-ak-74m-animations-94be8385c402474cacd39bc096c6ca14) by Cransh (https://sketchfab.com/ccransh) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/).

## Build and runtime details

`scripts/prepare-combat-assets.mjs` fetches pinned sources, rejects Git LFS pointer text and invalid GLB headers, and converts the animated rifle's texture PNGs to 2048px maximum without changing source PBR material channel semantics. The 2048px limit is only for this new first-person asset, not the Bistro city and its textures. This processing reduces mobile memory compared with shipping original 25+ MB textures. All ref paths are kept in one glTF scene.

`scripts/validate-combat-assets.mjs` verifies GLB headers, animation and skin presence, and each referenced texture/buffer.

`src/game/BistroCombat.tsx` uses THREE SkeletonUtils for correct humanoid cloning, AnimationMixer for authored clips, actual raycastable soldier meshes, damage/knockouts, three weapons with distinct fire/reload parameters, recoil, ADS and sway. `BistroExperience.tsx` contains mouse/keyboard/touch controls.

## Known limitations to verify before acceptance

- The pistol and shotgun have **CC0 retro/flat weapons and hands**, not photorealistic art. They are real licensed meshes, not cubes, but do not yet meet the target high-fidelity quality.
- AK-74M animation clips are selected from original names. If the source lacks `idle`/`fire`/`reload` clips or uses unfamiliar names, inspect the generated `/combat/manifest.json` and retarget the actions before acceptance.
- Hit detection currently raycasts characters without geometry occlusion. Add a city ray hit obstruction test to prevent shooting through walls.
- Soldier opponent death is a runtime fall animation after damage; it is not a vendor-provided ragdoll or motion-captured death.
- No multiplayer, human AI, blood, or licensed reload motion for the secondary weapons is claimed as finished. Real CC0 weapon shots are now cropped to short PCM WAV files and unlocked through Web Audio on the next user gesture; the first tap may be silent while buffers decode.
- Verify the first-person rig geometry orientation, floor contact, muzzle placement, shading, close clipping and GPU memory in running preview.
- Measure High and Cinematic Max on iPhone 16 Pro and Galaxy S24. A successful desktop build is not proof of 30/60 FPS on these devices.

## Staged loading change

Models are loaded **after** the core Bistro world is ready, avoiding simultaneous city and skeleton/2K viewmodel texture decoding. The AK rig and three soldier characters may become playable before pistol/shotgun and CC0 secondary arms have finished downloading. This is a robustness improvement, not evidence of measured mobile FPS. 

## FPS arm, ADS and character upgrade (October 11, 2026)

- The detached WRAD forearms are no longer rendered. The Cransh AK-74M asset provides a single licensed skinned animation rig shared by the rifle, pistol and shotgun. Pistol mode filters the original rig's geometry based on descendants of the right-arm bone; the left arm is not visible. The weapon is positioned relative to the animated right-hand socket.
- Secondary CC0 weapon meshes now come from [Compact Pistol](https://3dassets.dev/assets/tactical-shooter-hill-town-compact-pistol-d527475f) (61 KB GLB) and [Semi Automatic Shotgun](https://3dassets.dev/assets/tactical-shooter-hill-town-semi-auto-shotgun-eed4a083) (82 KB GLB). These assets include real movable slide, magazine and bolt animations; there is no runtime primitive or cube fallback. These assets are CC0 1.0.
- Enemy character variants: [mask, mask_cap, wrap_goggles](https://github.com/StarKnightt/counter-strike-in-browser/tree/92f3e6ddee40c6b531c0788c2cf3db4c56853a37/public/models). Models are skinned GLB meshes with authored Idle/Walk/Run animations. Source includes Mixamo-derived skeleton/animation content; the upstream MIT code license does NOT supersede the third-party animation license.
- `src/game/BistroRigAnimator.ts` crossfades authored idle/walk/run/fire/reload/draw actions and also plays secondary firearm source animations. `src/game/BistroExperience.tsx` renders an actual centered crosshair and the ADS touch toggle. Camera follow/ADS offsets were tuned against real software WebGL screenshots, not stock reference images.
- Technical verification: `npx tsc --noEmit` PASS; Next.js Webpack build PASS. In headless Chromium software WebGL, `research/qa-combat-interactions-local.mjs` verified AK fire/reload, pistol single-hand geometry/fire, shotgun fire and touch ADS without console errors. The main Bistro scene separately loaded 146 map meshes and 3 skinned operative models, but the full-city automation starved under software rendering (renderer over 2 GB RSS), so **full-city frame capture and mobile FPS have NOT been verified**.
- This is a visual/control upgrade, not a complete motion-captured tactical animation set. Mobile iPhone 16 Pro and Galaxy S24 performance, physical two-hand IK on shotgun, occlusion-aware bullet collision, and hero-quality character art still need on-device acceptance.
