import { v } from "convex/values";

export const presetId = v.union(v.literal("baseline"), v.literal("higher_resolution"), v.literal("permissive"));
export const vec3 = v.array(v.number());
export const pose = v.object({ positionM: vec3, orientation: v.array(v.number()) });
export const evidence = v.union(v.literal("operator_measured"), v.literal("provider_estimated"), v.literal("assumed"));
export const asset = v.object({
  id: v.string(), source: v.union(v.literal("marble"), v.literal("tripo"), v.literal("mint"), v.literal("procedural")),
  url: v.string(), thumbnailUrl: v.optional(v.string()), sha256: v.string(),
  providerTaskId: v.optional(v.string()), providerModelId: v.optional(v.string()), createdAt: v.string(),
});
export const calibration = v.object({
  status: v.union(v.literal("unverified"), v.literal("verified")),
  source: v.union(v.literal("provider_metric"), v.literal("operator_reference"), v.literal("estimated_reference")),
  rawMetricScaleFactor: v.optional(v.number()), rawGroundPlaneOffset: v.optional(v.number()),
  splatToWorld: v.array(v.number()), colliderToWorld: v.array(v.number()),
  reference: v.optional(v.object({ label: v.string(), lengthM: v.number(), evidence })),
  correctionFactor: v.number(), uncertaintyNote: v.string(), verifiedAt: v.optional(v.string()),
});
export const world = v.object({
  id: v.string(), version: v.number(), name: v.string(), sourcePhotoUrl: v.string(),
  splat: asset, collider: asset, calibration,
  preparationMs: v.union(v.number(), v.null()), cached: v.boolean(),
});
export const libraryItem = v.object({
  id: v.string(), version: v.number(), name: v.string(), type: v.union(v.literal("cable"), v.literal("bulk")),
  asset: v.optional(asset), dimensionsM: vec3, dimensionEvidence: evidence,
  materialClass: v.union(v.literal("opaque"), v.literal("dark_matte"), v.literal("glass"), v.literal("unknown")),
  returnAssumption: v.string(),
});
export const geometry = v.union(
  v.object({ kind: v.literal("cable"), startM: vec3, endM: vec3, diameterM: v.number() }),
  v.object({ kind: v.literal("box"), pose, dimensionsM: vec3 }),
);
export const hazard = v.object({
  id: v.string(), libraryItem, geometry,
  placementSource: v.union(v.literal("operator"), v.literal("preset"), v.literal("model_proposal")),
  observedInPhoto: v.boolean(), justification: v.string(),
});
export const platform = v.object({
  mode: v.union(v.literal("ground"), v.literal("aerial")), radiusM: v.number(), heightM: v.number(),
  speedMps: v.number(), brakingDecelerationMps2: v.number(), controlLatencyS: v.number(), clearanceMarginM: v.number(),
  visualAsset: v.optional(asset),
});
export const sensor = v.object({
  id: v.string(), kind: v.literal("passive_stereo_approximation"), mount: pose,
  widthPx: v.number(), heightPx: v.number(), horizontalFovRad: v.number(), nearM: v.number(), farM: v.number(),
  minResolvableWidthPx: v.number(), textureDropoutEnabled: v.boolean(),
});
export const sensorConfig = v.object({
  id: v.string(), version: v.number(), presetId, label: v.string(), sensors: v.array(sensor),
  modelVersion: v.string(), assumptions: v.array(v.string()),
});
export const scenario = v.object({
  id: v.string(), version: v.number(), world, hazards: v.array(hazard), route: v.array(pose),
  platform, seed: v.number(), authoring: v.union(v.literal("preset"), v.literal("model")),
  sentence: v.string(), assumptions: v.array(v.string()),
});
export const coverage = v.object({
  pass: v.literal("diagnostic_full_route"), eligibleEncounters: v.number(), detectedBeforeBoundary: v.number(),
  missedOrLate: v.number(), unknown: v.number(), excluded: v.number(), percent: v.union(v.number(), v.null()),
});
export const outcome = v.object({
  pass: v.union(v.literal("reactive"), v.literal("not_evaluated")),
  collisions: v.union(v.number(), v.null()), nearMisses: v.union(v.number(), v.null()),
  stopEvents: v.union(v.number(), v.null()), falseStopEvents: v.union(v.number(), v.null()),
  falseStopPercent: v.union(v.number(), v.null()), routeCompletionPercent: v.union(v.number(), v.null()),
  completionTimeMs: v.union(v.number(), v.null()),
  termination: v.union(v.literal("completed"), v.literal("collision"), v.literal("stopped"), v.literal("timeout"), v.literal("not_evaluated")),
});
export const finding = v.object({
  hazardId: v.string(), status: v.union(v.literal("detected_in_time"), v.literal("late"), v.literal("missed"), v.literal("unknown"), v.literal("excluded")),
  firstDetectionRangeM: v.union(v.number(), v.null()), firstDetectionAxialDepthM: v.union(v.number(), v.null()),
  theoreticalThresholdRangeM: v.union(v.number(), v.null()), requiredStoppingDistanceM: v.union(v.number(), v.null()),
  reason: v.string(), sampleMethod: v.union(v.literal("raster"), v.literal("analytic_with_occlusion"), v.literal("not_evaluated")),
});
export const event = v.object({
  timeMs: v.number(), kind: v.union(v.literal("first_detection"), v.literal("braking"), v.literal("stop"), v.literal("collision"), v.literal("near_miss")),
  hazardId: v.optional(v.string()), positionM: vec3,
});
export const brakingDecision = v.object({
  timeMs: v.number(), pose, speedMps: v.number(), corridorM: v.number(),
  truthHazardIds: v.array(v.string()), environmentInCorridor: v.boolean(),
});
export const completedRun = v.object({
  id: v.string(), scenarioId: v.string(), scenarioVersion: v.number(), config: sensorConfig, seed: v.number(),
  coverage, outcome, findings: v.array(finding), events: v.array(event), completedAt: v.string(), engineVersion: v.string(),
  execution: v.literal("client_computed"),
});
export const reportSnapshot = v.object({
  contractVersion: v.literal(1), id: v.string(), title: v.literal("Site Blind Spot Report"),
  status: v.union(v.literal("blind_spot_observed"), v.literal("no_failure_observed"), v.literal("incomplete")),
  publishedAt: v.string(), scenario, run: completedRun, claimBoundary: v.string(),
  limitations: v.array(v.string()), evidenceImageUrls: v.array(v.string()),
});
