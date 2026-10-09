# BODYCAM NEXT / Stage 1 — Art-direction blocker and source audit

**Status:** REJECTED / ON HOLD. No weapons, character system, multiplayer, or new project. This report applies only to the existing `maxiwer12-del/bodycam-next-r3f-industrial-room-2026` repository.

## Verified reasons current scene fails art-direction review

Source audit of `src/game/Experience.tsx`, `scripts/prepare.mjs`, and `scripts/layout.mjs`:

1. The architectural source is `modular_urban_apartments_facade` (Poly Haven); this is a facade, not a complete warehouse interior. The older Babylon prototype had `modular_factory_facade`, but the **current R3F** version does not use that as its architectural source.
2. `ConcretePlane` renders both floor and ceiling using `planeGeometry`. Real floor slabs, ceiling deck, trusses, and structural edge geometry are absent.
3. The floor material loads a base-color map and normal map only. It lacks an explicit roughness map, anisotropy, and independently calibrated texel density.
4. The authored environment has no complete off-room continuation visible through doorways and windows.
5. Model placement merely recenters clones using bounding boxes, with fixed coordinates in `scripts/layout.mjs`. There is no mesh-contact validator, OBB overlap resolver or mesh-aware navigation collision.
6. Directional, ambient, hemisphere and point lighting are not a substitute for baked GI and physically convincing indoor bounce; no HDR PMREM/reflection pipeline was integrated.
7. Old browser screenshots are not sufficient evidence of professional visual quality; the user rejected the render.

All of the above are **BLOCKER** issues. Do not claim Stage 1 accepted. Do not reintroduce plane/box primitives as final art.

## Candidate professional warehouse interiors — source discovery

| ID | Candidate | Source and author | Source format | Price | Rights | Access and suitability |
|---|---|---|---|---|---|---|
| FREE-01 | Abandoned Warehouse — Interior Scene | Aurélien Martel on [Fab](https://www.fab.com/listings/17932eba-c510-4cd1-b6be-2b7145f36eea) / [Sketchfab](https://sketchfab.com/3d-models/abandoned-warehouse-interior-scene-1d5285f2e0fd4211a27c8042496d5959) | GLB, glTF, Blender | Free | Original Sketchfab CC BY (credit required); re-check the actual chosen Fab license at download | Complete real scene, ~617.8K triangles. Download gated by account; **NOT DOWNLOADED**, **NOT INTEGRATED**. |
| FREE-02 | Warehouse (Quixel Megascans) | [Fab / Quixel](https://www.fab.com/listings/a3149fab-3906-4043-b6ee-3937b752a06c) | 85 FBX assets, JPG textures, UE 5.4–5.6 scene | Free | Fab Standard; no standalone raw-asset redistribution | Highly consistent, photorealistic material library; UE scene is not a guaranteed ready-to-load GLB; Epic/Fab sign-in required. **NOT DOWNLOADED**. |
| FREE-03 | Abandoned Warehouse | denis_cliofas on [Sketchfab](https://sketchfab.com/3d-models/abandoned-warehouse-1e40d433ed6f48fb880a0d2172aff7ca) | Sketchfab downloadable model; inspect exported GLB | Free | CC BY attribution; includes sources from third parties to verify | ~350.7K triangles with 4K PBR retexturing. Author warns not game-optimized. Account required. **NOT DOWNLOADED**. |
| FREE-04 | Unity Warehouse | Unity Technologies Japan, [Unity Asset Store](https://assetstore.unity.com/packages/3d/environments/industrial/unity-warehouse-276394) | Unity HDRP package | Free | Unity Asset Store EULA; verify distribution format before web use | Complete photorealistic warehouse demo, 936.8 MB. Conversion and shader reconstruction required; account/download required. **NOT DOWNLOADED**. |
| PAID-01 | Realistic Warehouse | Hipernt, [Unity Asset Store](https://assetstore.unity.com/packages/3d/environments/industrial/realistic-warehouse-243022) | Unity package | $14.99 USD | Unity Asset Store EULA | Described as a modular mobile-optimized FPS-oriented warehouse, 33.8 MB. Blender/Unity extraction requirements unknown. **NOT PURCHASED**. |
| PAID-02 | Warehouse — hangar interior and props | Mixall, [Unity Asset Store](https://assetstore.unity.com/packages/3d/props/industrial/warehouse-hangar-interior-and-props-127028) | Unity package | $29.99 USD | Unity Asset Store EULA | 214.9 MB. Verify actual interior shell and importable geometry before purchase. **NOT PURCHASED**. |
| PAID-03 | Factory Interior + Warehouse Props Vol 1 | Cybernetic Walrus, [Unity Asset Store](https://assetstore.unity.com/packages/3d/props/factory-interior-warehouse-props-vol-1-bundle-259694) | Unity package | $69.99 USD | Unity Asset Store EULA | 467.7 MB, consistent environment+props collection. **NOT PURCHASED**. |

Prices are store listing prices before applicable taxes, observed October 2026; subject to change. No purchase has been made.

## Verified access blockers — 2026-10-09

- Automated Chromium loading the Fab free complete scene from the build environment: **HTTP 403**.
- Sketchfab original complete scene: page is HTTP 200, but clicking **Download 3D Model** opens the account log-in dialog; public download API: HTTP 401 without authentication.
- Third-party CC-BY listing at e-freeshop shows a GLB, but clicking **Télécharger** redirects to the account login page; direct URL responded **HTTP 401**.
- Original author's historical Google Drive folder redirects to sign-in.
- No legally downloaded replacement warehouse-interior GLB is in the working project. Do not mark it as DOWNLOADED, INTEGRATED, or VISUALLY APPROVED.
- Browser automation on Fab also experienced remote browser-start failure. This does not establish any file entitlement.

## Recommended next input

**Preferred free starting point:** download `Abandoned Warehouse - Interior Scene` as GLB from the Fab or Sketchfab listing using an authorized account and provide the archive/file for geometric inspection. This is free but might require mesh optimization and a quality review; it has not been judged photorealistic in an in-game render.

**Alternative for strongest warehouse material coherence:** the free 85-piece Quixel Megascans Warehouse set from Fab. This is not a ready-made GLB interior and requires FBX import/conversion and reconstructing the UE example into a properly authored Three.js environment.

Do not buy anything until the user approves an exact licensed asset.

## Visual QA prerequisites

A production rebuild cannot begin until a qualified warehouse interior has actual valid files. Only then: inspect source mesh hierarchy, confirm metric scale / UVs, require connected shell/floor/roof/door/window geometry, retain existing R3F renderer, implement surface-aware placement, tune PBR then lights, validate blockers, capture six actual browser screenshots, profile actual device, and publish a separate preview without overwriting the rejected production scene.

**Acceptance:** Not ready. No new preview is being represented as a finished room.

## Baseline automated checks on the *rejected* scene

Executed on the existing Vercel Sandbox at the time of this audit:

- `npm run validate:assets`: exit code **0**, verified **13 existing GLBs**, approximately **23 MB** on disk.
- `npm run validate:placement`: exit code **0**, reported **55 existing placements**, **0 issues**.
- `npm run validate:world`: exit code **0**, reported **32 facade wall modules**, **1 doorway** and **9 floor props**, **0 issues**.

**These exits do not indicate a correct room.** They prove the current validators have an art-direction and geometry-coverage gap: all pass while the actual project still uses planar floor and ceiling, facade wall modules, incomplete openings and unvalidated contact/collisions. All asset requirements above remain BLOCKER.

Additional download access checks: Sketchfab click on Download 3D Model opened a sign-in dialog. The independently published CC-BY GLB listing at e-freeshop also redirected to account login, and its direct file endpoint responded HTTP 401. A separate attempt to load Fab in headless Chromium encountered HTTP 403. No GLB for the replacement interior was acquired.

## Additional paid alternative with explicit conversion risk

[Fab — Warehouse Big Pack by lyoshko](https://www.fab.com/listings/ff6df3b8-b366-4dcc-9f55-8b75a6ad3ca2?lang=en) — **from US$54.99** for the relevant listed license tier; contains extensive coordinated structure, racking, cargo, stairs and more. However the listing exposes an **Unreal Engine** format, not a verified independent FBX/GLB download, so it is **not preferred for the Three.js target** until exact source-file portability is established. No purchase was made.
