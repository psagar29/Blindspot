# Blindspot

**A site photograph becomes a navigable world where we expose what a robot cannot see.**

Blindspot is a hackathon prototype for **Physical AI & Simulation**. Generate a world with World Labs Marble, place dimensioned hazards, run a machine through it, and compare ground truth with modeled perception. Publish a **Site Blind Spot Report** containing the failures and their assumptions.

> Blindspot identifies modeled blind spots. It does not certify safety. A run with no detected failure is not evidence that a site is safe.

This repository currently contains the **implementation plan, frozen interfaces, role instructions, and validation scripts**. The application is not built yet. The v2 brief is the product foundation; the verified corrections in [technical notes](docs/TECHNICAL-NOTES.md) take precedence over its unsupported numerical or API claims.

## Start with your role

Give your coding agent this repository URL and one sentence:

| Person | Paste this | Branch | Responsibility |
| --- | --- | --- | --- |
| A | `I am Person A. Read AGENTS.md and complete my role end to end.` | `person-a` | Frontend, neumorphic design, UI states, phone controls, report UI, Mint asset |
| B | `I am Person B. Read AGENTS.md and complete my role end to end.` | `person-b` | Simulation, rendering, Marble/Tripo, local authoring service, Convex, runtime adapter |
| C | `I am Person C. Read AGENTS.md and complete my role end to end.` | local `person-c` only | Merge A and B, small app entry, verification, hosting, demo handoff |

Repository: <https://github.com/psagar29/Blindspot.git>. If it is not already checked out, clone it first. Agents with no terminal or repository access must be given that access; a URL alone cannot confer it.

Read [A's complete brief](docs/roles/PERSON-A.md), [B's complete brief](docs/roles/PERSON-B.md), or [C's complete brief](docs/roles/PERSON-C.md). Claude-compatible instructions are also in [CLAUDE.md](CLAUDE.md). A's stated coding tool is Claude Fable 5.1; B's is Codex Astra. These are the team's supplied tool labels, not runtime API model IDs or promised capabilities.

The three published branches (`main`, `person-a`, `person-b`) begin from the same planning commit. Per the owner’s instruction, **no Person C branch is pushed to GitHub**. C creates `person-c` locally when integrating. **Main is the common baseline and final release branch.** A and B implement independently; C merges A, then B, into the local `person-c` branch. Nobody should push another person's feature work to main. C promotes the tested integration to main when instructed by the repository owner; do not publish the local C branch.

## The eight-hour product

One cached world, one ground robot, three authored hazards, one stereo model, two synchronized views, a live two-needle gauge, phone configuration, and an immutable report URL. A Mint-created robot body, one Tripo bulk hazard, Marble's world exports, and Convex subscriptions make sponsor use tangible.

The main scene occupies most of the display. Warm gray neumorphic controls surround a dark, legible 3D viewport. Precise typography, real source imagery, procedural cable geometry, and thoughtful loading/error states carry the polish. [Design specification](DESIGN.md).

Fresh Marble generation is asynchronous and can take minutes. **Ninety seconds is a target for evaluating a cached world, not a measured fresh-photo-to-report claim.** We use a kinematic robot with braking; this is a declared sensor approximation, not a validated robotics simulator.

## The plan

- [Product and claim boundaries](PRODUCT.md)
- [Ownership, milestones, and scope cuts](docs/BUILD-PLAN.md)
- [Architecture and local-only credentials](docs/ARCHITECTURE.md)
- [UI/runtime/backend contract](docs/CONTRACTS.md) and [shared TypeScript types](shared/contracts.ts)
- [Verified event and sponsors](docs/EVENT-SPONSORS.md)
- [Technical corrections and sources](docs/TECHNICAL-NOTES.md)
- [Setup and access requirements](docs/SETUP.md)
- [Acceptance tests](docs/ACCEPTANCE.md)
- [Demo and submission runbook](docs/DEMO.md)

## Access and secrets

Copy `.env.example` to `.env.local` and fill it privately. No credentials are stored in this repository. Local credentials do not travel with a clone: the team must provision each required machine privately. A can complete the UI using fixtures without provider keys; Mint uses its own OAuth login. B needs provider credentials. C needs GitHub/hosting access and the public Convex URL.

Provider keys remain in a local Node service on the operator's laptop. Convex holds state and results. The public phone/report app does not receive provider keys. See [setup](docs/SETUP.md) for the operator-laptop versus public-app topology and the few actions that require human account access.

Validate this planning kit with `node scripts/check-plan.mjs`. Application commands are deliverables for A/B/C, listed in their briefs; they do not exist yet.

## Event

Built for the [Spatial Intelligence + Generative 3D Hackathon](https://luma.com/b101ml40), September 5, 2026, San Francisco. The four named technology sponsors are World Labs, Tripo, mint.gg, and Convex; Founders, Inc. Events is the presenter. Published hacking starts at 10:00 AM PDT, submissions close at 6:00 PM, and demos are two minutes. Unpublished rules and onsite changes are tracked separately in the [event notes](docs/EVENT-SPONSORS.md).
