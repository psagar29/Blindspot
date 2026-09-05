# Three-person build plan

This plan replaces the implementation schedule in the v2 brief where they conflict. All times are September 5, 2026, PDT. If starting late, compress P1 and rehearsal preparation, never move the official 18:00 deadline. Prioritize a complete P0 slice over feature count.

## Work distribution

A owns approximately half the product implementation by surface area, with less mathematical/backend complexity. B owns the other half and deliberately gets the heavier coding. C is the repository owner and integration lead, **not a third subsystem implementer**.

| Owner | Deliverables | Exclusive paths |
| --- | --- | --- |
| A — Claude Fable 5.1, as supplied by user | All product UI, neumorphic system, state presentation, controller/report pages, fixtures, Mint robot asset, frontend bootstrap | `src/ui/**`, `src/styles/**`, `src/mocks/**`, `public/mint/**`, `docs/evidence/a/**`, `docs/handoffs/PERSON-A.md`, root `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `ui.html` |
| B — Codex Astra | Engine, splat/proxy rendering, metrics, calibrated world, Tripo hazard, provider service, runtime adapter, Convex functions, engine harness | `src/engine/**`, `src/runtime/**`, `src/data/**`, `convex/**`, `services/provider/**`, `public/demo/**`, `docs/evidence/b/**`, `docs/handoffs/PERSON-B.md`, `engine.html` |
| C — owner | Small composition entry, merges, deployment config, end-to-end checks, recorded demo and submission preparation | `src/main.tsx`, `index.html`, hosting config, `e2e/**`, `docs/evidence/c/**`, `docs/handoffs/PERSON-C.md`, final README status |
| Frozen shared baseline | This plan, product/design specification, contracts | `shared/**`, planning docs, AGENTS.md, CLAUDE.md; no unilateral breaking changes |

A and B each supply a working isolated preview, their own tests, and a ready-to-compose export. Do not leave C “connect frontend to backend,” “finish sensor rendering,” or “make report persistence work.” Those belong to B's adapter and A's props-driven UI. C should need roughly 20–40 lines of product composition plus hosting configuration, not a rewrite.

## P0 — required vertical slice

1. A prepared Marble world with splats and aligned collider; measured or explicitly estimated scale; source-photo provenance.
2. A ground robot with bounded motion and braking; one straight or gently bent route.
3. Three hazards: two exact procedural cable placements with different dimensions/ranges, plus one normalized Tripo bulk asset and explicit collision box. A Mint-generated robot visual body establishes Mint's real contribution.
4. One passive-stereo approximation; depth/proxy render, coherent intrinsics, thin-target visibility threshold, and late detection with finite braking. No stochastic material model required.
5. Truth/perception split with the same pose and timestamp. Geometry drives collision; degraded points drive stop decisions.
6. Full-route diagnostic scan for coverage plus one reactive outcome run. Computed coverage and actual false-stop metrics; zero false stops is an honest valid result.
7. Convex-backed bounded phone presets, one operator executor, versioned config/result, and persisted Hazard Library.
8. A public read-only report URL containing an immutable snapshot, limitations, provenance, and denominators. The public report loads with the laptop offline.
9. Chat-shaped scenario authoring accepts a sentence plus optional photo. P0 may use a clearly labeled deterministic preset parser if runtime model access is absent. Do not pretend this is live model reasoning.

## Explicit non-goals

Aerial, ToF, LiDAR, optical-flow drift, catenary solver, model-generated adversarial placements, second site, leaderboard, signup/accounts, payments, sensor shopping/budget optimizer, rigid-body dynamics, SLAM, training, VR, voxel grids, mobile 3D, or multi-user simulation execution are not P0. A taut procedural cable is enough. P1 work may not consume time needed for the report, sponsor evidence, or rehearsal.

## Milestones and synchronization

| Time | A | B | C / integration gate |
| --- | --- | --- | --- |
| 10:00–10:20 | Bootstrap Vite/React/TS, pin compatible dependency set, implement fixture adapter boundary | Verify credentials/API shapes, initiate one fallback world; work on pure math while jobs run | Confirm onsite team/prior-work/submission rules; create local integration branch when ready |
| 10:20–11:00 | Push `A0` bootstrap; shell, source photo, input, layout | Cache fallback before venue attempt; create Tripo bulk asset; world transforms and ruler | Early merge of A0 locally; no root-dependency guessing |
| 11:00–12:00 | Main view components + Mint robot generation/import | Proxy depth, back-projection, cable threshold, synced viewport | Verify both previews launch; owners fix their own issues |
| 12:00–13:00 | Controller/report/empty/error states using fixtures | Reactive route, swept collision, finite braking, diagnostic coverage | First composed slice locally as soon as A/B exports exist; do not wait until freeze |
| 13:00–14:00 | Connect all UI events to contract; design pass | Convex persistence/live subscriptions, command queue, immutable report, full B adapter | **14:00 gate:** one completed ground run + real scores + reloadable report. If absent, remove P1 |
| 14:00–15:00 | Responsive/print/a11y polish, evidence | Fix ground issues; bounded authoring parser/model integration; caching/recovery | Phone-to-laptop-to-report flow; verify actual sponsor provenance |
| 15:00–16:00 | Fix integration findings in owned code | Fix integration findings; optional aerial only if all P0 gates pass | Merge approved branch heads; rehearse; identify deployment settings |
| 16:00 | **Feature freeze** | **Feature freeze** | No new mode/provider/model. Only acceptance failures may change code |
| 16:00–17:00 | Help capture UI evidence | Help capture reproducible run | Full smoke, deployment/read-only report, backup video by 17:00 |
| 17:00–17:45 | Rehearse | Rehearse | Two-minute script; verify submitted links and exact organizer form |
| 17:45–18:00 | Buffer | Buffer | Owner submits by 18:00 under the actual onsite instructions |

The official page has an inconsistent lunch/build gap; use onsite timing. Our work table is internal planning, not an official schedule.

## P1 admission and cut order

Admit P1 only when A/B previews compose, one real run is stored, the phone can queue the next version, and a public report reloads. Prefer fixing the venue world over adding an entire modality. Maximum one P1 extension at a time.

Cut in order: aerial → second world → texture dropout/second sensor → model-driven placement (keep labeled preset authoring) → reactive planner complexity (keep a visibly labeled scripted diagnostic scan and observed collision check). Never cut truth/perception separation, declared scale, honest metrics, the report, local-secret handling, or the real-versus-fixture label. If reactive evaluation is removed, mark reactive collisions/false stops as not evaluated rather than inventing them.

## Merge discipline

Only `main`, `person-a`, and `person-b` are published for this planning kit. C remains local. Each owner pushes coherent checkpoints with handoff updates. A's A0 commit supplies the shared dependency baseline; B may merge that commit into `person-b` to run the root harness, without taking over A files. Subsequent integration must use ordinary merges, never force resets. C merges A, then B; if a conflict is in an owned feature, send it to that owner rather than implementing their feature.

After B's backend freeze, C is the sole backend deployer. A/B must stop background deployment watchers before C's release run. A frontend on another Git branch still writes to the same Convex dev deployment if configured to the same URL.
