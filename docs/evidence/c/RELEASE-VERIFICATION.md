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
- Baseline run: `jh7bbszcrpz8k4kq2aspzkmezn8dtee7`, config v2, 2/3 coverage, 1/1 false stops.
- Phone request: higher-resolution preset, queued as config v3.
- Higher-resolution run: `jh71fms7e3r2ws6d02sgqmb0vs8dvb2z`, config v3, 2/3 coverage, 0/1 false stops, reactive outcome `stopped`.
- Immutable report: `5ef08b92-cab3-45d1-a4fd-5b53c9dcaf3f`.
- Report snapshot SHA-256: `76aa9e74194b574390d97fb2ee7ef0fcb2f18fbc040e0110489c2781edefdaeb`.

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
- Tripo: authorized, but credits unavailable. No Tripo task/model/asset is claimed. The release uses the explicit development bulk proxy.
- Runtime model: not configured. Authoring uses the labeled deterministic preset parser.
- Demo site: Marble-generated warehouse from a text prompt, not a real venue photograph.

The controller capability first used during browser inspection was rotated immediately afterward; the prior capability was verified rejected. Only the current QR fragment carries the replacement capability, and no raw capability is recorded here.
