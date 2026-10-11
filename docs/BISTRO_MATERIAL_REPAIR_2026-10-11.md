# Bistro Material Repair — 2026-10-11

Status: **preview, not accepted**. Existing Amazon Lumberyard Bistro city and React Three Fiber renderer preserved. No production deployment made.

## Reproduced issues

Reference screenshots supplied by the user show overbright white facades, partially flat/undetailed building materials, harsh cobblestone specularity and isolated nearly white road patches. Some details may be authored in the source scene; do not claim all artistic issues are resolved without side-by-side screenshots.

The 17 generated exterior chunks and original BistroInterior referenced 487 unique KTX2 images (1,283 references across 18 glTF files). **246 images (218,217,440 bytes)** were absent from the previously bundled first-party texture directory and linked directly to `raw.githubusercontent.com`. All 246 upstream URLs returned HTTP 200 in an audit but runtime downloading over cross-origin networks is unreliable, especially on mobile. The original 345 bundled texture files include 241 of the 487 needed by expansion.

## Changes

- `scripts/stage-bistro-textures.mjs`: download only missing original licensed KTX2 files, verify KTX2 12-byte magic, stage first-party at `/maps/bistro-zone/Textures/`, atomically write completed downloads, and rewrite all 18 streamed glTF files to same-origin URLs. Build stops if any image cannot be verified. No generic texture downsampling.
- `scripts/validate-bistro-streaming.mjs`: assert every image is local, present and real KTX2, in addition to existing geometry and manifest checks.
- `src/game/BistroMaterialCalibration.ts`: preserve original basecolor/normal and packed metallic-roughness maps, but set non-metal road/stone material metallic multiplier to zero and raise dry/wet pavement roughness multipliers separately. DirectX normal Y sign is corrected deterministically once per shared material rather than toggled for every mesh.
- Existing core scene and streamed chunks both use the same calibration function.

## Test observations

- Automated asset audit after staging: `BISTRO_KTX2_FIRST_PARTY_READY {"unique":487,"downloaded":246,"bytes":218217440,"missingAfter":0,"rewrittenChunks":18}`.
- Streamed glTF check: **1,283 first-party KTX2 references, 0 remote**, across 18 glTF files; all 2,964 primitives have `TEXCOORD_0`.
- `node scripts/validate-bistro-streaming.mjs`: zero asset errors.
- `npx tsc --noEmit`: pass.
- `npm run build`: pass.
- Published preview confirmed live HTTP 200 for previously absent Foliage_Leaves_BaseColor, MASTER_Building_Details_Normal, MASTER_Interior_01_Plaster_Normal, Plaster_BaseColor, and BistroInterior glTF with 0 external image URLs.

## Remaining acceptance checks

- Compare original screenshot viewpoints and quantify facade bright detail and reflective road patches in actual GPU-rendered gameplay.
- Profile KTX2 memory budgets and device crashes separately on iPhone 16 Pro and Galaxy S24. These extra original textures increase first-party deploy size and may still raise GPU memory use near large chunks.
- Validate physical door traversal, performance High/Cinematic Max and any residual oval-shaped white road decal/artifact.
- Automated Chromium SwiftShader captures have timed out on screenshot readback; this is not visual acceptance proof.

## Runtime URL regression discovered and fixed

An initial version emitted image URLs beginning with `/maps/...` inside chunk glTF files. In this loader context, glTFLoader resolved those URLs beneath the chunk directory and produced HTTP 404. These previews were not visually accepted.

`stage-bistro-textures.mjs` now emits `../../../bistro-zone/Textures/<name>.ktx2` relative to the chunk glTF. The validator resolves each URL against the actual glTF path using the WHATWG URL parser and requires a first-party texture path with a valid KTX2 magic header.

**Runtime regression test:** 699 KTX2 requests / 699 HTTP 200, 0 texture HTTP errors in Chromium against the locally built scene. Interior and exterior chunk loaded. The published corrected Vercel preview also returned HTTP 200 for the glTF resources and all six sampled resolved textures. Note: Chromium SwiftShader logged shader-validation errors for double-sided transmissive glass and an interior lantern; these require separate hardware QA.

**Packed map sample verification:** Decoded four original 16x16 `_Specular.ktx2` images with the bundled Basis Universal transcoder. Road/wet road and concrete/plaster sample RGBA channels: R=0, G=188, B=0, A=255 (uniform). This supports *no AO from red*, *roughness from green*, *no metallic content in blue*. Under the old glTF roughnessFactor 0.552786, effective pavement roughness was approximately 0.407. The current calibration adjusts the material factor while keeping the original packed roughness texture. That addresses overly specular road surfaces without applying a grey filter or discarding base/normal maps.

The user must still verify road glare and white spot visually with matched camera viewpoints on the corrected preview. Browser screenshot capture in this software renderer remains unavailable.
