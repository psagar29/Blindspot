# Setup and access

## Release setup

The application is implemented and publicly hosted. `node scripts/check-plan.mjs` validates the handoff documents and contract presence; the runtime checks are listed in the root README and Person C handoff.

Provider and Convex credentials remain in an owner-controlled file outside the checkout and are loaded only through `BLINDSPOT_ENV_FILE`. The release preflight verified Marble authorization and available credits, Tripo authorization with no available credits, and the intended Convex dev deployment. Values are never printed or copied into the repository.

Public configuration supplied by owner:

- Convex Cloud/client URL: `https://standing-pony-711.convex.cloud`
- Convex HTTP Actions URL: `https://standing-pony-711.convex.site`

These URLs are not secret. React's Convex client takes the **cloud** URL, not the HTTP Actions URL. A deploy credential targeting a dev deployment does not establish that a production deployment exists.

Still required for the remaining gaps: Tripo generation credits, runtime model API access if model authoring is desired, and a permitted real site image/reference dimension. Mint generation, public hosting, and live Convex synchronization are complete. Nothing in a Git clone transfers local secrets or authenticated accounts.

## A

Clone, switch to `person-a`, read AGENTS.md. Complete A0. Copy `.env.example` to `.env.local` only if needed; fixture mode needs no provider keys. For Mint, use the [official MCP tutorial](https://mcp.mint.gg/#how-it-works). Codex setup shown by the tutorial is `codex mcp add mint --url https://mcp.mint.gg/mcp`; authenticate through local OAuth. Claude users follow the tutorial's Claude tab/client-specific command, rather than running a Codex command in an unrelated client.

Optional official 3D skills: [mintdotgg/mint-threejs-skills](https://github.com/mintdotgg/mint-threejs-skills). Install only the relevant client guidance. Generate one robot model, await completion, obtain its artifact manifest, and import the portable GLB with sanitized provenance. Never put OAuth tokens in repository configuration.

## B

Clone, switch to `person-b`, read the technical notes. Privately provision `.env.local` from the blank template and restrict permissions (for example `chmod 600 .env.local`). Do not paste key values into terminal commands, commit messages or debug logs. The local Node process reads that file without printing it; it must not rely on Vite exposing private variables.

Use the Convex CLI from the pinned installed dependency. Select/verify the intended dev deployment and run its documented development command from the project root with the private local env file loaded; avoid choosing or creating a new production target accidentally. Only B runs a deployment watcher during implementation. Keep provider keys in the local service, not Convex env vars. Code generation belongs to B; commit generated client type stubs if required by the selected Convex workflow and ensure the clean checkout builds.

Preflight returns only `configured`, `reachable`, `authorized`, `missing`, or a sanitized error. Do not run commands that print full env listings. Check account/project identity and supported model/export fields with the least costly documented operation before generating. Cache one fallback first and only one or two reusable bulk assets. Subsequent generation needs an explicit operator action with a visible budget; handle rate limiting without resubmission storms.

## C / release operator

Use a local integration branch only. After A/B handoffs, `npm ci` at root and in `services/provider/` must reproduce dependencies. B's README/scripts must state the exact laptop startup commands and ports. Launch local provider service, then local operator app; verify browser requests go through its same-origin proxy. Open public controller/report pages separately.

The public origin is `https://blindspot-site-review.sagarpranav000.chatgpt.site`. Deploy static output with SPA fallback for controller/report URLs; configure only `VITE_CONVEX_URL`, `VITE_PUBLIC_APP_ORIGIN`, and `VITE_AUTHORING_ENABLED=false`. A correct deploy serves deep links on direct navigation, not only after clicking from `/`. Public reports resolve durable storage URLs without localhost. Keep all deployment credentials local to the deployment tool; do not place them in cloud build settings under this owner's local-only requirement.

## Current access-dependent limits

The checked-in fixtures, cache restore, engine, UI, and report verifier run without paid generation. Replacing the development bulk proxy requires Tripo credits. Replacing the preset parser requires a real runtime model endpoint. Generating a site-specific production review requires a permitted image and an independently checked reference dimension.

The operator environment must also set `VITE_PUBLIC_APP_ORIGIN` to the deployed frontend HTTPS origin and restart Vite before generating QR/report links. Localhost is never the public share origin. B supplies the seed/bootstrap command and protected local session delivery; C does not construct capabilities or seed documents by hand.
