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


## Progress update — free city block, reproducible scene, 2026-10-09

**Scope note:** `art/bistro-urban-free-map` preserves the original Three.js/R3F game project; the main production scene is still rejected. This is an asset-inspection branch, NOT a finished FPS map.

**Real verified source files**
- Actual `BistroExterior.bin` was downloaded with Git LFS (179,963,220 source bytes).
- Authored source `BistroExterior.gltf` loaded via glTF-Transform, cropped to a 32 × 32 metre *selection window*. Extending road/building meshes keep the total exported scene bounds much larger; do not misstate those exported bounds as player space.
- Exported `scene.gltf` and `BistroExterior.bin` plus KTX2 textures are **physically present in sandbox** and imported in browser through `/dev/bistro`; 551 source meshes, 689 WebGL Mesh primitives, 1,046,667 triangles, 103 PBR materials and 345 referenced KTX2 files.
- **120 large KTX2 textures** were individually decoded, resampled using Lanczos, rebuilt with UASTC/ZSTD10 plus mipmaps, then validated by Khronos `ktx validate`. Result: **0 conversion failures**, saved **136,743,288 bytes (~137 MB)**. Final sampled region including geometry and textures: approximately **198 MB** on disk.
- Original high-resolution source textures remain separately preserved in the downloaded upstream repository (and are not shipped as part of this candidate).
- Source-aligned environment `san_giuseppe_bridge_4k.hdr` was downsampled into valid 1024 × 512 RGBe HDR for reflection-probe review.

**Real technical QA**
- `npx next build`: exit 0 for the developer scene `/dev/bistro` (no production release).
- First headless Chromium WebGL2 full-quality test exceeded the 4 GB sandbox GPU/CPU memory budget before screenshots could finish.
- Browser WebGL2 `?lowgpu` inspector *did load* the real authored geometry and textures in approximately 8 seconds; one sampled readout indicated ~7.5 FPS in **software SwiftShader**, which says nothing about a physical iPhone or Galaxy.
- Five actual 720 × 400 screenshots were captured in the isolated environment: initial, street A, street B, facades and ground closeup. Browser crashed/closed before the sixth. They are development shots only, not visually approved.
- Art-review blocker: sidewalk, road and shadows are too dark in the low-GPU view; no postprocessing trick should hide this. This must be corrected with valid direct/indirect light and physically plausible material values before any preview is labeled acceptable.
- Raycast on actual author meshes: **48/81** sampled 3-metre grid points offered plausible supported walking positions; **45** of those 48 formed one connected component on the sampled grid. This is not a complete collision/navmesh test. Individual building overlaps and full routes remain to be checked.
- No mobile real-device FPS, no accepted collisions, no approved six-angle gallery, no new Vercel preview.

**Files added on this branch:** `src/app/dev/bistro/BistroCandidate.tsx`, `src/app/dev/bistro/page.tsx`, `scripts/prepare-bistro-region.mjs`, `scripts/prepare-bistro-hdri.mjs`, `scripts/repair-bistro-materials.mjs`, `scripts/optimize-bistro-textures.mjs`, `research/analyze-bistro.mjs`, `research/analyze-walkability.mjs`. Build-time input glTF, GLB, BIN and KTX2 binary files remain in the working sandbox, not on GitHub; source is from [qian-o/GLTF-Assets](https://github.com/qian-o/GLTF-Assets).

**Reproduction outline (authorized source, local environment):**
1. Clone upstream `qian-o/GLTF-Assets` to `research/large-bistro` using `GIT_LFS_SKIP_SMUDGE=1`, then `git lfs pull --include=Bistro/BistroExterior.bin --exclude=`.
2. Run `node research/analyze-bistro.mjs` to generate the bounding-box index.
3. Run `node scripts/prepare-bistro-region.mjs`, `node scripts/repair-bistro-materials.mjs`.
4. Install Khronos KTX Software v4.4.2 binary in `research/tools/ktx/KTX-Software-4.4.2-Linux-x86_64/bin/ktx` and run `node scripts/optimize-bistro-textures.mjs` (10+ minutes on 2 vCPU) and `node scripts/prepare-bistro-hdri.mjs`.
5. Copy Three.js `basis_transcoder.js` and `.wasm` into `public/basis` and run `npm run build`. The stage-1 app remains unchanged at `/`; the asset inspector is `/dev/bistro`.

**Release gate remains closed.** Do not publish the existing assets as an approved game until a visual pass, surface-aware collision/navigation, and mobile validation succeed.
