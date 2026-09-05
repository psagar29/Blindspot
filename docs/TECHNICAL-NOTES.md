# Verified technical notes and corrections

Checked 2026-09-05 using primary sources. These are planning-time findings, not tests of the supplied keys. Recheck API schema/model availability at implementation time, pin the tested versions and save sanitized provenance.

## World Labs

World generation is asynchronous and usually takes minutes; the quickstart describes roughly five minutes. Ninety seconds is only our cached-evaluation target until measured. Submit `POST https://api.worldlabs.ai/marble/v1/worlds:generate` with `WLT-Api-Key`, persist `operation_id`, and poll `/marble/v1/operations/{operation_id}`. Use the current documented image-upload/reference payload and selected model. [World API](https://docs.worldlabs.ai/api), [models](https://docs.worldlabs.ai/api/models).

Read actual returned `assets.splats.spz_urls`, `assets.mesh.collider_mesh_url` and image references. Start with a modest splat variant (100k/500k if returned) and the ordinary collider; do not wait for high-quality mesh generation. API access/credits are separate from Marble web-app access. [API FAQ](https://docs.worldlabs.ai/api/faq), [export specs](https://docs.worldlabs.ai/marble/export/specs), [mesh exports](https://docs.worldlabs.ai/marble/export/mesh).

The original “four world generations/hour” is incorrect: current API docs describe roughly 3 generation starts/minute and 60/hour; the four/hour figure belongs to high-quality mesh export. Rate limits may vary by account. Cache-first sequencing remains useful. [Rate limits](https://docs.worldlabs.ai/api/rate-limits).

For raw SPZ, official rendering guidance applies `metric_scale_factor`, subtracts `ground_plane_offset` from Y, then rotates 180° about X. Gaussian sizes need the same scale. Do not rely on the brief's ambiguous OpenCV axis prose. The inspected docs do not establish that every GLB collider uses the same raw transform: inspect real floor/doorway/ruler registration and store separate matrices as needed. Never double-scale an already metric GLB. A standard-size door is an estimate unless measured. [SPZ rendering](https://docs.worldlabs.ai/api/rendering-spz).

## Mint MCP

The user's [tutorial](https://mcp.mint.gg/#how-it-works) provides a real local coding-agent workflow: add `https://mcp.mint.gg/mcp`, authenticate with OAuth, generate artifacts, and import them. Optional [official Three.js skills](https://github.com/mintdotgg/mint-threejs-skills) guide scene/app integration. No custom runtime OAuth client or embedded Mint Studio is needed for our chosen contribution.

A's minimal workflow: inspect identity/credits, select/create a project, `start_model_generation`, `wait_for_status`, `get_asset_artifact_manifest`, import its final GLB. Follow live schemas, including required context fields. Preserve sanitized task/Mint handoff, filename, checksum and licensing/provenance. The manifest provides portable artifact URLs/loader hints; do not scrape private download pages. [Tool catalog](https://mcp.mint.gg/docs), [model tool](https://mcp.mint.gg/docs/tools/start_model_generation), [artifact manifest](https://mcp.mint.gg/docs/tools/get_asset_artifact_manifest).

Mint's documented renderer uses Spark/Three/R3F, but using those libraries alone is not using Mint. Our actual Mint artifact is the visible robot body, with a task identifier, artifact manifest, checksum, and imported GLB. The mesh is decorative: physical radius and height remain explicit simple geometry. [World Labs Mint showcase](https://www.worldlabs.ai/labs/showcase/mint), [Mint architecture guide](https://mint.gg/blog/3d-mcp-guide).

## Authored hazard geometry

The two cables and bulk control use deterministic procedural geometry. Their dimensions and sensor-return behavior are assumptions, not provider-certified measurements. Keep visual geometry separate from simple colliders, record dimensions as assumed or operator-measured, and use exact-diameter cables for reproducible threshold tests.

## Sensor and renderer correctness

Spark's transparent splats do not write depth by default; simply reading the appearance framebuffer is not a reliable metric sensor pass. Use an independent opaque collider/hazard-proxy depth+ID pass. Verify the selected Spark/Three/R3F peer/version combination from official examples. [SparkRenderer](https://sparkjs.dev/docs/spark-renderer/), [React resources](https://sparkjs.dev/docs/community-resources/), [official React example](https://github.com/sparkjsdev/spark-react-nextjs).

Camera focal lengths/principal points are measured in pixels and change when resolution changes. A 640px-wide sensor with `fx=600` downsampled to 160px has `fx=150`. For an 8mm perpendicular cable at 5m, width is 0.96 native pixels or 0.24 downsampled pixels. Do not mix native thresholds with sample pixels. P0 declares the low-resolution target as the actual simulated sensor and derives `fx = width / (2 tan(horizontalFov/2))`. [OpenCV calibration](https://docs.opencv.org/4.13.0/d4/d94/tutorial_camera_calibration.html).

For a perpendicular cable, projected width approximately equals `fx * diameter / axialDepth`; threshold crossing is `dCrit = fx * diameter / minPixels`. This is a simplification, not a universal minimum obstacle size. Contrast, orientation, algorithm and active illumination matter. Label the model passive stereo; do not claim all stereo systems fail at a universal 2–3cm/10m cutoff. [Intel stereo depth processing](https://www.intel.com/content/dam/support/us/en/documents/emerging-technologies/intel-realsense-technology/Intel-RealSense-Depth-PostProcess.pdf).

Engineering requirements derived from that model:

- Check ideal cable candidates before degradation. If the raster already loses the cable, analytically sample with occlusion validation or raise the sensor resolution; log the method. Do not make the physical cable thicker.
- A cable can become visible near the robot. Compare first detection with `speed * latency + speed² / (2 * deceleration) + margin`, accounting for the platform envelope consistently. If distances are to the robot center, include radius; if measured from the inflated front surface, do not count it twice. Simulate finite braking.
- Use swept collision to prevent a fast step from tunneling through a thin obstacle. Keep truth collision independent from perception.
- Compute coverage over fixed route encounters, not visible points or a route censored by an early stop. Separate diagnostic scan and reactive outcome metrics.
- False stops are actual incorrect stopping decisions. Higher resolution may improve coverage without creating false stops; no forced inverse gauge animation.

ToF material dropout and beam-energy sampling remain optional synthetic approximations. “Glass always passes through” is not a physical law; reflection/background returns vary with sensor, surface and angle. [SICK glass measurement guidance](https://support.sick.com/sick-knowledgebase/article/?id=ce75003f-20ff-4f33-b948-3696d4588eb3).

## Convex and runtime-model access

Use the `.convex.cloud` URL for the client; `.convex.site` is for HTTP Actions. The provided deploy credential targets a dev environment. Environment variables/deploy keys belong to the selected deployment/CLI context; do not infer production access. Our topology intentionally keeps provider calls local under the owner's credential requirement. [Convex environment variables](https://docs.convex.dev/production/environment-variables), [deploy key types](https://docs.convex.dev/cli/deploy-key-types), [project configuration](https://docs.convex.dev/production/project-configuration).

B's coding-model access does not grant a runtime model key. Configure an account-accessible model ID at runtime if one exists; otherwise label deterministic preset authoring. Runtime model proposals receive bounded zones and schema validation; deterministic geometry/sensor checks author the quantitative claim. Never invent an API identifier from “Astra” or “Fable.”
