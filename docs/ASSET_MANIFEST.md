# BODYCAM NEXT / ASSET_MANIFEST — rejected R3F scene, baseline inventory

**Artifact status:** Existing project audit, **not** new environment approval. Files verified in the Vercel Sandbox working directory `public/models/`. This inventory only represents the abandoned facade-driven prototype. No replacement warehouse-interior asset has been downloaded.

| Asset ID / actual GLB | Artist (Poly Haven) | License | File bytes | Scene layout? | Stage |
|---|---|---|---:|---|---|
| [`barrel_03.glb`](https://polyhaven.com/a/barrel_03) | Serhii Khromov | CC0 | 1022504 | Yes | Existing GLB present; visual QA **REJECTED** |
| [`concrete_road_barrier_02.glb`](https://polyhaven.com/a/concrete_road_barrier_02) | Amal Kumar | CC0 | 2250340 | Yes | Existing GLB present; visual QA **REJECTED** |
| [`industrial_caged_sconce.glb`](https://polyhaven.com/a/industrial_caged_sconce) | Ulan Cabanilla | CC0 | 1945588 | Yes | Existing GLB present; visual QA **REJECTED** |
| [`industrial_pastic_container.glb`](https://polyhaven.com/a/industrial_pastic_container) | Galo Benivegna | CC0 | 977192 | Yes | Existing GLB present; visual QA **REJECTED** |
| [`metal_office_desk.glb`](https://polyhaven.com/a/metal_office_desk) | Ulan Cabanilla | CC0 | 656196 | Yes | Existing GLB present; visual QA **REJECTED** |
| [`modular_airduct_rectangular_01.glb`](https://polyhaven.com/a/modular_airduct_rectangular_01) | James Ray Cock | CC0 | 2849564 | Yes | Existing GLB present; visual QA **REJECTED** |
| [`modular_chainlink_fence.glb`](https://polyhaven.com/a/modular_chainlink_fence) | James Ray Cock / Amal Kumar (wire material) | CC0 | 4936624 | Yes | Existing GLB present; visual QA **REJECTED** |
| [`modular_electric_cables.glb`](https://polyhaven.com/a/modular_electric_cables) | Kuutti Siitonen | CC0 | 3637092 | No | Existing GLB present; visual QA **REJECTED** |
| [`modular_urban_apartments_facade.glb`](https://polyhaven.com/a/modular_urban_apartments_facade) | James Ray Cock | CC0 | 1259440 | Yes | Existing GLB present; visual QA **REJECTED** |
| [`painted_wooden_cabinet_02.glb`](https://polyhaven.com/a/painted_wooden_cabinet_02) | Kirill Sannikov | CC0 | 543236 | Yes | Existing GLB present; visual QA **REJECTED** |
| [`plastic_crate_01.glb`](https://polyhaven.com/a/plastic_crate_01) | PierreB3D | CC0 | 1995024 | Yes | Existing GLB present; visual QA **REJECTED** |
| [`rollershutter_door.glb`](https://polyhaven.com/a/rollershutter_door) | MP | CC0 | 996964 | Yes | Existing GLB present; visual QA **REJECTED** |
| [`utility_box_01.glb`](https://polyhaven.com/a/utility_box_01) | James Ray Cock | CC0 | 747512 | Yes | Existing GLB present; visual QA **REJECTED** |

**Measured totals:** 13 catalog files; 12 unique assets referenced by 55 existing declarative placements; total working-model directory approx. 23 MiB. Current source files use Next.js / React Three Fiber GLTF loader. Models were converted/optimized GLB; triangle counts, UV density, orientation and per-instance contact **have not passed rigorous inspection**.

**Known asset suitability blocker:** `modular_urban_apartments_facade` provides residential exterior facade modules, not connected industrial warehouse interior walls/columns/ceiling. `ConcretePlane` creates the visible floor and ceiling from `planeGeometry`, not from GLB. The current three validator scripts returned exit code 0 but did not flag these critical geometry/design violations.

**Replacement asset statuses:** Aurélien Martel Abandoned Warehouse Interior Scene (Fab/Sketchfab), Quixel Warehouse (Fab), Denis Cliofas Abandoned Warehouse (Sketchfab) — **FOUND; DOWNLOAD BLOCKED BY ACCOUNT/AUTHENTICATION; NOT DOWNLOADED, CONVERTED, INTEGRATED OR VISUALLY APPROVED**. Details in [`STAGE1_ARCHITECTURE_REBUILD_AUDIT.md`](./STAGE1_ARCHITECTURE_REBUILD_AUDIT.md).

**No new preview was deployed.** Do not use this inventory to claim new room quality.