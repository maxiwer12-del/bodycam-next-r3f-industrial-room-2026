# Bodycam Next — City Overhaul 2.0 (work in progress)

This branch preserves the original Amazon Lumberyard Bistro scene and the React Three Fiber renderer. It is **not accepted** and must not be promoted to production.

## Verified source
- [NVIDIA ORCA Bistro](https://developer.nvidia.com/orca/amazon-lumberyard-bistro), CC BY 4.0.
- [qian-o glTF/KTX2 conversion](https://github.com/qian-o/GLTF-Assets/tree/main/Bistro).
- `BistroInterior.bin` fetched from `media.githubusercontent.com/media/qian-o/GLTF-Assets/main/Bistro/BistroInterior.bin`, **42,180,576 bytes**, SHA-256 `a02b152bc600f79104a2bfc56bc1f4198b3edcef1dc74f1474b809501015a29e`; this is not the Git LFS pointer.
- Original Interior glTF declares 1186 meshes, 71 materials and 213 image references.
- Exterior root includes scale 0.016 and rotation; alignment must be measured rather than setting both roots to zero.
- The upstream packed specular maps are nonstandard: R = occlusion, G = roughness, B = metalness, with DirectX normal maps. Existing blanket AO deletion needs further source-level validation.

## Changes already made
- Reduced outdoor hemisphere, directional and environment intensity, and the ACES exposure as an initial non-final correction.
- Removed blanket forced roughness. Actual before/after reference screenshots **still required**.
- Added strict source binary audit script to refuse LFS pointer files.

## Not yet validated
- Expanded spatial chunks and visual/physical bounds; current `MAX_DISTANCE=13` remains.
- Source `BistroInterior` transformed/streamed into game; no walkthrough is yet available.
- Source texture remapping, texture resolution and dynamic shadow tuning.
- iPhone 16 Pro and Galaxy S24 real-device FPS, the ten screenshots, route capture.

Do not claim completion, functional interior entry or accepted 2.0 release until these checks pass.
