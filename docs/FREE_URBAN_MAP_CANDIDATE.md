# Free FPS Environment Candidate — Urban Bistro Block

**Project:** existing BODYCAM NEXT Three.js / React Three Fiber repository. **Budget:** USD 0. **Status:** DEV QA ONLY — NOT ACCEPTED, NOT DEPLOYED AS GAME.

## Source assets and rights

- **Main scene:** Amazon Lumberyard Bistro Exterior (original donor Amazon Lumberyard, 2017), [official NVIDIA ORCA listing](https://developer.nvidia.com/orca/amazon-lumberyard-bistro).
- **Authoritative license:** Creative Commons Attribution 4.0 (CC BY 4.0), with required credit.
- **Processed glTF + KTX2 source:** [qian-o/GLTF-Assets/Bistro](https://github.com/qian-o/GLTF-Assets/tree/main/Bistro), a free redistribution documenting CC BY 4.0.
- **No assets from the rejected prior game have been copied into this candidate.** The application runtime architecture remains Next.js + Three.js + React Three Fiber.
- **Source installation:** cloned into an isolated Vercel Sandbox working directory under `research/large-bistro`; Git LFS was explicitly fetched for `BistroExterior.bin`. The original 2K textures are preserved in that source directory.
- No paid assets were purchased.

## Geometry extraction — real measurements

- Original exterior: ~2.8 million triangles and a city streetscape.
- Region of interest: 2,000 × 2,000 source units = **32 × 32 metres**, with world scale 0.016 metres/source unit.
- Geometric excerpt after graph-prune: **551 meshes**, **689 mesh primitives**, **1,046,667 triangles**, **103 materials**, **345 referenced PBR textures**.
- Packed geometry buffer: **52.7 MB**. The high-detail source's referenced texture files were **~287 MB before mobile optimization**.
- Source-authored mesh transforms and internal geometry are retained; no replacement cube walls or plane floors.
- Region content was selected by spatial intersection with authored geometry AABBs; author-created roads and building meshes may extend beyond the 32-metre player-zone boundary. The large raw bounding box must not be mislabeled as a verified fully playable area.
- Repaired **102** legacy material assignments: source's packed `_Specular` R/AO, G/roughness, B/metalness texture was mapped to `metallicRoughnessTexture` and `occlusionTexture` instead of glTF specular strength.
- Normal maps use the source's DirectX Y direction and need a Y-channel flip on runtime import.

## Current QA / critical caveats

- Source archives and selected glTF have been parsed using glTF-Transform in the actual sandbox, and geometry was inspected for finite bounds and dimensions.
- Initial headless Chromium + SwiftShader test loaded WebGL but exhausted the 4-GB sandbox memory budget before completing the high-detail texture upload; this is a **failed visual and performance test**, not evidence of phone FPS.
- The KTX2 reencoding workbench is downscaling only oversize material maps for a memory-measurable **High** test, adding mipmaps. Full source quality remains separate for eventual Cinematic Max; Cinematic Max has **not** yet been implemented for this new environment.
- Floor raycast probes over a 3-metre grid in the 32 × 32-metre candidate area found **48 of 81** test sites with plausible supporting surfaces (other samples may lie in buildings or blocked paths). This does not establish route connectivity or collider acceptance.
- No six-angle screenshots, physical iPhone test, or public preview were approved yet. The existing published production site is unchanged.

## Hold-points before release

1. Finish optimized texture encoding and validate KTX2 syntax and PBR input color spaces.
2. Load the exact assembled glTF in a real browser without WebGL errors and inspect exterior from at least six viewpoints.
3. Define validated player spawns on walkable surfaces and verify blocked street boundaries.
4. Implement mesh-aware camera/player collision and anchors instead of arbitrary clamp, and replace rejected legacy layout in **a preview branch only**.
5. Produce true browser screenshots, test mobile browser (emulation labelled honestly), and profile actual FPS.
6. Only then create a new preview deployment under the **existing Vercel project**, not a new project or production overwrite, and ask user for art-direction approval.

No weapon/character/multiplayer work is authorized by this candidate review.
