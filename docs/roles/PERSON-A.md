# Person A — interface and visual craft

You build the complete user-facing product with the supplied Claude coding tool. Your work is half the product experience; B handles the difficult simulation/data work. Branch: `person-a`. Read the common instructions before coding.

## Your finish line

A production-quality neumorphic inspection workspace, controller, and report that work through the frozen state/actions contract. It runs independently with labeled fixtures and composes with B without changing UI components. A real Mint-created robot GLB is included with provenance. Screenshots demonstrate the desktop and phone states.

## Implement in this order

1. **A0 bootstrap, first 20 minutes.** Create Vite + React + strict TypeScript at the repository root. Use npm and one root lockfile. Reserve every dependency and script in CONTRACTS.md, verify peer compatibility, and pin the resolved versions. Supply multi-entry `ui.html`, `engine.html`, and `index.html` support without creating B/C entry files; each mode builds only its own existing entry. Push A0 immediately and put its SHA in your handoff so B can merge it. Do not add Next.js, a second package manager, or a UI framework that fights the neumorphic tokens.
2. Create `src/ui/BlindspotApp.tsx`, exporting `BlindspotApp({state, actions, viewport})`. It receives a viewport React node from the host, not an engine instance. Use shared types, no Convex imports, no provider requests, no sensor math.
3. Implement DESIGN.md: shell, left rail, source photo, sentence composer, hazard rows, sensor drawer, two-needle dial, shared playback controls, run status, and report transition. Use fixed fixture timestamps/seeds and realistic but visibly marked sample data.
4. Create a fixture bridge in `src/mocks/` and `src/ui/dev.tsx`. The UI preview works without API keys or a Convex deployment. Buttons must mutate fixture state plausibly, including queued/running/completed/error. Do not label fixture progress or fake hazard outcomes as live.
5. Build the phone controller and report as lightweight UI routes selected by contract state. Phone buttons submit existing presets through `actions.requestConfig`; there is no provider-generation button and no report owner token in a URL. Report takes `ReportSnapshot`; it is fully printable, supports long reasons, and includes all limitations and null states.
6. Use **Mint MCP for one visible robot body**. Follow the official tutorial/OAuth workflow in TECHNICAL-NOTES.md. Prompt for a compact industrial wheeled inspection robot, low-poly GLB, clean proportions and understated materials. Import the final artifact into `public/mint/` only if redistribution is allowed. Write sanitized provenance with task ID/Mint handoff, time, prompt, artifact checksum and source. Give B the asset path and visual bounding box. The generated mesh does not define the physical robot envelope. If OAuth is missing, complete the UI and report Mint access as the specific blocker; do not claim a procedural robot is Mint-generated.
7. Run the A acceptance checks and capture the bounded desktop/mobile/report review. Apply one defect batch and one confirmation pass. Work with B's real bridge once it exists; route logic bugs to B, fix your layout/interaction bugs yourself.
8. Update `docs/handoffs/PERSON-A.md`, commit and push only `person-a`. Leave no unimplemented button or silently swallowed error in a required flow.

## Specific UX requirements

- The scene dominates; control chrome is calm and tactile. Use both raised and inset states intentionally, not a shadow on every div.
- Ground truth and perception always have labels, time, and run version. A renders surrounding overlays; B owns canvas labels that require 3D positioning.
- Show scale source/confirmation during calibration and persist it in the report. Call `actions.confirmCalibration` with the operator reference and reviewed correction; B validates/applies the transform. `state.world` supports this before a scenario exists. Never infer “exact scale” from a standard door.
- Pending config and last completed result are distinct. Never show an old gauge under a newly selected configuration without a “Previous run” label.
- Coverage shows `detectedBeforeStopBoundary / eligible`, unknown/unvisited counts, and a percentage only when denominator is nonzero and unknown is zero. False stops show `falseStopEvents / allStopEvents`; 0/0 displays “No stop events,” not 0%.
- No unsupported generic wire-failure statistic or claim of safety. Include `CLAIM_BOUNDARY` verbatim in every report and as accessible nearby text in the main workspace.
- Load expensive rendering only on the operator workspace; phone/report still work on devices without WebGL.
- Local authoring calls are disabled in the public read-only/controller build. Clear “Operator workstation required” state, not a broken localhost fetch.

## What you must not leave for C

Layout fixes, missing states, routes, responsive CSS, event bindings, fixture-only assumptions, report formatting, dependency installation, or Mint asset integration. C plugs B's bridge and viewport into your exported app; that must be enough.

## Evidence and completion

Run `npm run typecheck`, `npm run build:ui`, and your focused UI interaction tests. Test keyboard, 360/390px controller, 1440px workspace, long content, queued state, offline/reconnect, null gauge, report not found, and print. Include commands, actual results, preview instructions, screenshots, A0 SHA, final SHA, Mint status, and remaining blockers. Never report an unrun command as passing.
