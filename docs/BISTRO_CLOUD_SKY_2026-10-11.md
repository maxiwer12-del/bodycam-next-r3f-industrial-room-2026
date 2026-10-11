# Bistro Cloud Sky — 11 October 2026

Implementation branch: `feat/bistro-procedural-clouds` (based on `feat/city-overhaul-2`).

## Change

Replaces the **visible** `san_giuseppe_1k.hdr` environment panorama with an analytic sky dome generated directly inside Three.js / React Three Fiber.

- `scene.environment` remains the original HDRI; metal/glass materials still have PBR image-based reflections and environmental light.
- `scene.background` is a neutral daylight fallback color. It is no longer an HDR panorama.
- `BistroCloudSky.tsx` adds a sphere that follows the camera **position** (not rotation), always remaining visually far away; backside rendering and a stable 3D noise cloud mask have no 360-degree texture seam.
- Gentle wind animation updates a single shader uniform, with no asset requests, new image textures, occlusion pass or heavy raymarching.
- The atmosphere shader is a single mesh/draw call, does not receive/cast shadows, does not participate in collisions, and retains a sky gradient and sun-matched haze.
- Both High and Cinematic Max retain the same atmosphere object. Cinematic Max changes cloud edge detail without recreating the WebGL context.

## Validation

- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS with the unchanged original city texture checks.
- Chromium QA (SwiftShader): `cloudDome: true`, `environmentHDR: true`, `backgroundIsHDR: false` before and after full scene loading.
- QA changed High to Cinematic Max: canvas count remained 1; the sky continued to be present and the HDR remained lighting-only.
- The same QA run completed with no page/network errors or shader error messages.
- A trustworthy screenshot was not obtained because software WebGL screenshot readback timed out; visually confirming cloud appearance on real hardware remains an acceptance task.

Do not promote to production until checked on iPhone 16 Pro / Samsung Galaxy S24, especially clouds/sky banding and mobile FPS.
