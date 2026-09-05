/** Blindspot contract v1. Plain data only; no framework, provider, or Convex imports. */
export const CONTRACT_VERSION = 1 as const;
export const CLAIM_BOUNDARY =
  "This report identifies blind spots under the stated simulation assumptions. It does not certify safety. No failure observed does not mean no failure exists.";

export type Vec3 = readonly [number, number, number];
export type Quaternion = readonly [number, number, number, number];
/** Column-major asset-to-world transform; 16 finite numbers, validated at runtime. */
export type Mat4 = readonly number[];
export type ProvenanceSource = "marble" | "tripo" | "mint" | "procedural";
export type Evidence = "operator_measured" | "provider_estimated" | "assumed";
export interface Pose { positionM: Vec3; orientation: Quaternion }
export interface AssetRef {
  id: string;
  source: ProvenanceSource;
  /** Durable permitted asset URL/path, never a secret-bearing provider URL. */
  url: string;
  thumbnailUrl?: string;
  sha256: string;
  providerTaskId?: string;
  providerModelId?: string;
  createdAt: string;
}
export interface Calibration {
  status: "unverified" | "verified";
  source: "provider_metric" | "operator_reference" | "estimated_reference";
  rawMetricScaleFactor?: number;
  rawGroundPlaneOffset?: number;
  splatToWorld: Mat4;
  colliderToWorld: Mat4;
  reference?: { label: string; lengthM: number; evidence: Evidence };
  correctionFactor: number;
  uncertaintyNote: string;
  verifiedAt?: string;
}
export interface World {
  id: string;
  version: number;
  name: string;
  sourcePhotoUrl: string;
  splat: AssetRef;
  collider: AssetRef;
  calibration: Calibration;
  preparationMs: number | null;
  cached: boolean;
}
export interface HazardLibraryItem {
  id: string;
  version: number;
  name: string;
  type: "cable" | "bulk";
  asset?: AssetRef;
  /** x width, y height, z depth. Authored envelope, not inferred sensor properties. */
  dimensionsM: Vec3;
  dimensionEvidence: Evidence;
  materialClass: "opaque" | "dark_matte" | "glass" | "unknown";
  returnAssumption: string;
}
export type HazardGeometry =
  | { kind: "cable"; startM: Vec3; endM: Vec3; diameterM: number }
  | { kind: "box"; pose: Pose; dimensionsM: Vec3 };
export interface HazardInstance {
  id: string;
  libraryItem: HazardLibraryItem;
  geometry: HazardGeometry;
  placementSource: "operator" | "preset" | "model_proposal";
  /** Authored stress tests must not be described as photo-confirmed infrastructure. */
  observedInPhoto: boolean;
  justification: string;
}
export interface Platform {
  mode: "ground" | "aerial";
  radiusM: number;
  heightM: number;
  speedMps: number;
  brakingDecelerationMps2: number;
  controlLatencyS: number;
  clearanceMarginM: number;
  visualAsset?: AssetRef;
}
export interface StereoSensor {
  id: string;
  kind: "passive_stereo_approximation";
  mount: Pose;
  widthPx: number;
  heightPx: number;
  horizontalFovRad: number;
  nearM: number;
  farM: number;
  minResolvableWidthPx: number;
  textureDropoutEnabled: boolean;
}
export interface SensorConfig {
  id: string;
  version: number;
  presetId: "baseline" | "higher_resolution" | "permissive";
  label: string;
  sensors: readonly StereoSensor[];
  modelVersion: string;
  /** P0 enforces one sensor and keeps platform motion unchanged across configs. */
  assumptions: readonly string[];
}
export interface Scenario {
  id: string;
  version: number;
  world: World;
  hazards: readonly HazardInstance[];
  route: readonly Pose[];
  platform: Platform;
  seed: number;
  authoring: "preset" | "model";
  sentence: string;
  assumptions: readonly string[];
}
export interface CoverageMetrics {
  pass: "diagnostic_full_route";
  eligibleEncounters: number;
  detectedBeforeBoundary: number;
  missedOrLate: number;
  unknown: number;
  excluded: number;
  /** Null if no eligible encounters OR any unknown encounter; do not hide unknowns. */
  percent: number | null;
}
export interface OutcomeMetrics {
  pass: "reactive" | "not_evaluated";
  collisions: number | null;
  nearMisses: number | null;
  stopEvents: number | null;
  falseStopEvents: number | null;
  falseStopPercent: number | null;
  routeCompletionPercent: number | null;
  completionTimeMs: number | null;
  termination: "completed" | "collision" | "stopped" | "timeout" | "not_evaluated";
}
export interface HazardFinding {
  hazardId: string;
  status: "detected_in_time" | "late" | "missed" | "unknown" | "excluded";
  /** Remaining along-route clearance from platform front envelope at first detection. */
  firstDetectionRangeM: number | null;
  /** Sensor-camera axial depth used by projection, distinct from route clearance. */
  firstDetectionAxialDepthM: number | null;
  /** Camera axial depth for the perpendicular-target approximation. */
  theoreticalThresholdRangeM: number | null;
  /** Path travel needed for latency + braking + margin; envelope already removed. */
  requiredStoppingDistanceM: number | null;
  reason: string;
  sampleMethod: "raster" | "analytic_with_occlusion" | "not_evaluated";
}
export interface RunEvent {
  timeMs: number;
  kind: "first_detection" | "braking" | "stop" | "collision" | "near_miss";
  hazardId?: string;
  positionM: Vec3;
}
export interface CompletedRun {
  id: string;
  scenarioId: string;
  scenarioVersion: number;
  config: SensorConfig;
  seed: number;
  coverage: CoverageMetrics;
  outcome: OutcomeMetrics;
  findings: readonly HazardFinding[];
  events: readonly RunEvent[];
  completedAt: string;
  engineVersion: string;
  execution: "client_computed";
}
export interface ReportSnapshot {
  contractVersion: typeof CONTRACT_VERSION;
  id: string;
  title: "Site Blind Spot Report";
  status: "blind_spot_observed" | "no_failure_observed" | "incomplete";
  publishedAt: string;
  scenario: Scenario;
  run: CompletedRun;
  claimBoundary: typeof CLAIM_BOUNDARY;
  limitations: readonly string[];
  evidenceImageUrls: readonly string[];
}
export type RouteState =
  | { kind: "workspace" }
  | { kind: "controller"; sessionId: string }
  | { kind: "report"; reportId: string }
  | { kind: "not_found" };
export interface SessionSummary {
  id: string;
  siteName: string;
  controllerUrl: string | null;
  operatorOnline: boolean;
  requestedConfigVersion: number | null;
  activeConfigVersion: number | null;
  completedConfigVersion: number | null;
}
export interface FrameSummary {
  timeMs: number;
  pass: "diagnostic" | "reactive" | "recording";
  pose: Pose;
  speedMps: number;
  playback: "idle" | "playing" | "paused" | "finished";
  /** Cloud data stays in B's renderer; this is a small UI summary. */
  perceivedPointCount: number;
}
export interface AppError { code: string; message: string; retryable: boolean }
export type ActionResult = { ok: true } | { ok: false; error: AppError };
export interface AppState {
  contractVersion: typeof CONTRACT_VERSION;
  mode: "fixture" | "live" | "recording";
  route: RouteState;
  status: "empty" | "uploading" | "generating" | "calibrating" | "ready"
    | "queued" | "running" | "publishing" | "published" | "error";
  connection: "connected" | "connecting" | "offline";
  capabilities: {
    authoring: boolean;
    run: boolean;
    publish: boolean;
    authoringReason?: string;
  };
  session: SessionSummary | null;
  world: World | null;
  scenario: Scenario | null;
  config: SensorConfig | null;
  library: readonly HazardLibraryItem[];
  frame: FrameSummary | null;
  latestRun: CompletedRun | null;
  report: ReportSnapshot | null;
  reportLoading: boolean;
  reportUrl: string | null;
  error: AppError | null;
  stageLabel: string | null;
  elapsedMs: number | null;
}
export interface AppActions {
  authorScenario(input: { sentence: string; photo?: File; worldId?: string }): Promise<ActionResult>;
  confirmCalibration(input: {
    worldId: string;
    referenceLabel: string;
    referenceLengthM: number;
    evidence: "operator_measured" | "assumed";
    correctionFactor: number;
  }): Promise<ActionResult>;
  requestConfig(presetId: SensorConfig["presetId"]): Promise<ActionResult>;
  startRun(): Promise<ActionResult>;
  publishReport(): Promise<ActionResult>;
  retry(): Promise<ActionResult>;
  navigate(path: string): void;
  setPlayback(value: "playing" | "paused"): void;
  seek(timeMs: number): void;
}
export interface RuntimeBridge { state: AppState; actions: AppActions }
