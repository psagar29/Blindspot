# Person A handoff

Status: COMPLETE — frontend on fixtures plus the real Mint MCP robot asset imported with provenance.

- Branch: person-a
- Baseline / A0 commit used: `713a33d5a46574d0b6bb6eab41847dd2753fecae` (A0 bootstrap: root package.json/lockfile, Vite 8 multi-entry modes, strict TS, scripts). B merges this (plus `1a62bfb`, which restores the baseline .gitignore/.env.example content) for the shared root dependency set.
- Final tested commit: `3058af1` (typecheck, 34/34 tests, build:ui all re-verified at this head; the clean `npm ci` reproduction was verified at `3b5ce5c` with identical dependency state).

## Exact commands and actual results (run 2026-09-05, macOS, node v22.14.0 / npm 10.9.2)

| Command | Actual result |
| --- | --- |
| `npm ci` | reproduces from lockfile, 0 vulnerabilities |
| `npm run typecheck` | passes (tsconfig.json + tsconfig.node.json, strict) |
| `npm run test` | 3 files, 34/34 tests pass (vitest 5, jsdom). jsdom prints harmless "HTMLCanvasElement getContext not implemented" notices; that path is the UI's no-WebGL fallback |
| `npm run build:ui` | builds dist from ui.html in ~0.3 s; route-level chunks: Workspace ~22 kB, PhoneController ~4 kB, ReportPage ~10 kB, QR encoder lazy ~23 kB |
| `npm run dev:ui` | serves the fixture preview; open `http://localhost:5173/ui.html`. Deep links `/control/:id` and `/reports/:id` work via the dev SPA fallback |
| `npm run build:engine` / `npm run build` | fail by design with a clear "entry does not exist yet" message until B's engine.html / C's index.html exist |

Preview tour: the floating "Fixture controls (dev preview only)" panel loads every state (fresh, calibrating, ready, completed, queued-from-phone/stale, running, published, incomplete-with-unknowns, no-stop-events, generation-failed, offline, expired controller token), injects per-action failures, and toggles connection/operator/no-WebGL.

## Completed P0 deliverables

- A0 bootstrap: root Vite 8 + React 19 + strict TS, one npm lockfile, multi-entry modes (`ui`/`engine`/default), scripts per CONTRACTS.md; missing other owners' entries never break `build:ui`.
- `src/ui/BlindspotApp.tsx` exporting `BlindspotApp({ state, actions, viewport })` on `shared/contracts.ts` types only. No Convex hooks, no provider calls, no engine imports anywhere under `src/ui/`.
- Neumorphic design system (`src/styles/`) implementing the DESIGN.md tokens: raised/inset states with border fallbacks, focus rings, 44px mobile targets, reduced-motion support.
- Desktop workspace: top bar, 272px rail (source photo + fixture tag, sentence composer, calibration card, hazard rows with dims/evidence/justification), dominant dark viewport shell with A-owned overlays (corner labels, shared time/run/config version, point count), run controls, playback strip with event markers and scoped Space handling, two-needle dial + textual values with denominators, verbatim CLAIM_BOUNDARY beneath the gauge.
- Calibration flows through `actions.confirmCalibration` (reference label/length/evidence/correction); assumed references warn that scale stays estimated; the report records reference kind and uncertainty.
- Requested-vs-completed config separation: stale gauges get a "Previous run · {label} v{n}" badge plus the currently selected/queued config; session requested/active/completed versions shown in the drawer.
- Sensor drawer: preset catalogue is UI display copy only; exact parameters render exclusively from `state.config`. Requests go through `actions.requestConfig`.
- Phone controller (`/control/:sessionId`): three 44px+ presets, queue/running/completed status, operator-online/offline messaging, expired-token state, latest completed gauge, report link. No engine, splat, or QR-encoder weight in its chunk.
- Public report (`/reports/:reportId`): status per precedence (blind spot observed / no failure observed in this run / incomplete), provenance + checksums, scale source and uncertainty, platform/sensor/model parameters, metrics with denominators and pass provenance, per-hazard findings with route-clearance vs camera-depth vs theoretical vs stopping distance, "Never detected on the tested trajectory" distinct from "Not evaluated", authored-stress vs seen-in-photo, limitations, claim boundary above the fold and in the print footer. Printable (evidence PDF); report-not-found state.
- Honest metrics helpers (`src/ui/metrics.ts`, unit-tested): percent withheld while unknown > 0, "No eligible encounters", "No stop events" for 0/0, no invented values; needles animate only real-to-real.
- Fixture bridge (`src/mocks/createFixtureBridge.ts`) + deterministic labeled dataset (`src/mocks/fixtureData.ts`, seed 41, fixed timestamps); permanent fixture banner/badges; share links built only from `VITE_PUBLIC_APP_ORIGIN` (unset ⇒ sharing disabled with setup message, verified both ways).
- States implemented: empty, uploading, generating (stage + elapsed, no fake %), calibrating, ready, queued, running, publishing, published, error (retry preserves input), offline/reconnecting, WebGL-unsupported, expired controller token, report loading/not-found, stale results.

## Required local configuration names (never values)

`VITE_PUBLIC_APP_ORIGIN` (share links; unset disables sharing), `VITE_AUTHORING_ENABLED` ("false" ⇒ read-only guidance), `VITE_CONVEX_URL` (consumed by B's runtime, not by UI components).

## Real integrations versus fixtures

- The simulation/session data in the preview is FIXTURE data and is labeled as such (banner, badges, "(fixture)" names, fixture provenance). Nothing claims live provider activity.
- Mint: REAL and complete. `public/mint/teal-stripe-scout-rover.glb` is an actual Mint MCP generation on the operator's Mint account ("Teal Stripe Scout Rover", asset `ks74ch8bya740cjkcz9zp55adx8dtnmn`, project "Blindspot"). `public/mint/PROVENANCE.json` has the full sanitized record: prompt, IDs, timestamps, sha256 `85f69933…`, byte size 856,760, licensing. Export nuance recorded there: the MCP artifact download API is gated for this (no-subscription) account tier, so the GLB was exported by the account owner from the Mint web viewer; the exported byte size exactly matches the MCP-reported `original_glb` size. The fixture scenario references it as `Platform.visualAsset` (source "mint") — the one real asset in the fixture set, and it is decorative: B's platform geometry remains the physical envelope.

## Evidence

`docs/evidence/a/` — 01 fresh 1440, 02 completed 1440, 03 stale-queued, 04 metrics with Previous-run badge, 05 sensor drawer 1440, 06 generating, 07 calibrating, 08 error+retry with preserved input, 09 offline, 10 incomplete metrics (percentage withheld), 11 no-WebGL, 12 workspace 1024 collapsed rail, 13/14 controller 390, 15 controller 360 queued (scrollWidth == 360, no overflow), 16 operator offline, 17 expired token, 18–21 report sections, 22 print PDF, 23 report not found, 24 keyboard focus ring, 25 QR sharing with configured origin, 26 Mint robot preview render, 27 workspace with Mint attribution. One batched fix pass (label casing, hazard-row wrap, metrics pass copy) + one confirmation pass, per ACCEPTANCE.md.

## Mint status — COMPLETE

- OAuth done against `https://mcp.mint.gg/mcp` (authorization-code + PKCE + dynamic client registration; the operator authorized in their own browser; tokens stayed in the session scratchpad and are not in the repository).
- Workflow executed per TECHNICAL-NOTES: `who_am_i`/`get_credits_balance` preflight (pipeline ready, usage credits available) → `create_project` "Blindspot" → `start_model_generation` (auto mode) → `wait_for_status` to final `succeeded` → `optimize_generated_model` (standard). Chat: `https://mint.gg/chat/ph79y29zhzy4xpshaaz12rkdr18dvazp`.
- Artifact for B: `public/mint/teal-stripe-scout-rover.glb` (glTF 2.0 binary, 1 mesh, sha256 `85f69933396b670d9b46c8d3cdd61167a106567e3a28b0ff9ad15693ce3bc845`). **Visual bounding box (local axes, metres): min [-0.329, -0.276, -0.499], max [0.329, 0.276, 0.499], size 0.658 × 0.553 × 0.998 (x × y × z, Y-up).** Fits the fixture platform (radius 0.35 m, height 0.42 m) with modest scaling; treat the mesh as decorative — the platform radius/height in the scenario remain the physical envelope.
- Known limitation recorded in PROVENANCE.json: MCP artifact download API is gated for this account tier, so the GLB was exported from the Mint web viewer by the account owner (byte-size match confirms it is the same artifact).

## Contract changes

None. `shared/contracts.ts` untouched.

## Dependency notes (root, owned by A)

Pinned exact: react/react-dom 19.2.8, three 0.185.1 (+@types 0.185.4; satisfies @sparkjsdev/spark 2.1.0 ">=0.180.0" and @react-three/fiber 9.7.0 ">=19 <19.3" react peer), convex 1.45.0, zod 4.5.4, qrcode 1.5.4, vite 8.2.2, @vitejs/plugin-react 6.1.1, vitest 5.0.0, typescript 5.9.3 (deliberately the stable 5.x line, not the new TS 7 port), jsdom 27.4.0 (node 22.14 compatible; jsdom 30 wants newer node), Testing Library, @fontsource/manrope + @fontsource/ibm-plex-mono 5.3.0 (self-hosted fonts per DESIGN.md). B: if you need another frontend dependency, ask A to land the manifest/lock change.

## Known limitations

- The dev preview's viewport is a labeled schematic; B's `BlindspotViewport` is the real evidence area. `webglSupported()` in `ViewportShell` is a UI-side presentation probe only.
- Fixture "site photo" is a watermarked SVG, not a real photograph; the live world's `sourcePhotoUrl` comes from B.
- Reduced-motion and contrast were implemented per tokens and spot-checked, not audited with tooling.

## Next owner action

B: merge `person-a` head (or at least A0 `713a33d` + `1a62bfb`) for the root toolchain; implement `RuntimeRoot`/`useBlindspot`/`BlindspotViewport` against the same contract; the UI composes without changes. C: `src/main.tsx` wraps RuntimeRoot, passes bridge + conditional viewport to `BlindspotApp` (see `src/ui/dev.tsx` for the reference host shape).
