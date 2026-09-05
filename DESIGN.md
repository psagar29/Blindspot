# Blindspot visual specification

Status: planned direction, not an audit of an implemented UI. The user's neumorphic brief is binding. A owns its execution and verification.

## Direction

A precise, tactile inspection console: soft warm-gray controls frame a cinematic dark scene. The material analogy is a well-made desktop instrument. Controls have restrained depth; data and typography stay crisp. The 3D evidence leads the first viewport. No dashboard full of decorative cards and no landing-page detour.

Main workspace mode: **Operate**, with the 3D comparison as the focal experience. Report mode: **Read**. Phone mode: **Operate**.

## Tokens

| Token | Value / rule |
| --- | --- |
| Canvas / surface | `#E8ECEF` / `#E8ECEF`; same base material |
| Raised shadow | `8px 8px 18px #C7CCD1, -8px -8px 18px #FFFFFF` |
| Inset shadow | `inset 4px 4px 9px #C7CCD1, inset -4px -4px 9px #FFFFFF` |
| Compact control shadow | `3px 3px 7px #C7CCD1, -3px -3px 7px #FFFFFF` |
| Main / secondary text | `#202A32` / `#4D5B66`; check final contrast on actual backgrounds |
| Border / focus | `#AAB4BD` subtle boundary / `#006B78` 2px focus ring, 3px offset |
| Viewport | `#111820`; grid `#25333D`; labels `#EEF3F6` |
| Accent / blind spot | `#006B78` teal / `#A33422` rust; never color alone |
| Radius | 10px controls, 18px panels, 24px viewport frame; no pill for every element |
| Spacing | 4, 8, 12, 16, 24, 32, 48px |
| Typography | Manrope interface, IBM Plex Mono measurements; self-host if practical, system fallbacks |
| Type scale | 12px units/metadata, 14px support, 16px body, 20px section, 28px page title; tabular figures |
| Motion | 140–220ms controls; 300ms panel reveal; honor prefers-reduced-motion |

Surface boundaries also use a fine border so flat displays/high contrast modes remain usable. Raised means clickable or grouped; inset means an input, selected state, or recessed viewport. Do not put inset and raised shadows on the same idle surface. Disabled controls use text/state labels and reduced emphasis, never unreadably low opacity. Restrict large shadows to the outer control rails and viewport shell; lists and report rows are flat. No background blur, gradient blob, ornamental orb, or animated dashboard number.

## Desktop workspace, 1440 × 900 reference

- 64px top bar: compact Blindspot wordmark, site name, connection badge, report action.
- 272px left rail: source-photo thumbnail and world status; sentence input; 3 hazard rows with diameter/dimensions and one-line reason. Show only the active authoring task, not a full chat transcript.
- Remaining area: one large viewport shell, minimum 650px wide. Inside, synchronized ground truth and modeled perception, split 50/50 with persistent corner labels and shared time/run ID. One WebGL canvas with scissor views is preferred to competing contexts.
- Below scene: compact route playback strip; then a shared two-needle dial, hazard coverage and false stops, each with a text value and denominator. No “overall safety score.”
- Sensor controls open in a 320px side drawer only when needed. Report uses the main canvas area; switching views preserves session state.
- The money shot: rust cable and impact annotation in truth view; absent/thin stochastic points in perception; freeze-frame event marker. No large modal over the collision.

At 1024px collapse the left rail to a drawer; keep the scene dominant. At 390px and 360px use the lightweight controller: site/session identity, three preset buttons, one queued/running status, latest completed gauge, and report link. Do not auto-load the 3D engine, splats, or local provider client on phone/report routes. Wide report tables become cards. No horizontal page overflow.

## Components and interactions

`AppShell`, `SourcePhoto`, `AuthoringComposer`, `HazardList`, `SensorDrawer`, `CoverageDial`, `RunTimeline`, `ConnectionStatus`, `PhoneController`, `ReportPage`, `EmptyState`, `ErrorState`, `Skeleton`.

The dial has two named needles on a 0–100 scale: teal hazard coverage (higher means more tested hazards detected in time), rust false-stop rate (lower means fewer false stops). Different needle shapes and adjacent textual values make the distinction legible. Use null / “Not evaluated” before a run. Animate only from real old to real new values; label live previews separately from completed run scores.

Required states: no world, uploading, queued/generating with elapsed time, cached, calibrating/unverified scale, ready, evaluating, publishing, published, provider unavailable, model unavailable, disconnected/reconnecting, WebGL unsupported, expired controller token, report missing. Retry preserves inputs; no fabricated progress percentage. Loading scene shows the actual source image with plain stage text. Report publication is disabled until an eligible completed run exists.

A normal button has a visible border, label, hover state, focus ring, inset pressed state, and at least 44px touch height on mobile. Use native range/form elements under custom styling. Keyboard commands: Space play/pause only when focus is in playback controls; never intercept Space while typing. Announce queued/completed configuration changes without a screen-reader announcement on every simulation frame.

## Report

White/near-white reading surface, a compact tactile header, and flat evidence rows. Include the site photo, model/config versions, scale source and uncertainty, exact hazard dimensions, detection range/failure reason, three scene thumbnails if available, metrics with denominators, and the claim boundary above the fold and in print. Null is “Not evaluated,” never zero. Title: **Site Blind Spot Report**. Status options: “Blind spot observed,” “No failure observed in this run,” or “Incomplete.” No certification tick or safety stamp.

Printable from the browser; no PDF backend. Public read-only URL must survive reload and work without the operator laptop. Session control and local asset-generation controls are absent on a report.

## Bounded polish pass

A captures 1440×900 workspace, 390×844 controller, 360px overflow check, and report/print views with meaningful content. Inspect keyboard focus, contrast, long hazard reasons, 0/100/null values, generation failure, and disconnection together. Fix the findings in one batch and do one confirmation pass. No cosmetic expansion beyond the frozen scope. Put evidence locations and known limits in A's handoff.
