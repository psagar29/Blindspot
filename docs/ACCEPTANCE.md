# Acceptance and evidence

A passing planning-kit check is not proof the application works. These are implementation gates. Owners record actual output/evidence, not checked boxes copied before execution.

## A — independent UI

- Clean checkout plus A0 dependencies launches UI fixture mode without any credentials. Required buttons/events traverse state through the shared actions.
- Neumorphic depth remains legible with shadows disabled; focus and selection have non-shadow cues. Text contrast, 44px touch targets and reduced motion are verified.
- 1440px workspace, 1024px collapsed rail, 390px and 360px controller, report/print have no clipping or page overflow. Long hazard reasons wrap.
- Fixture, cached, live and recording states are unmistakable. Null metrics show not evaluated/no encounters; stale results identify the prior version.
- Keyboard input/playback do not conflict; failures retain input; reconnect state explains what the operator/phone can do.
- Report visibly includes source, authored-vs-observed hazards, scale uncertainty, sensor/model parameters, denominators and claim boundary.
- Mint asset's actual imported GLB and sanitized generation provenance exist, or handoff explicitly marks Mint integration incomplete.

## B — correctness and backend

1. **Transforms:** test known axes, 1m ruler, calibration correction applied once, SPZ/collider floor registration. Unsupported/unverified exports block quantitative publication.
2. **Depth:** known planar targets back-project to expected metres; near/far and invalid-depth behavior is correct. Sensor focal length matches actual raster/FOV. Self/floor do not block the robot.
3. **Visibility:** the ideal cable candidate exists; threshold crossing follows declared projection math. Occluded cables do not produce invented visible points. Analytic candidate sampling is labeled if used.
4. **Motion:** finite latency/braking obeys the chosen stopping distance; a close newly detected cable can still collide. Swept collision detects a thin span between ticks without enlarging its physical diameter.
5. **Reproducibility:** same scenario/config/seed gives same result within documented numerical tolerance. Changing a phone preset leaves route, speed, geometry, seed fixed.
6. **Metrics:** diagnostic full-route denominator includes misses and is independent of early reactive stop. Unknown/unvisited/excluded statuses are explicit; eligible equals detected+missedOrLate+unknown, and any unknown suppresses the percentage and makes the report incomplete. False-stop ratio derives from truth corridor checks saved at the braking decision/pre-braking speed; zero stop denominator is null. Contact/near miss counted once per encounter.
7. **Concurrency:** two open operator tabs cannot claim the same lease/run; duplicate request IDs don't create duplicate configs; stale run version cannot replace a newer selection; offline executor leaves queued status.
8. **Persistence:** report is immutable after later config/library edits. Public report reloads from durable storage and contains no owner/controller token. Unsupported report IDs show not found.
9. **Access:** controller capability only changes bounded presets; cannot complete a run, publish, seize ownership, or create paid jobs. Untrusted input/unknown IDs/ranges fail validation. Provider failures expose no credentials.
10. **Real integration:** Marble SPZ+collider rendered and calibration inspected; the actual Mint rover appears in the scene and report provenance; the procedural bulk control is labeled as authored; Convex changes travel between two browsers; local authoring uses the declared preset fallback.

## C — one end-to-end path

1. Merge recorded A/B heads into local person-c. Clean-install/build/typecheck/tests pass. Confirm B's backend freeze; stop competing watchers.
2. Start the operator from the cached world. Display source photo and scale. Author a supported scenario sentence, visibly distinguishing preset/model.
3. Run baseline: truth and perception are synchronized; at least one documented hazard is missed/late and the reactive outcome follows physics. A collision is desirable for the demo but never fabricated.
4. Open QR controller in a second browser/phone; verify its origin is the deployed app, never localhost. Apply a preset. Observe queued version, one operator run, then matching completed figures. Previous results never masquerade as the new config.
5. Publish report. Open direct public URL in a fresh browser, reload, and verify the complete snapshot/claim boundary. Stop the local provider process and operator tab; the report still loads. Controller correctly says operator offline.
6. Test one provider failure and one disconnected subscription using the cached/queued path. Verify recorded playback is labeled and cannot overwrite measured data.
7. Confirm the three shipped integration evidence records. Confirm no provider/deploy/owner credentials in Git tracked files, built browser JS, sourcemaps, logs, report JSON or share URLs. The limited controller capability is intentionally present only in its QR fragment, never in report URLs.
8. Record the actual demo build. Save screenshots, final run/report IDs, asset checksums, commit SHAs and measured timings. Report any missing external access or failed gate honestly.

## Ready definitions

**Feature ready:** owner preview works, relevant checks pass, handoff complete, branch pushed (A/B only).

**Integration ready:** A/B exports compose without new subsystem work, required assets are durable, real ground run/report works.

**Demo ready:** public report/controller verified, operator startup reproduced, backup video plays, two-minute rehearsal fits, actual submission instructions checked.

Do one batched inspection and one corrective confirmation pass for visual work. Repeat tests when changes/failures justify it; avoid open-ended “polish until perfect.” Never call a feature complete just because a dependency was mocked.
