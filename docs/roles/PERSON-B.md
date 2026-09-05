# Person B — engine, providers, and live runtime

You have the supplied Codex Astra coding tool and own the harder half of implementation. Branch: `person-b`. Deliver a self-contained runtime, not backend endpoints that C must wire. Read ARCHITECTURE.md, CONTRACTS.md, and TECHNICAL-NOTES.md first.

## Your finish line

A working cached-world ground evaluation: Marble appearance/collider registration, an authored cable missed or detected too late by the declared stereo model, physically consistent braking/collision, reproducible metrics, live Convex controller updates, and an immutable public report. Your exported bridge and viewport drop into A's UI.

## Implement in this order

1. Preflight local credentials without printing them. Check documented API/account access, missing model credentials, and actual returned export fields. No paid call until an explicit operator generation action or the planned bounded first-cache run. Start one fallback Marble world, then cache it. Generate one Tripo bulk hazard. Defer venue generation until the fallback is downloaded, checksum-verified, and visually aligned.
2. Work on pure math while providers run. Use `shared/contracts.ts`; seed all stochastic behavior. Import A0's dependency commit once available; do not edit A's root manifest/lock. Required additions go to A as a precise package/range request. Keep your local service dependencies and its lock in `services/provider/`.
3. Implement world ingestion: SPZ quality selection, collider GLB, separate asset-to-world transforms, metric metadata, one-meter ruler and operator reference confirmation. Keep a provenance manifest and an explicit uncalibrated status. Fail the metric evaluation gate if registration/scale is unverified; do not silently run with arbitrary scene units.
4. Create the 3D harness in `src/runtime/dev.tsx` and `engine.html`. Use one renderer/two synchronized scissor views where practical. Splats drive appearance. A separate opaque proxy scene produces metric depth and object IDs. Dispose GPU resources; bound scene/texture size and sensor update frequency. Do not read RGB every frame for a P1 texture heuristic.
5. Build exact procedural cables and normalized bulk collision proxies. P0 cables are straight spans: exact diameter, specified endpoints, no generation model geometry for thin hazards. Robot physics is a finite cylinder/capsule envelope independent of Mint's decorative robot mesh. Exclude self/floor from occupancy, transform camera coordinates correctly, and use swept collision/bounded substeps.
6. Implement the passive-stereo approximation at the actual sensor raster resolution. Derive intrinsics from FOV; make threshold units explicit. Verify the cable exists in the ideal candidate sample before degrading it; address low-resolution aliasing without thickening the collision cable. Back-project to a cloud, filter/degrade, build/inflate a local XZ occupancy grid, and apply latency plus finite braking.
7. Implement **two evaluations per config**: (a) diagnostic traversal sampling the entire nominal route for coverage, independent of stops; (b) reactive outcome pass for actual collisions/stops/time. Both share seed, scenario and sensor config. Record first detection range, stopping requirement and collision event. Never force a collision for the animation; prove late detection under selected declared speed/braking settings.
8. Implement the minimal Convex schema/functions and `useBlindspot()` bridge. Add controller capability validation, one operator lease, bounded config queue/debounce, config versions, immutable run completion, and report snapshot publication. Stream only compact status at a bounded rate, not every frame/point cloud. B owns all conversion from Convex IDs/docs to contract types.
9. Implement the local Node provider service, its independent package scripts/lock, and the client proxy. Keys stay local. Cache normalized requests; poll accepted jobs, don't repeat generation on timeout. Limit upload size/type, validate owned file paths/provider hosts, and sanitize errors. Public controller/report routes use only Convex and durable read-only storage.
10. Implement sentence authoring. P0: deterministic parsing of the supported ground preset, labeled “Preset authoring.” P1 if runtime model credentials work: local provider calls for bounded JSON proposals; validate dimensions, allowed zones, route clearance, collision feasibility, and quantitative reasons in deterministic code. Coding-agent Astra access is not a runtime API credential. Do not fabricate an unavailable model identifier.
11. Deliver `src/runtime/index.ts` with `RuntimeRoot`, `useBlindspot` and lazy `BlindspotViewport` exports exactly as contracted. Your hook handles `/`, `/control/:sessionId`, `/reports/:reportId`, state transitions, errors, local-vs-public mode and all async actions. Public pages import neither splat assets nor the local provider service eagerly.
12. Complete focused tests, run the real engine preview, persist one real report, then freeze the Convex deployment. Update handoff, commit and push only `person-b`. Make the backend freeze and watcher shutdown explicit before C deploys.

## Essential correctness tests

Reference axes and metric conversion; projection/back-projection round trip; raster/focal-length consistency; threshold crossing; cable occlusion; floor/self exclusion; stopping distance and finite deceleration; swept 8mm cable collision; seeded determinism; occupancy inflation without duplicate radius; diagnostic coverage unaffected by early reactive stop; stale-config exclusion; report immutability; queued phone update produces one operator run; public/controller capabilities cannot call provider generation or forge completed runs.

## Scope discipline

No ToF, LiDAR, aerial, optical flow, catenary nonlinear solver, volumetric occupancy, generic world editor, auth product, or physically accurate infrared simulation before the complete ground report works. Keep three fixed hazard instances, a small approved library, one world and a short route. C does not implement your missing data adapter, server, collision logic or report persistence.

## Required handoff evidence

Actual commands and outcomes; final SHA; setup/generation/cache instructions; renderer/backend build checks; exact public Convex URL (not deploy key); public report ID; world scale validation; collision/detection trace; metrics definition; cached asset availability and license status; real sponsor task/model IDs; model fallback status; GPU/browser tested; documented local-service dependency for authoring; all known limits. Commit sanitized evidence, never complete raw provider responses or signed credential URLs.
