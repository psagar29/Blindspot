# Cached generated warehouse

This is an actual World Labs Marble text generation, not a photograph or a measurement of a real facility. The source preview is generated imagery. The two cables and bulk envelope are authored stress tests added by the engine.

- Provider/model: World Labs, `marble-1.1`.
- Accepted operation: `9faf42c4-d429-4e5c-871a-427caaa2aed2`.
- World: `6fc7e2f0-a62a-4dcf-990b-b94d9cd2e1b5`.
- Preparation: 324097 ms, including polling and export download.
- Prompt: an empty industrial warehouse aisle with flat concrete floor, shelving at the sides and a clear central corridor. The exact fixed prompt is `FALLBACK_PROMPT` in `services/provider/src/providers.ts`.
- Files: 100k SPZ (1276862 bytes), collider GLB (2194696 bytes), generated JPEG preview. Filenames are SHA-256 digests; `world.json` contains sanitized provenance and calibration.
- Calibration: provider scale 1.2551026 and ground offset 0.8235686; both raw exports use the inspected y-down frame. Their separately recorded matrices apply scale, axis conversion and offset once. The inspected floor ray is about 0.004 m above the ground grid.
- Reference: assumed 1 m ruler, correction factor 1. Registration was visually inspected with the wireframe, floor and axes. Absolute scale remains estimated; no physical reference was measured.

Run `npm --prefix services/provider run cache:restore` from the checkout root to restore these files and the accepted completed job to the ignored local cache. This verifies checksums and makes no paid request. It preserves an existing operator calibration. Do not copy `.local/provider/bootstrap.json` to the public directory: it contains private capabilities.

The Marble fallback package does not contain the Mint asset. The real Mint rover is stored separately under `public/mint/`; the authored bulk box remains procedural and explicitly labeled. Provider API keys and signed provider URLs are not included. These exports are provided as generated project demo assets, not as a claim to rights in a real venue photograph.
