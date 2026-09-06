# Frozen contracts — version 1

`shared/contracts.ts` is the single source for data shape. This document defines behavior and ownership. Imported types may not be redefined in A/B files. IDs in the boundary are strings; B converts Convex IDs internally. All times use ISO8601 for artifacts and integer milliseconds for run playback. Geometry uses metres/radians/Y-up.

## Export boundary

A: `src/ui/BlindspotApp.tsx` exports `BlindspotApp(props: RuntimeBridge & { viewport: React.ReactNode })`. UI never imports B implementation files or Convex hooks. `src/mocks/createFixtureBridge.ts` provides deterministic fixture state/actions for `src/ui/dev.tsx`.

B: `src/runtime/index.ts` exports `RuntimeRoot({children})`, `useBlindspot(): RuntimeBridge`, and `BlindspotViewport` with no required props. RuntimeRoot owns providers/routing/session/engine store; viewport reads that context and is lazy-loaded only on workspace route. The engine is browser-only. Viewport lifecycle is idempotent and disposes subscriptions/GPU resources on unmount. A/C do not receive imperative engine internals.

C: `src/main.tsx` wraps a component in RuntimeRoot, gets the bridge, passes it and the conditional viewport to A. `index.html` points there. No C-written provider service, simulation timer, report persistence adapter, or per-endpoint data glue.

## Dependency and command ownership

A creates root Vite/React/TS bootstrap and locks all required frontend dependencies in A0. Baseline dependency set: `react`, `react-dom`, `three`, `@react-three/fiber`, `@sparkjsdev/spark`, `convex`, `zod`, and a small QR encoder (`qrcode` plus its types if needed). Dev: `vite`, `typescript`, `@vitejs/plugin-react`, React/Three types, `vitest`, jsdom/Testing Library if used. Verify current peer ranges and official Spark example compatibility before installing; do not assume every latest major is compatible. Avoid extra Drei/postprocessing dependencies unless a concrete need is agreed. Dependency names are a plan, not an installed/validated lockfile.

A0 creates scripts `dev:ui`, `dev:engine`, `build:ui`, `build:engine`, `dev`, `build`, `typecheck`, `test`. Vite UI mode uses ui.html, engine mode uses engine.html, default release uses index.html. Each mode builds only its entry, so missing future entries do not break independent previews. A's isolated typecheck excludes B/C files until they exist; final typecheck includes all source and shared contracts. Vitest tolerates the temporary absence of tests at bootstrap, but completed roles must supply the required meaningful tests. B creates provider service scripts `dev`, `build`, `typecheck`, `test`, plus bounded preflight/cache preparation commands, inside `services/provider/`.

A0 is an early pushed commit, not a giant final dump. B merges A0 to get root dependencies; B's pure engine/provider work can start before it arrives. If B needs another frontend dependency, A lands the manifest/lock change and supplies that commit. Only A writes the root lock.

## Routes

- `/`: operator workspace locally. With public authoring disabled, loads the configured immutable report as a judge demo and permits credential-free in-browser replay; it never exposes world generation or report publishing.
- `/control/:sessionId#token=…`: lightweight preset controller. Fragment token is read once and held privately; don't forward it into report URLs or analytics. Validate server-side; obscurity alone is not authorization.
- `/reports/:reportId`: public immutable report, no controller/owner credentials, no engine load.

Share links are built from `VITE_PUBLIC_APP_ORIGIN`, not the operator browser origin. If unset, `controllerUrl`/`reportUrl` are null and sharing is disabled with a setup message. C sets the deployed HTTPS origin on the operator environment and restarts the local app after hosting.

## Actions

Every async action returns `{ ok: true }` or `{ ok: false, error: { code, message, retryable } }`. A displays failures and preserves input. B must not swallow errors and leave a spinner running. Unsupported actions return a clear capability error. `navigate`, `setPlayback`, and `seek` are synchronous and operate only on existing state; seeking a completed recording cannot mutate measured results.

`authorScenario` takes sentence/photo/selected world. The local provider service consumes browser Files; Files never go into Convex documents. `confirmCalibration` passes the operator reference/correction to B for finite-value, alignment and bounds validation; it never makes an estimated reference a measurement. `requestConfig` submits one allowlisted preset, not arbitrary JSON. `startRun` and `publishReport` require owner capability. `retry` applies only to the displayed failed operation. A cannot directly upload scores through this boundary.

## Local HTTP contract — B owns both server and client

- `GET /api/local/health`: provider configured/missing booleans; never values.
- `POST /api/local/worlds`: authorized operator upload/prompt → `{jobId}`; bounded generation/caching.
- `POST /api/local/hazards`: approved bulk hazard request → `{jobId}`.
- `GET /api/local/jobs/:jobId`: queued/running/completed/failed + sanitized result references.
- `POST /api/local/scenarios`: sentence + calibrated world summary + bounded zones → validated scenario proposal; response includes `authoring: preset | model`.
- `GET /api/local/assets/:assetId`: owned cache artifacts only, never arbitrary path/URL proxy.

Exact provider payload translation belongs to B, verified against current primary docs. A only invokes bridge actions, so endpoint changes do not require UI/C work.

## Convex callable contract — internal to B

| Function | Input summary | Output / enforcement |
| --- | --- | --- |
| `seed.bootstrap` (internal, local CLI only) | initial world/library/scenario and capability hashes | seeds first session; local service retains the raw capabilities privately |
| `sessions.getPublic` | sessionId | sanitized current status/config/last completed summary |
| `sessions.claimLease` | sessionId, owner token, instanceId | leased/denied, expiry; atomic |
| `configs.request` | sessionId, controller or owner token, presetId, clientRequestId | configVersion; bounded and idempotent |
| `runs.claimNext` | sessionId, owner token, instanceId | pending config snapshot or null; verify lease |
| `runs.complete` | runId, owner token, versions, bounded result | completed run, reject mismatched version/duplicate changes |
| `assets.generateUploadUrl` | sessionId, owner token | bounded authorized file-ingestion path |
| `worlds.ingest`, `library.ingest`, `scenarios.create` | sessionId, owner token, validated prepared data | owner-bound new records/versions; never accept arbitrary table writes |
| `library.list` | optional world/session filter | sanitized assets + physical assumptions |
| `reports.publish` | runId, owner token | stable reportId; immutable/idempotent |
| `reports.get` | reportId | ReportSnapshot or null; no tokens/provider job internals |

Bootstrap order: B supplies `npm run seed:demo` in services/provider, a local CLI preparation command that invokes the internal Convex seed function using the local deploy credential. It seeds one calibrated world/library/scenario/session and saves raw operator/controller capabilities only to an ignored local bootstrap file. The loopback service supplies this session to the operator browser through its protected local session endpoint. Raw capabilities never appear in CLI output. Later live authoring uses the listed public owner-capability-validated ingestion mutations; ordinary browser clients never call internal functions. B also supplies `GET /api/local/session` with the same local Origin/session protections.

B adds private write functions for bounded progress updates as necessary. All public mutation inputs have Convex validators and capability checks. No generic public “save arbitrary document” endpoint.

## Metrics and report rules

Coverage is **tested route-hazard detection coverage**, not fraction of all world surface or probability of safety. Before comparing configs, define eligible encounters geometrically along the fixed full diagnostic route. Include misses as denominator members. Exclude truly out-of-route hazards with reasons. `coverage = detectedBeforeBoundary / eligible * 100`. The invariant is `eligible = detectedBeforeBoundary + missedOrLate + unknown`; excluded encounters are outside eligible. If eligible is zero OR unknown is nonzero, return percent=null and label incomplete. Never drop unknowns from the denominator. Persist which pass supplied the metric.

False-stop rate is `falseStopEvents / stopEvents * 100` from the reactive pass. Ground truth stopping-corridor checks at the initial braking decision pose and pre-braking speed decide whether a stop was false; save that decision corridor, rather than recomputing it at zero speed. With zero stops return null. P0 may have zero false stops and need not create an inverse tradeoff. If a later preset injects noise to demonstrate a tradeoff, disclose that rule and keep the random seed fixed.

Near miss: minimum truth clearance below the declared margin and above contact, counted once per encounter. Collision: swept platform volume intersects truth geometry, counted once per contact episode. Time to completion is null if the robot does not complete. Record termination reason rather than pretending a timeout finished the route.

A report snapshots scenario/config/world/library versions and assumptions. Include observed first detection range, theoretical threshold range (when meaningful), required stopping distance, exact geometry dimensions, and hazard source. “Not seen on the tested trajectory” is distinct from “not evaluated.” First-detection range is remaining along-route clearance from the robot front envelope, after transforming from the sensor mount; store camera axial depth separately for projection. Theoretical threshold range is camera axial depth. Required stopping distance is path travel for latency + braking + margin, with no second radius addition.

Report status precedence: `incomplete` if calibration is unverified, unknown encounters exist, no encounters were eligible, or a required pass failed; else `blind_spot_observed` if any missed/late finding or collision exists; else `no_failure_observed`. Incomplete reports may be saved for internal review but cannot be presented as a completed quantitative report.

An authored stress hazard is never presented as photo-detected real infrastructure. Later runs cannot change old reports.
