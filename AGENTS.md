# Start here: role execution

This is a three-person build kit. The user identifies themselves as Person A, B, or C. Execute that role's complete brief rather than merely restating its plan. Do not assume the entire product is your assignment.

1. Inspect Git status and remotes. Preserve uncommitted work. Verify origin is `https://github.com/psagar29/Blindspot.git` or its SSH equivalent.
2. Resolve the role from the latest user instruction, then from the checked-out `person-a`, `person-b`, or `person-c` branch. If neither identifies it, ask which role once. A direct role instruction wins over the current branch.
3. Fetch origin and switch to the existing corresponding A/B branch. Person C creates or resumes a local `person-c` branch from origin/main; never push `person-c` unless the owner later explicitly changes this instruction. If the working tree is dirty, use a separate worktree instead of stashing or discarding someone else's work. Do not recreate remote branches or force-push.
4. Read README.md, PRODUCT.md, docs/BUILD-PLAN.md, docs/CONTRACTS.md, shared/contracts.ts, docs/SETUP.md, docs/ACCEPTANCE.md, and your role brief. A also reads DESIGN.md. B also reads docs/ARCHITECTURE.md and docs/TECHNICAL-NOTES.md. C reads all three handoff files and docs/DEMO.md.
5. Execute P0 first. Make reasonable implementation choices within your ownership. Work autonomously through implementation, meaningful tests, fixes, a commit, and (A/B only) a push to your role branch when repository access is available. C keeps integration local until the owner instructs release to main. A repository link does not grant missing service permissions.
6. Update ONLY your handoff file with commit SHA, commands, evidence, unresolved limits, and the exact next action. Never claim live integrations based on fixtures. Create a PR if the session authorizes it; direct role-branch pushes are enough for C to integrate.

## Boundaries

- A owns UI; B owns behavior/data/3D; C owns assembly/release. Detailed paths are in docs/BUILD-PLAN.md. C must not become the engineer finishing A or B's missing subsystem.
- `shared/contracts.ts` is the frozen boundary. Do not fork duplicate types. Backward-compatible optional additions require a written change note in your handoff; breaking changes require agreement with the other owner before landing. Prefer an adapter inside your ownership over changing the contract.
- A owns root package.json and package-lock.json. The dependency set and scripts in docs/CONTRACTS.md are reserved in advance for B. B owns the independent services/provider package and lockfile. Do not run a root install that commits another competing lockfile.
- A and B may use clearly labeled mocks for isolated development. Production mode must fail visibly if required real services are unavailable. Recorded playback is labeled. A gauge must be computed from a run, never animated to invented values.
- Never commit `.env*` except blank `.env.example`, keys, OAuth tokens, signed upload URLs, private venue photos without permission, or full provider responses with sensitive URLs. No provider secret may be in `VITE_*`, browser JS, Convex documents, report JSON, logs, or GitHub Actions. The user's local-only credential requirement remains binding; cloud secret storage needs separate authorization.
- Only B changes the shared Convex deployment during development. C takes over after B's backend freeze. A uses fixtures/read subscriptions; concurrent `convex dev` processes must not overwrite the same deployment.
- No automatic paid generations on page load, retry loops, or phone actions. Cache by normalized input; require the operator's explicit Generate action, obey a finite budget, and handle missing keys without blocking independent UI/math work.
- Model-selected dimensions, materials, and placement are hypotheses validated by deterministic code and visible assumptions. Never label a modeled failure as a real-world certification.
- Commit real generation provenance without credential-bearing URLs. Do not attribute SparkJS/R3F alone to Mint. Do not invent sponsor rules, model API IDs, measured latency, certified sensor specifications, or asset permissions.
- No unrelated redesign, login system, billing, multi-tenant administration, flight dynamics, voxel map, leaderboard, VR, training pipeline, or second app framework. No endless polish/test loop. Use the bounded acceptance pass.

If a required service login is missing, complete everything independent of it and state the precise access needed. Do not silently replace an external sponsor integration with a fake and mark it complete.
