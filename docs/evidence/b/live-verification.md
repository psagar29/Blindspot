# Person B live verification, 2026-09-05

This evidence uses actual Marble exports, GPU rendering and the approved Convex development deployment. It also uses an explicitly labeled procedural bulk proxy because Tripo reports no available credits. It is not a completed four-sponsor demo.

## Provider and world evidence

The supplied credentials were loaded locally without printing their contents. Live preflight returned Marble authorized with credits available, and Tripo authorized with credits unavailable. One Marble text generation completed; no Tripo generation succeeded or is claimed. Model authoring is the labeled deterministic preset fallback. No venue photo or runtime-model response is claimed.

The generated SPZ and collider were rendered in the in-app browser. Overlay inspection checked the shelving/floor alignment, axes and 1 m ruler. The floor sample was 0.004 m. Calibration is `estimated_reference` with an `assumed` reference, not a physical measurement. Raw metric scale is 1.2551026 and ground offset is 0.8235686. Export provenance is in `public/demo/`.

The production GPU sensor passed a known plane at 2 m: maximum depth error 3.618517765e-7 m, with a floor at 0.04 m excluded. The check ran on a display using pixel ratio 1.5, catching and fixing an erroneous second application of display scaling to the sensor raster. Exact cable rays use a static triangle index checked against independent Three raycasting; physical cable diameters remain 8 mm and 16 mm.

## Live comparison

Session: `2f1bc296-abfc-4442-ac2e-71a27eb77451`, deployment `standing-pony-711`.

Both comparison runs used the same scenario ID, scenario version 2, world version 3, route, speed, hazard geometry and seed 20260905.

| Result | Baseline, config 3 | Higher resolution, config 4 |
| --- | --- | --- |
| Run | `jh751ksk7cjsthc9v8kqt4s2g98dtr9q` | `jh74wjms48dcah9an7jvq3r9pd8dth1h` |
| Raster | 160 x 120 | 320 x 240 |
| Coverage | 2/3, 66.66666666666666% | 3/3, 100% |
| 8 mm cable diagnostic route clearance at first detection | 0.3722727273 m, late | 1.0222727273 m, in time |
| Required stopping distance with margin | 0.7103846154 m | 0.7103846154 m |
| Reactive first cable detection | 2640 ms | 2040 ms |
| Initial braking decision | 2640 ms | 2340 ms |
| Termination | Collision at 2971 ms | Stop at 3340 ms |
| Route completion | 29.5167020% | 29.1307692% |
| Collisions / near misses | 1 / 0 | 0 / 1 |
| False stops | No stop events, null ratio | 0/1, 0% |

This is a passive-stereo width approximation over proxy depth, with analytical cable samples checked for occlusion. There is no texture dropout, measured stereo disparity error, material-response measurement or safety certification.

## Controller, authoring and report checks

A controller tab consumed its bounded token from the URL fragment, removed the fragment, requested higher resolution, and observed requested/completed versions 4/4. A separate operator tab ran that exact configuration. No geometry, route, seed or speed changed. The local controller test is explicitly a harness convenience; deployable QR links still require `VITE_PUBLIC_APP_ORIGIN`.

The supported sentence action persisted scenario version 3 and completed config 5, run `jh751yr3rjvt98y34h359jp6sn8dvz9j`. Its higher-resolution metrics matched config 4. The old reports stayed unchanged after that edit.

Published baseline report: `2befc0cd-7508-47f2-9e07-641a2bfc0478`.
Published higher-resolution report: `4b305fa2-c750-4876-8486-3a0e35d745a1`.

The local provider service was stopped, and the operator tab navigated away from the workspace. The baseline report reloaded on its direct `/reports/:id` route through an unauthenticated Convex query. The controller then displayed `Waiting for operator`. Public asset downloads returned HTTP 200 and matched their recorded SHA-256 digests. The baseline snapshot SHA-256 remained `9d91af1f106f9c028c05fbec2262c24f892f2445d61bb3b15694184d1465e6b2` before and after the later scenario edit and provider shutdown. See the two public-check JSON files and immutable report JSON files beside this document.

The frontend route was served locally for this test. A deployed public frontend origin has not been supplied or verified; that remains C's release step. The reports and their assets are durable public backend data and do not depend on the provider process.

## Final verification scope

- Provider/engine suite: 17 passing checks, including projection, calibration, occlusion, finite braking, impact speed, swept collision, reproducibility, metrics, local origin/token rejection and cache resume.
- Runtime suite: 3 passing checks, including bounded routing/origins, overlapping lease heartbeats and React lifecycle cleanup.
- Backend suite: 22 passing checks; details in `backend-verification.md`.
- Root and provider typechecks pass. Engine production build passes. The lazy Spark viewport is approximately 2.03 MB gzip; the harness entry is approximately 87 KB gzip. Controller/report routes do not mount the viewport.
- A value-based scan of tracked/untracked candidates and built browser assets found no supplied API secrets or raw owner/controller capabilities.

The unit suites contain explicit fixtures. They do not substitute for the live evidence above. Photo-driven generation, actual Tripo GLB export/rendering, Mint delivery, runtime-model authoring, hosted QR flow and hardware sensor validation remain unverified or unavailable as stated.
