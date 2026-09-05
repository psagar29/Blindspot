# Person C handoff

Status: RELEASE COMPLETE, with one declared external blocker: Tripo authenticated but reported no available generation credits, so the bulk obstacle remains a labeled development proxy.

- Integration branch: local `person-c` only; never pushed.
- Preserved planning baseline: `main` at `5eec10e81dbeeb07909703b318dc8934b8937030` when integration began.
- Integrated Person A tip: `1978e7cdff8cfc8ee0553a48a3304ff4d5d481ac`, ordinary merge commit `6039785`.
- Integrated Person B tip: `e6a13ba91b9c06b997686b438bc505bb8d9c8af5`, ordinary merge commit `bb78809`.
- Final implementation commit: `752fb4f` (`Integrate live app and release runtime`). The release-documentation commit is the commit containing this file.
- Release branch: `master`; `main` is preserved as the planning baseline. Remote `person-a` and `person-b` are deleted only after exact-tip ancestry checks; no remote `person-c` exists.

## Completed release work

- Composed `RuntimeRoot`, `useBlindspot`, the route-lazy `BlindspotViewport`, and A's `BlindspotApp` in the production entry.
- Retained the local provider proxy in the normal `npm run dev` command and added the static SPA hosting manifest.
- Integrated the real Mint rover into live scenarios without changing the physical platform radius or height; seed and authoring paths upload the GLB and preview to durable Convex storage.
- Added published-report discovery to the live subscription so operator and controller surfaces recover report links after reload.
- Corrected real/fixture labeling: live Convex/Marble sessions remain live even when the bulk hazard is the explicitly labeled Tripo development proxy; generated imagery is called an image, not a site photograph.
- Added owner-only controller-capability rotation. The initially inspected controller capability was immediately rotated and the revoked capability was verified to fail.
- Verified a real second-browser configuration handoff, matching operator execution, immutable publication, durable asset checksums, responsive controller, print layout, and provider-offline report behavior.

## Reproduction

Run from the repository root. Keep the filled env file outside the checkout.

```bash
npm ci
npm --prefix services/provider ci
npm --prefix services/provider run cache:restore
export BLINDSPOT_ENV_FILE=/absolute/private/path/Blindspot.env
npm --prefix services/provider run preflight
npm --prefix services/provider run deploy:dev
VITE_PUBLIC_APP_ORIGIN=https://blindspot-site-review.briny-comet-2324.chatgpt.site \
  npm --prefix services/provider run seed:demo -- --development-proxy
VITE_PUBLIC_APP_ORIGIN=https://blindspot-site-review.briny-comet-2324.chatgpt.site \
  npm --prefix services/provider run dev
```

Second terminal:

```bash
VITE_AUTHORING_ENABLED=true \
VITE_CONVEX_URL=https://standing-pony-711.convex.cloud \
VITE_PUBLIC_APP_ORIGIN=https://blindspot-site-review.briny-comet-2324.chatgpt.site \
  npm run dev
```

Public build:

```bash
VITE_AUTHORING_ENABLED=false \
VITE_CONVEX_URL=https://standing-pony-711.convex.cloud \
VITE_PUBLIC_APP_ORIGIN=https://blindspot-site-review.briny-comet-2324.chatgpt.site \
  npm run build
```

## Actual verification results

- Planning check passed.
- Root strict typecheck passed; root tests: 38/38.
- UI, engine, and production builds passed. Initial app bundle was about 87 KB gzip; the engine/viewport remained route-lazy at about 2.03 MB gzip.
- Provider typecheck passed; provider/engine tests: 18/18; Convex backend tests: 23/23.
- Cache restore passed and performed zero paid calls.
- Preflight: Marble authorized with credits available; Tripo authorized with credits unavailable; Convex configured; runtime model not configured.
- Browser: cached Marble world rendered with aligned collider, ruler, split truth/perception view, and visible Mint rover. Baseline config v2 completed as run `jh7bbszcrpz8k4kq2aspzkmezn8dtee7`. A phone-sized second browser queued higher-resolution config v3 and the operator completed run `jh71fms7e3r2ws6d02sgqmb0vs8dvb2z`.
- Final result: `blind_spot_observed`, 2/3 hazards detected before the boundary (66.7%), 0/1 false stops, reactive outcome `stopped`.
- Report `5ef08b92-cab3-45d1-a4fd-5b53c9dcaf3f` is immutable and capability-free. Snapshot SHA-256: `76aa9e74194b574390d97fb2ee7ef0fcb2f18fbc040e0110489c2781edefdaeb`.
- The unauthenticated verifier downloaded the durable Marble SPZ (`2142b8ca…`, 1,276,862 bytes), Marble collider (`8a39154e…`, 2,194,696 bytes), and Mint rover (`85f69933…`, 856,760 bytes), each with its expected SHA-256.

## Public artifacts and evidence

- App: `https://blindspot-site-review.briny-comet-2324.chatgpt.site`
- Example report: `https://blindspot-site-review.briny-comet-2324.chatgpt.site/reports/5ef08b92-cab3-45d1-a4fd-5b53c9dcaf3f`
- Release record: `docs/evidence/c/RELEASE-VERIFICATION.md`
- UI/Mint evidence: `docs/evidence/a/`
- Engine/backend/Marble evidence: `docs/evidence/b/`

## Required configuration names

Private provider/CLI: `WORLD_LABS_API_KEY`, `TRIPO_API_KEY`, `CONVEX_DEPLOY_KEY`, optional `MODEL_API_KEY`, `MODEL_BASE_URL`, `MODEL_ID`, and local `PROVIDER_PORT`. Public browser build: `VITE_CONVEX_URL`, `VITE_PUBLIC_APP_ORIGIN`, `VITE_AUTHORING_ENABLED`.

## Known limits and next action

- Obtain Tripo generation credits, run the bounded `cache:demo -- --generate` path once, then reseed without `--development-proxy`. Do not claim Tripo until the GLB, task ID, thumbnail, visible render, and report provenance are verified.
- Supply runtime model credentials only if model authoring is desired; preset authoring is the shipped path.
- Supply a permitted site image and real reference measurement for a site-specific review; the demo warehouse is Marble-generated from text and its scale reference is assumed.
- Recorded point-frame playback is held in the operator tab rather than Convex; summaries and immutable reports survive reload.
- No source or asset license has been declared. Do not assume redistribution rights.

Shared contract changes: none; contract version remains `1`.
