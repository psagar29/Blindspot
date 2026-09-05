# Person C — owner, integration, and release

You are the repository owner. Your job is to combine finished A and B work with minimal coding. **Do not push a `person-c` branch to GitHub.** Create/resume it locally. The published branches are main, person-a, person-b.

## Your finish line

A composed, verified app; durable public phone/report URLs; an operator laptop that can run the actual simulation; a backup recording; and a submission package. A/B fix their own missing features. You do not build a second implementation of either half.

## Before merging

1. Inspect Git status and preserve local work. Fetch origin. Confirm A/B handoffs contain commands, exact SHAs, contract exports, and honest integration status. Run `node scripts/check-plan.mjs`.
2. Check onsite rules, team eligibility, prior-work allowance and submission form because the public page omits them. Record what the organizer actually said, without claiming this plan establishes eligibility.
3. Create the local branch from current main: `git switch -c person-c origin/main`. If it already exists, switch to it instead; do not reset it. No `git push -u origin person-c`.
4. Integrate as soon as coherent checkpoints exist; do not wait until 16:00. Read A's A0 instructions and B's deployment ownership status.

## Merge and assemble

Use normal sequential merges of the recorded A/B handoff commits (or verified latest branch heads): A first, B second. Never force-push or discard conflict content. If both have changed the same owned feature, let its owner resolve the conflict; you may resolve mechanical imports and nonsemantic merge conflicts.

Create `index.html` and `src/main.tsx`. The intended composition is:

```tsx
// B's runtime includes its own providers, routing and subscriptions.
const bridge = useBlindspot();
return <BlindspotApp {...bridge}
  viewport={bridge.state.route.kind === 'workspace'
    ? <BlindspotViewport /> : null} />;
```

Use the exact contract/export definitions, not this pseudocode to invent new behavior. B's `RuntimeRoot` wraps this component and provides required Convex/session context; B exports the lazy viewport. Add React StrictMode only if B has verified effect/worker lifecycle is idempotent. Do not write a hook for every backend endpoint yourself.

Install with `npm ci` and the provider service's own `npm ci`. A owns correcting a missing root dependency. Run `npm run typecheck`, `npm run test`, `npm run build`, and the owner-focused previews. Do not use `--force` to suppress incompatible peers or skip errors.

## Deployment topology

- Operator runs the local app and local provider service on the laptop; provider keys remain local. Keep the app visible and the operator lease alive during the demo.
- Deploy the frontend controller/report bundle to an existing authorized static host with SPA deep-link fallback. Set only public `VITE_CONVEX_URL`, `VITE_PUBLIC_APP_ORIGIN`, and `VITE_AUTHORING_ENABLED=false`. Do not upload `.env.local` or any provider/deploy keys.
- B has already deployed Convex and implemented reports/storage. After B freezes and stops watchers, C may deploy the exact integrated Convex code using privately supplied local CLI credentials if the owner authorizes the release. No cloud secret migration is part of this plan.
- Public report snapshots/assets must come from durable storage or permitted bundled assets, never laptop paths, blob URLs, or expiring provider URLs. Phone control needs the laptop running; public report reading does not.
- If no hosting account is connected, prepare the build and exact publish settings and ask for the required account action. Do not purchase hosting, invent a URL, or pretend localhost is public.

## Verify and hand back defects

Run ACCEPTANCE.md once end to end on a fresh browser and a real phone/second browser. Confirm the operator applies the queued config version once, the run completes with that version, the report snapshots it, and reloading the public report after stopping the local service still works. Verify all four sponsor contributions have real evidence. Missing sponsor proof is an unresolved item, not an invitation to add a new integration yourself.

Own only small composition/deployment fixes. Send UI/visual defects to A and engine/data defects to B with reproduction steps and the failing version. Merge their fixes and rerun only affected checks plus the final end-to-end path. You may cut P1 at the declared gates.

## Release and submission

By 17:00 record a backup video of the actual working version and capture one report. Rehearse DEMO.md twice to two minutes. Prepare the repository URL, deployed controller/report URLs, concise description, real sponsor contribution summary and fallback video; the owner submits using the organizer's actual requirements.

Keep `person-c` local. When the owner instructs promotion to main, merge the tested local integration into an up-to-date main using a normal merge and push main; do not force a non-fast-forward push. If main has advanced, incorporate it and recheck affected behavior. A/B branches stay available as implementation history. A remote C branch or PR requiring one is outside the current instruction.

Update `docs/handoffs/PERSON-C.md` with A/B SHAs, integrated SHA, actual check results, URLs, deployment configuration names (no secrets), backup location and open limitations. The GitHub planning baseline does not itself authorize a future agent to publish an unreviewed application.

The operator environment must also set `VITE_PUBLIC_APP_ORIGIN` to the deployed frontend HTTPS origin and restart Vite before generating QR/report links. Localhost is never the public share origin. B supplies the seed/bootstrap command and protected local session delivery; C does not construct capabilities or seed documents by hand.
