# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Release stack: React, React Three Fiber, Three.js, SparkJS, World Labs Marble, Convex, and a real Mint-generated rover artifact. Implementation decision: TypeScript + Vite; a local Node provider service; no Next.js server or second frontend framework. Actual compatible dependency versions are pinned together by A during bootstrap.

## Users

A site operator exploring a machine's perception limits; a hackathon judge watching a two-minute demonstration; an audience participant changing a bounded sensor preset on a phone.

## Product Purpose

Turn a site photograph into a generated scene, expose failures under explicit sensor assumptions, and produce a persistent Site Blind Spot Report. The 3D comparison is the demonstration; the report is the deliverable.

## Positioning

“We show where your machine's modeled perception fails before you deploy it.” The product supports a site review. It does not sign off, clear, approve, or certify a real site. Retain the v2 idea of a report-oriented workflow without the contradictory safety-certification implication.

## Operating Context

One operator laptop renders/evaluates. Phones submit configurations and view the current completed result through Convex. No phone is required to render splats. Generated worlds/assets are cached before the live demonstration.

## Capabilities and Constraints

P0: one ground route, stereo approximation, three authored hazards, one world, live session, immutable report. Ground truth geometry and sensor-visible points are separate. Generated scene geometry is approximate. World scale and authored hazard dimensions have explicit provenance.

P1 only after the ground gate: venue world if the fallback is already usable, model-authored placements when API access exists, one extra sensor. Aerial remains optional and is the first major feature removed when late. Cached ninety-second evaluation is an unmeasured target until timed.

## Brand Commitments

Blindspot; proper neumorphism; exceptionally polished 3D presentation. No fabricated metrics, customer logos, certification seals, or “safe” green result. Supplied coding tools: A uses Claude Fable 5.1; B uses Codex Astra. Runtime model credentials/IDs remain unconfirmed.

## Evidence on Hand

The user's v2 brief, the verified public event/API documentation, and private local provider credentials. There is no completed application, measured benchmark, captured venue photo, generated asset, or validated physical-sensor dataset in the planning baseline.

## Product Principles

- Findings are conditional on declared geometry and sensor assumptions.
- A modeled blind spot is useful; a clean run is inconclusive about safety.
- Show the geometric/perception disagreement before explaining infrastructure.
- Every headline number has a denominator, version, and reproducible run.
- Finish one convincing ground case before extending the engine.

## Accessibility & Inclusion

Implementation quality requirement: keyboard operability, visible focus, readable contrast, reduced motion, semantic form labels, and a phone controller with comfortable touch targets. Depth effects must not be the sole indicator of interactivity.
