# Backend fixture verification

Verified locally on 2026-09-05 after the report-assumption change.

| Command | Result |
| --- | --- |
| `npm run test:backend` from `services/provider` | 22 tests passed in one file; Vitest reported 3.58 seconds |
| `./node_modules/.bin/tsc -p convex/tsconfig.json --noEmit` from the repository root | Passed, including strict indexed-access checks |
| `npm run typecheck` from the repository root | Passed |

The suite uses Convex 1.45.0, convex-test 0.0.56, Vitest 5.0.0, and the edge-runtime test environment. Tests live in `convex/tests/backend.check.ts`.

Coverage includes:

- Capability hashing, sanitized public state, controller restrictions, and owner-only latest-version queries with session isolation.
- Idempotent bootstrap/config requests, one operator lease, expired-lease fencing, immutable completed runs, and rejection of stale results as the current selection.
- Actual analytic engine outputs for all three presets, preserving scenario geometry, route, seed, results, and saved braking decisions.
- Coverage denominators, unknown suppression, event counters, stopping-distance formulas, pre-braking truth corridors, and incomplete-report publication gates.
- Bounded ingestion, immutable versions, unsafe URL rejection, upload MIME/digest checks, durable asset ownership, and report checksum consistency.
- Immutable report reads after subsequent edits. Inspected estimated scale retains `assumed` evidence and explicit uncertainty; unverified registration cannot publish.
- Scenario and hazard return assumptions appear in deduplicated report limitations, including the explicit `Development bulk proxy: Tripo integration pending.` label. Existing published snapshots remain unchanged.

These are fixture-backed backend checks. Storage fixtures explicitly supply MIME metadata because convex-test 0.0.56 omits it when storing a Blob. They do not verify deployed Convex networking, real uploads or public URL reloads, cross-browser subscriptions, GPU depth rendering, sponsor generation APIs, or calibration of a real site. No deployment was performed in this verification pass.
