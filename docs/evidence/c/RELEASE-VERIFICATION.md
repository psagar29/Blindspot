# Person C release verification

Validated on 2026-09-05 against the `standing-pony-711` Convex development deployment and the public static app origin. This record contains no provider keys, deployment credential, owner capability, or controller capability.

## Integration provenance

- Planning baseline: `5eec10e81dbeeb07909703b318dc8934b8937030`
- Person A exact tip: `1978e7cdff8cfc8ee0553a48a3304ff4d5d481ac`
- Person A merge: `6039785`
- Person B exact tip: `e6a13ba91b9c06b997686b438bc505bb8d9c8af5`
- Person B merge: `bb78809`
- Integrated implementation: `752fb4f`

## Deterministic checks

| Command | Result |
| --- | --- |
| `node scripts/check-plan.mjs` | passed |
| `npm ci` | 171 packages, 0 vulnerabilities |
| `npm --prefix services/provider ci` | 52 packages, 0 vulnerabilities |
| `npm run typecheck` | passed |
| `npm test` | 38/38 passed |
| `npm run build:ui` | passed |
| `npm run build:engine` | passed |
| production `npm run build` with public env | passed |
| `npm --prefix services/provider run typecheck` | passed |
| `npm --prefix services/provider test` | 18/18 passed |
| `npm --prefix services/provider run test:backend` | 23/23 passed |
| `npm --prefix services/provider run cache:restore` | passed, zero paid requests |

The jsdom UI tests emit expected `HTMLCanvasElement.getContext` notices because no native canvas package is installed; all assertions pass. The WebGL path was exercised in the browser.

## Live path

- Session: `a037b718-842b-40c6-a0ce-bd89a91b4ad3`
- Cached Marble preparation time displayed by the product: 324.1 seconds.
- Mint-only scenario version: v3, containing two exact procedural cables, the authored procedural equipment crate, and the Mint rover visual.
- Higher-resolution run: `jh7cc41wjdhdgfegjjaw8rm1yh8dvfy9`, config v4, 3/3 coverage, 1/1 false stops, reactive outcome `stopped`.
- Phone request: baseline preset, queued as config v5.
- Baseline run: `jh7e5vw01t9v00y7z7aptv86jd8dvf4p`, config v5, 2/3 coverage, no stop-event denominator, reactive outcome `collision`.
- Immutable baseline report: `c95256fa-abb3-4e16-afab-36c06c7c8869`.
- Report snapshot SHA-256: `9c16b0de09f5a9a10cb9a5bb3c9c2e695e2b15db165034b4a599092744d51b5f`.

The operator was inspected at desktop and 390×844 responsive sizes. The phone controller was inspected at 390×844, queued the new version through Convex, and observed the matching completion. The report route was opened directly, reloaded, checked at screen and print media, and rechecked after the local provider and operator were stopped.

## Durable asset verification

The unauthenticated report verifier fetched all report-critical assets over HTTPS and recomputed each digest:

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| Marble SPZ | 1,276,862 | `2142b8cacb96798aa6ca376f165b97669bb854659a462d835e2a084c511bcbd4` |
| Marble collider GLB | 2,194,696 | `8a39154e3a952f7e35a87e0bd29da1ca723bbf373c5b70ca2128761bbc69a4be` |
| Mint rover GLB | 856,760 | `85f69933396b670d9b46c8d3cdd61167a106567e3a28b0ff9ad15693ce3bc845` |

The source preview returned HTTP 200. The report JSON passed the capability/credential-name scan. Mint task provenance is `ks74ch8bya740cjkcz9zp55adx8dtnmn`; the mesh is decorative and the physical platform envelope remains the scenario radius/height.

## Honest external state

- Marble: authorized and credits available; shipped cache and durable assets are real.
- Mint: real generated rover shipped and rendered.
- Convex: real live subscription, bounded controller mutation, operator execution, durable assets, and immutable public report verified.
- Authored bulk control: procedural, with assumed dimensions and sensor-return behavior; no generated-asset claim.
- Runtime model: not configured. Authoring uses the labeled deterministic preset parser.
- Demo site: Marble-generated warehouse from a text prompt, not a real venue photograph.

The controller capability first used during browser inspection was rotated immediately afterward; the prior capability was verified rejected. Only the current QR fragment carries the replacement capability, and no raw capability is recorded here.
