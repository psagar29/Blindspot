import { ConvexError } from "convex/values";
import type { BrakingDecision } from "../src/engine/evaluate";
import type { AssetRef, Calibration, CompletedRun, HazardLibraryItem, Pose, Scenario, SensorConfig, World } from "../shared/contracts";

export function fail(code: string, message: string): never {
  throw new ConvexError({ code, message, retryable: false });
}
export function check(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) fail(code, message);
}
export function finite(value: number, min: number, max: number, label: string) {
  check(Number.isFinite(value) && value >= min && value <= max, "INVALID_VALUE", `${label} is outside its allowed range.`);
}
export function integer(value: number, min: number, max: number, label: string) {
  finite(value, min, max, label);
  check(Number.isSafeInteger(value), "INVALID_VALUE", `${label} must be an integer.`);
}
export function boundedText(value: string, label: string, max = 1000, empty = false) {
  check(typeof value === "string" && value.length <= max && (empty || value.trim().length > 0), "INVALID_VALUE", `${label} has an invalid length.`);
  check(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value), "INVALID_VALUE", `${label} contains control characters.`);
}
export function identifier(value: string, label = "Identifier") {
  check(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value), "INVALID_ID", `${label} is invalid.`);
}
export function hash(value: string) {
  check(/^[a-f0-9]{64}$/.test(value), "INVALID_HASH", "Expected a SHA-256 digest.");
}
function strings(values: readonly string[], max = 24) {
  check(values.length <= max, "TOO_LARGE", "Too many assumptions.");
  values.forEach((value) => boundedText(value, "Assumption"));
}
function date(value: string) {
  check(/^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) && value.length <= 40, "INVALID_VALUE", "Expected an ISO timestamp.");
}
function vector(value: readonly number[], length = 3) {
  check(value.length === length, "INVALID_GEOMETRY", "Geometry has the wrong dimensions.");
  value.forEach((number) => finite(number, -10_000, 10_000, "Coordinate"));
}
function pose(value: Pose) {
  vector(value.positionM);
  vector(value.orientation, 4);
  check(Math.abs(Math.hypot(...value.orientation) - 1) < 1e-5, "INVALID_GEOMETRY", "Orientation must be a unit quaternion.");
}
function dimensions(value: readonly number[]) {
  vector(value);
  value.forEach((number) => finite(number, 0.0001, 100, "Physical dimension"));
}
function matrix(value: readonly number[]) {
  vector(value, 16);
  check(Math.abs(value[3]!) < 1e-8 && Math.abs(value[7]!) < 1e-8 && Math.abs(value[11]!) < 1e-8 && Math.abs(value[15]! - 1) < 1e-8, "INVALID_GEOMETRY", "Calibration must be an affine transform.");
  const determinant = value[0]! * (value[5]! * value[10]! - value[6]! * value[9]!) - value[4]! * (value[1]! * value[10]! - value[2]! * value[9]!) + value[8]! * (value[1]! * value[6]! - value[2]! * value[5]!);
  check(Math.abs(determinant) > 1e-12, "INVALID_GEOMETRY", "Calibration transform is singular.");
}
export function safeAssetUrl(value: string, durable = false) {
  boundedText(value, "Asset URL", 2048);
  if (!durable && /^\/(?:api\/local\/assets|assets)\/[a-zA-Z0-9/_\.%-]+$/.test(value) && !value.includes("..") && !/%(?:2e|2f|5c)/i.test(value)) return;
  let url: URL;
  try { url = new URL(value); } catch { return fail("UNSAFE_ASSET_URL", "Use a permitted asset URL without credentials or signed parameters."); }
  check(url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && !/^(localhost|127\.|0\.|\[?::1\]?)/i.test(url.hostname), "UNSAFE_ASSET_URL", "Use a durable HTTPS asset URL without credentials or signed parameters.");
}
function asset(value: AssetRef) {
  identifier(value.id, "Asset ID");
  hash(value.sha256);
  safeAssetUrl(value.url);
  if (value.thumbnailUrl) safeAssetUrl(value.thumbnailUrl);
  if (value.providerTaskId) identifier(value.providerTaskId, "Provider task ID");
  if (value.providerModelId) boundedText(value.providerModelId, "Provider model ID", 128);
  date(value.createdAt);
}
function calibration(value: Calibration) {
  matrix(value.splatToWorld);
  matrix(value.colliderToWorld);
  finite(value.correctionFactor, 0.001, 1000, "Calibration correction");
  if (value.rawMetricScaleFactor !== undefined) finite(value.rawMetricScaleFactor, 1e-8, 1e6, "Metric scale");
  if (value.rawGroundPlaneOffset !== undefined) finite(value.rawGroundPlaneOffset, -10_000, 10_000, "Ground offset");
  boundedText(value.uncertaintyNote, "Calibration uncertainty", 2000);
  if (value.reference) {
    boundedText(value.reference.label, "Reference label", 160);
    finite(value.reference.lengthM, 0.001, 1000, "Reference length");
  }
  if (value.verifiedAt) date(value.verifiedAt);
  if (value.status === "verified") {
    check(Boolean(value.verifiedAt), "UNVERIFIED_CALIBRATION", "Verified calibration requires its inspection timestamp.");
    if (value.source === "estimated_reference") check(value.reference?.evidence === "assumed", "UNVERIFIED_CALIBRATION", "An estimated reference must retain assumed evidence after registration inspection.");
    if (value.source === "operator_reference") check(value.reference?.evidence === "operator_measured", "UNVERIFIED_CALIBRATION", "An operator reference must be measured.");
    if (value.source === "provider_metric") check(value.rawMetricScaleFactor !== undefined, "UNVERIFIED_CALIBRATION", "Provider metric calibration requires documented scale.");
  }
}
export function validateWorld(input: unknown): World {
  const value = input as World;
  identifier(value.id, "World ID");
  integer(value.version, 1, 1_000_000, "World version");
  boundedText(value.name, "World name", 160);
  safeAssetUrl(value.sourcePhotoUrl);
  asset(value.splat); asset(value.collider); calibration(value.calibration);
  if (value.preparationMs !== null) finite(value.preparationMs, 0, 86_400_000, "Preparation duration");
  return value;
}
export function validateLibraryItem(input: unknown): HazardLibraryItem {
  const value = input as HazardLibraryItem;
  identifier(value.id, "Library ID");
  integer(value.version, 1, 1_000_000, "Library version");
  boundedText(value.name, "Hazard name", 160);
  dimensions(value.dimensionsM);
  boundedText(value.returnAssumption, "Return assumption", 2000);
  if (value.asset) asset(value.asset);
  return value;
}
export function validateScenario(input: unknown): Scenario {
  const value = input as Scenario;
  identifier(value.id, "Scenario ID"); integer(value.version, 1, 1_000_000, "Scenario version");
  validateWorld(value.world);
  check(value.hazards.length >= 1 && value.hazards.length <= 16, "TOO_LARGE", "A scenario requires 1 to 16 hazards.");
  const ids = new Set<string>();
  for (const hazard of value.hazards) {
    identifier(hazard.id, "Hazard ID");
    check(!ids.has(hazard.id), "INVALID_ID", "Hazard IDs must be unique."); ids.add(hazard.id);
    validateLibraryItem(hazard.libraryItem);
    boundedText(hazard.justification, "Placement justification", 2000);
    if (hazard.placementSource !== "operator") check(!hazard.observedInPhoto, "UNSUPPORTED_CLAIM", "Authored stress hazards cannot be labeled photo-observed.");
    if (hazard.geometry.kind === "cable") {
      check(hazard.libraryItem.type === "cable", "INVALID_GEOMETRY", "Cable geometry requires a cable library item.");
      vector(hazard.geometry.startM); vector(hazard.geometry.endM);
      finite(hazard.geometry.diameterM, 0.0001, 1, "Cable diameter");
      const cable = hazard.geometry;
      check(Math.hypot(cable.startM[0] - cable.endM[0], cable.startM[1] - cable.endM[1], cable.startM[2] - cable.endM[2]) > 0.0001, "INVALID_GEOMETRY", "Cable span must be nonzero.");
    } else {
      check(hazard.libraryItem.type === "bulk", "INVALID_GEOMETRY", "Box geometry requires a bulk library item.");
      pose(hazard.geometry.pose); dimensions(hazard.geometry.dimensionsM);
    }
  }
  check(value.route.length >= 2 && value.route.length <= 32, "TOO_LARGE", "A route requires 2 to 32 poses.");
  value.route.forEach(pose);
  let routeLength = 0;
  let hasGroundTravel = false;
  for (let index = 1; index < value.route.length; index++) {
    const current = value.route[index]!.positionM;
    const previous = value.route[index - 1]!.positionM;
    const dx = current[0] - previous[0], dy = current[1] - previous[1], dz = current[2] - previous[2];
    routeLength += Math.hypot(dx, dy, dz);
    if (Math.hypot(dx, dz) > 0.001) hasGroundTravel = true;
  }
  const routeHeight = value.route[0]!.positionM[1];
  check(routeLength <= 50 && value.route.every((point) => Math.abs(point.positionM[1] - routeHeight) <= 1e-6), "INVALID_GEOMETRY", "P0 requires a level route no longer than 50 metres.");
  check(hasGroundTravel, "INVALID_GEOMETRY", "Route must have nonzero ground travel.");
  check(value.platform.mode === "ground", "UNSUPPORTED_MODE", "Only ground mode is supported.");
  finite(value.platform.radiusM, 0.01, 5, "Platform radius"); finite(value.platform.heightM, 0.01, 5, "Platform height");
  check(value.platform.heightM >= 2 * value.platform.radiusM, "INVALID_GEOMETRY", "Platform height must contain its modeled capsule.");
  finite(value.platform.speedMps, 0.01, 3, "Platform speed"); finite(value.platform.brakingDecelerationMps2, 0.01, 30, "Braking deceleration");
  finite(value.platform.controlLatencyS, 0, 5, "Control latency"); finite(value.platform.clearanceMarginM, 0, 5, "Clearance margin");
  if (value.platform.visualAsset) asset(value.platform.visualAsset);
  integer(value.seed, 0, 0xffff_ffff, "Seed"); boundedText(value.sentence, "Scenario sentence", 4000, true); strings(value.assumptions);
  check(JSON.stringify(value).length <= 350_000, "TOO_LARGE", "Scenario exceeds the snapshot limit.");
  return value;
}
export function validateConfig(input: unknown): SensorConfig {
  const value = input as SensorConfig;
  identifier(value.id, "Config ID"); integer(value.version, 1, 1_000_000, "Config version");
  boundedText(value.label, "Config label", 160); boundedText(value.modelVersion, "Model version", 128); strings(value.assumptions);
  check(value.sensors.length === 1, "UNSUPPORTED_SENSOR", "P0 requires exactly one passive stereo sensor.");
  const sensor = value.sensors[0]!;
  identifier(sensor.id, "Sensor ID"); pose(sensor.mount);
  integer(sensor.widthPx, 1, 640, "Sensor width"); integer(sensor.heightPx, 1, 480, "Sensor height");
  finite(sensor.horizontalFovRad, 0.1, Math.PI - 0.1, "Sensor FOV"); finite(sensor.nearM, 0.001, 10, "Sensor near plane");
  finite(sensor.farM, sensor.nearM + 0.001, 100, "Sensor far plane"); finite(sensor.minResolvableWidthPx, 0.1, 20, "Resolution threshold");
  check(!sensor.textureDropoutEnabled, "UNSUPPORTED_SENSOR", "Texture dropout is not implemented in P0.");
  return value;
}
function approximately(value: number | null, expected: number | null, label: string) {
  check(expected === null ? value === null : value !== null && Number.isFinite(value) && Math.abs(value - expected) <= 1e-6, "INVALID_METRICS", `${label} does not match its denominator.`);
}
export function validateCompletedRun(input: unknown, scenario: Scenario, config: SensorConfig): CompletedRun {
  const value = input as CompletedRun;
  identifier(value.id, "Run ID"); boundedText(value.engineVersion, "Engine version", 128); date(value.completedAt);
  validateConfig(value.config);
  check(value.scenarioId === scenario.id && value.scenarioVersion === scenario.version && value.seed === scenario.seed && same(value.config, config), "VERSION_MISMATCH", "Run does not match its frozen scenario/config snapshot.");
  const coverage = value.coverage;
  for (const key of ["eligibleEncounters", "detectedBeforeBoundary", "missedOrLate", "unknown", "excluded"] as const) integer(coverage[key], 0, 32, key);
  check(coverage.eligibleEncounters === coverage.detectedBeforeBoundary + coverage.missedOrLate + coverage.unknown, "INVALID_METRICS", "Coverage must retain missed and unknown encounters.");
  approximately(coverage.percent, coverage.eligibleEncounters === 0 || coverage.unknown > 0 ? null : coverage.detectedBeforeBoundary / coverage.eligibleEncounters * 100, "Coverage");
  check(value.findings.length === scenario.hazards.length, "INVALID_METRICS", "Every hazard requires exactly one finding.");
  const ids = new Set(scenario.hazards.map((hazard) => hazard.id));
  const tally = { detected_in_time: 0, late: 0, missed: 0, unknown: 0, excluded: 0 };
  const platform = scenario.platform;
  const diagnosticStoppingDistance = platform.speedMps * platform.controlLatencyS + platform.speedMps ** 2 / (2 * platform.brakingDecelerationMps2) + platform.clearanceMarginM;
  for (const finding of value.findings) {
    check(ids.delete(finding.hazardId), "INVALID_METRICS", "Findings contain a duplicate or unknown hazard.");
    tally[finding.status]++;
    boundedText(finding.reason, "Finding reason", 2000);
    for (const key of ["firstDetectionRangeM", "firstDetectionAxialDepthM", "theoreticalThresholdRangeM", "requiredStoppingDistanceM"] as const) {
      if (finding[key] !== null) finite(finding[key], key === "firstDetectionRangeM" ? -100 : 0, 10_000, key);
    }
    if (finding.requiredStoppingDistanceM !== null) approximately(finding.requiredStoppingDistanceM, diagnosticStoppingDistance, "Diagnostic stopping distance");
    if (finding.status === "detected_in_time" || finding.status === "late") check(finding.firstDetectionRangeM !== null && finding.firstDetectionAxialDepthM !== null, "INVALID_METRICS", "Detected findings require first-detection measurements.");
    if (finding.status === "detected_in_time" || finding.status === "late") {
      check(finding.requiredStoppingDistanceM !== null, "INVALID_METRICS", "Detected findings require their stopping boundary.");
      check(finding.status === "detected_in_time" ? finding.firstDetectionRangeM! + 1e-9 >= finding.requiredStoppingDistanceM : finding.firstDetectionRangeM! + 1e-9 < finding.requiredStoppingDistanceM, "INVALID_METRICS", "Detection status must agree with the stopping boundary.");
    }
    if (finding.status === "missed" || finding.status === "excluded") check(finding.firstDetectionRangeM === null && finding.firstDetectionAxialDepthM === null, "INVALID_METRICS", "An undetected hazard cannot have a first detection.");
    if (finding.sampleMethod === "not_evaluated") check(finding.status === "unknown" || finding.status === "excluded", "INVALID_METRICS", "Unevaluated findings cannot count as measured detection or miss.");
  }
  check(tally.detected_in_time === coverage.detectedBeforeBoundary && tally.late + tally.missed === coverage.missedOrLate && tally.unknown === coverage.unknown && tally.excluded === coverage.excluded && coverage.eligibleEncounters + coverage.excluded === scenario.hazards.length, "INVALID_METRICS", "Coverage totals must agree with all hazard findings.");
  const outcome = value.outcome;
  for (const key of ["collisions", "nearMisses", "stopEvents", "falseStopEvents"] as const) if (outcome[key] !== null) integer(outcome[key], 0, 2000, key);
  if (outcome.routeCompletionPercent !== null) finite(outcome.routeCompletionPercent, 0, 100, "Route completion");
  if (outcome.completionTimeMs !== null) integer(outcome.completionTimeMs, 0, 3_600_000, "Completion time");
  if (outcome.pass === "not_evaluated") {
    check(outcome.termination === "not_evaluated" && [outcome.collisions, outcome.nearMisses, outcome.stopEvents, outcome.falseStopEvents, outcome.falseStopPercent, outcome.routeCompletionPercent, outcome.completionTimeMs].every((metric) => metric === null), "INVALID_METRICS", "Unevaluated outcomes must have null metrics.");
  } else {
    check(outcome.termination !== "not_evaluated" && outcome.collisions !== null && outcome.nearMisses !== null && outcome.stopEvents !== null && outcome.falseStopEvents !== null && outcome.routeCompletionPercent !== null, "INVALID_METRICS", "Reactive outcomes require measured counters and progress.");
    check(outcome.falseStopEvents <= outcome.stopEvents, "INVALID_METRICS", "False stops cannot exceed all stops.");
    approximately(outcome.falseStopPercent, outcome.stopEvents === 0 ? null : outcome.falseStopEvents / outcome.stopEvents * 100, "False-stop rate");
    check(outcome.termination === "completed" ? outcome.completionTimeMs !== null && outcome.routeCompletionPercent === 100 : outcome.completionTimeMs === null, "INVALID_METRICS", "Only completed routes have a completion time.");
  }
  check(value.events.length <= 2000, "TOO_LARGE", "Run has too many events.");
  let lastTime = -1;
  for (const event of value.events) {
    integer(event.timeMs, 0, 3_600_000, "Event time");
    check(event.timeMs >= lastTime, "INVALID_METRICS", "Events must be in playback order."); lastTime = event.timeMs;
    vector(event.positionM);
    if (event.hazardId) check(scenario.hazards.some((hazard) => hazard.id === event.hazardId), "INVALID_METRICS", "Event references an unknown hazard.");
  }
  if (outcome.pass === "reactive") {
    for (const [eventKind, count] of [["collision", outcome.collisions], ["near_miss", outcome.nearMisses], ["stop", outcome.stopEvents]] as const) check(value.events.filter((event) => event.kind === eventKind).length === count, "INVALID_METRICS", "Outcome counters must match the saved event episodes.");
  }
  check(JSON.stringify(value).length <= 350_000, "TOO_LARGE", "Run exceeds the compact snapshot limit.");
  return value;
}
export function same(left: unknown, right: unknown): boolean {
  const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : value !== null && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, stable(entry)])) : value;
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}
export function reportStatus(scenario: Scenario, run: CompletedRun) {
  if (scenario.world.calibration.status !== "verified" || run.coverage.unknown > 0 || run.coverage.eligibleEncounters === 0 || run.outcome.pass !== "reactive" || run.outcome.termination === "timeout") return "incomplete" as const;
  return run.coverage.missedOrLate > 0 || (run.outcome.collisions ?? 0) > 0 ? "blind_spot_observed" as const : "no_failure_observed" as const;
}

export function validateBrakingDecision(input: unknown, scenario: Scenario, run: CompletedRun) {
  const value = input as BrakingDecision | null | undefined;
  const events = run.events.filter((event) => event.kind === "braking");
  if (!value) {
    check(events.length === 0 && (run.outcome.stopEvents ?? 0) === 0, "MISSING_BRAKING_DECISION", "A braking event requires its saved decision corridor and pre-braking speed.");
    return;
  }
  check(events.length === 1 && events[0]!.timeMs === value.timeMs && same(events[0]!.positionM, value.pose.positionM), "INVALID_METRICS", "The saved braking decision must match its event.");
  integer(value.timeMs, 0, 3_600_000, "Decision time"); pose(value.pose);
  finite(value.speedMps, 0.000001, scenario.platform.speedMps, "Pre-braking speed");
  const expected = value.speedMps * scenario.platform.controlLatencyS + value.speedMps ** 2 / (2 * scenario.platform.brakingDecelerationMps2) + scenario.platform.clearanceMarginM;
  approximately(value.corridorM, expected, "Saved stopping corridor");
  check(value.truthHazardIds.length <= scenario.hazards.length && new Set(value.truthHazardIds).size === value.truthHazardIds.length && value.truthHazardIds.every((id) => scenario.hazards.some((hazard) => hazard.id === id)), "INVALID_METRICS", "Decision corridor references unknown or duplicate hazards.");
  if (run.outcome.pass === "reactive") {
    check((run.outcome.stopEvents ?? 0) <= 1, "INVALID_METRICS", "P0 has at most one reactive stop.");
    const falseStops = run.outcome.stopEvents === 1 && value.truthHazardIds.length === 0 && !value.environmentInCorridor ? 1 : 0;
    check(run.outcome.falseStopEvents === falseStops, "INVALID_METRICS", "False stops must derive from the saved pre-braking truth corridor.");
  }
}
