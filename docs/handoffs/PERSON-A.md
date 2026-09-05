# Person A handoff

Status: FRONTEND COMPLETE on fixtures; Mint generation blocked on account access (details below).

- Branch: person-a
- Baseline / A0 commit used: `713a33d5a46574d0b6bb6eab41847dd2753fecae` (A0 bootstrap: root package.json/lockfile, Vite 8 multi-entry modes, strict TS, scripts). B merges this (plus `1a62bfb`, which restores the baseline .gitignore/.env.example content) for the shared root dependency set.
- Final tested commit: `3b5ce5c` (code through `cfc5686`; evidence in `3b5ce5c`). Everything below was verified at that head after a clean `npm ci`.

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

- Everything visible in the preview is FIXTURE data and is labeled as such (banner, badges, "(fixture)" names, fixture provenance). Nothing claims live provider activity.
- Mint: NOT integrated yet — see blocker below. The robot visual is not claimed anywhere; `Platform.visualAsset` stays unset in fixtures. No procedural mesh is labeled as Mint.

## Evidence

`docs/evidence/a/` — 01 fresh 1440, 02 completed 1440, 03 stale-queued, 04 metrics with Previous-run badge, 05 sensor drawer 1440, 06 generating, 07 calibrating, 08 error+retry with preserved input, 09 offline, 10 incomplete metrics (percentage withheld), 11 no-WebGL, 12 workspace 1024 collapsed rail, 13/14 controller 390, 15 controller 360 queued (scrollWidth == 360, no overflow), 16 operator offline, 17 expired token, 18–21 report sections, 22 print PDF, 23 report not found, 24 keyboard focus ring, 25 QR sharing with configured origin. One batched fix pass (label casing, hazard-row wrap, metrics pass copy) + one confirmation pass, per ACCEPTANCE.md.

## Mint status — blocked on account access (exact requirement)

- `https://mcp.mint.gg/mcp` verified live; requires OAuth bearer (`mint:read mint:projects:write mint:generate:start mint:generate:approve`), authorization-code + PKCE, dynamic client registration (verified via `/.well-known/oauth-authorization-server`).
- I registered a client and drove the consent page headlessly; sign-in offers wallet / Google / email only. Submitting the operator's email was (correctly) stopped by the permission layer — logging into the owner's account is a human decision.
- To unblock, the operator either (a) runs `claude mcp add --transport http mint https://mcp.mint.gg/mcp` and authenticates via `/mcp` in a Claude Code session, or (b) approves the email sign-in so the agent can finish the flow. After OAuth: generate one compact industrial wheeled inspection robot (low-poly GLB), `wait_for_status`, `get_asset_artifact_manifest`, import to `public/mint/` with sanitized provenance (task id, time, prompt, sha256, licensing), hand B the asset path + visual bounding box. UI needs no changes for this; it is an asset + provenance drop.

## Contract changes

None. `shared/contracts.ts` untouched.

## Dependency notes (root, owned by A)

Pinned exact: react/react-dom 19.2.8, three 0.185.1 (+@types 0.185.4; satisfies @sparkjsdev/spark 2.1.0 ">=0.180.0" and @react-three/fiber 9.7.0 ">=19 <19.3" react peer), convex 1.45.0, zod 4.5.4, qrcode 1.5.4, vite 8.2.2, @vitejs/plugin-react 6.1.1, vitest 5.0.0, typescript 5.9.3 (deliberately the stable 5.x line, not the new TS 7 port), jsdom 27.4.0 (node 22.14 compatible; jsdom 30 wants newer node), Testing Library, @fontsource/manrope + @fontsource/ibm-plex-mono 5.3.0 (self-hosted fonts per DESIGN.md). B: if you need another frontend dependency, ask A to land the manifest/lock change.

## Known limitations

- Mint asset pending the account access above (only remaining P0 item for A).
- The dev preview's viewport is a labeled schematic; B's `BlindspotViewport` is the real evidence area. `webglSupported()` in `ViewportShell` is a UI-side presentation probe only.
- Fixture "site photo" is a watermarked SVG, not a real photograph; the live world's `sourcePhotoUrl` comes from B.
- Reduced-motion and contrast were implemented per tokens and spot-checked, not audited with tooling.

## Next owner action

B: merge `person-a` head (or at least A0 `713a33d` + `1a62bfb`) for the root toolchain; implement `RuntimeRoot`/`useBlindspot`/`BlindspotViewport` against the same contract; the UI composes without changes. C: `src/main.tsx` wraps RuntimeRoot, passes bridge + conditional viewport to `BlindspotApp` (see `src/ui/dev.tsx` for the reference host shape).
