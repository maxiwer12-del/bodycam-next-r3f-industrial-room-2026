# BODYCAM NEXT — Free Urban Level / Stage 1 Asset Manifest

**Status: Candidate for personal visual review; NOT accepted.** Last updated 2026-10-09.

## Licensed environment asset

| Field | Verified value |
|---|---|
| Asset name | Amazon Lumberyard Bistro — Exterior (urban street scene) |
| Author / attribution | Amazon Lumberyard |
| Official listing | https://developer.nvidia.com/orca/amazon-lumberyard-bistro |
| glTF + KTX2 conversion | qian-o / GLTF-Assets — https://github.com/qian-o/GLTF-Assets/tree/main/Bistro |
| License | CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/ |
| License cost | **Free — US$0** |
| Source model | `BistroExterior.gltf` (2,830,929 bytes), source glTF 2.0 |
| Source geometry buffer | `BistroExterior.bin` (179,963,220 bytes), SHA-256 `46f97557874e1441b998c611314a755f9a3a4d52e5d405330edca5ac176cacdc` |
| Source texture archive | 405 referenced .ktx2 images; licensed upstream direct URLs |
| Environment lighting | `san_giuseppe_bridge_4k.hdr` from the same source |
| Mapped player-area design | 32 × 32 m area-of-interest; actual player bounding square currently approx. 26 × 26 m |
| Physical convention | +Y is up; 1.0 world unit = 1.0 meter after source normalization |
| Browser geometry | `public/maps/bistro-zone/scene-merged.gltf` + `BistroMerged.bin` |
| Compiled draw primitives | 146 primitives from 551 original selected meshes, about 1,046,667 triangles |
| Active materials and textures | 103 glTF materials, 316 references after graph prune; 345 files in publishing texture directory |
| Texture formats | Mixed source 2K KTX2 on near-surface assets, 1K UASTC for other key materials, BasisLZ for secondary assets. Mipmaps and image color-space data preserved. |
| Download status | **DOWNLOADED** to isolated Vercel Sandbox; direct public-source downloader is committed |
| Conversion and validation status | **CONVERTED / VALIDATED**, glTF graph and KTX2 signatures validated; 15 1px normal maps padded to 4 × 4 and KTX2 validated |
| Browser integration status | **INTEGRATED** with React Three Fiber + GLTFLoader/KTX2Loader on developer and game pages |
| Visual approval | **NOT YET APPROVED BY USER** — no false `VISUALLY APPROVED` status |

### Process transparency

The source is legally licensed but not owned by BODYCAM NEXT. The browser client displays the official source, converter, and CC BY 4.0 attribution links. The scene selects spatially relevant authored meshes, retains full glTF geometric topology, and joins static draw primitives by compatible materials; it does not re-create final buildings out of BoxGeometry primitives.

All 405 upstream images are fetched from `raw.githubusercontent.com/qian-o/GLTF-Assets/main/Bistro/...`. The source `.bin` is pulled from its large-file media endpoint and validated against the SHA-256 listed above. The build does not use credentials, game-extracted assets, pirated files, or paid assets.

### Caveats

The 32 × 32 m selection window is **not** the same as the GLB object's axis-aligned bounding box; large source meshes extend beyond the selectable region. The camera is bounded and collides against author-created geometry. A 3 m sampling grid found 48 supported points of 81, with 45 in one connected cluster; this does not replace full navmesh analysis.

No physical iPhone 16 Pro or Galaxy S24 results are claimed. See [free urban-map audit](./FREE_URBAN_MAP_CANDIDATE.md) and the [six authentic WebGL screenshots](./screenshots/urban-six-real-webgl.webp).
