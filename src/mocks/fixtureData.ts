/**
 * Deterministic fixture data for the independent UI preview.
 * Everything here is sample data: fixed timestamps, fixed seed, no provider
 * output. Names and notes label it as fixture so it can never pass as a live
 * run. The fixture bridge (createFixtureBridge.ts) mutates copies of these.
 */
import type {
  Calibration,
  CompletedRun,
  HazardInstance,
  HazardLibraryItem,
  ReportSnapshot,
  Scenario,
  SensorConfig,
  SessionSummary,
  StereoSensor,
  World,
} from "../../shared/contracts";
import { CLAIM_BOUNDARY, CONTRACT_VERSION } from "../../shared/contracts";
import fixturePhotoUrl from "./assets/fixture-site-photo.svg";

/** Fixed fixture clock. All fixture artifacts stamp from this morning. */
export const FIXTURE_EPOCH = "2026-09-05T10:00:00.000-07:00";
export const FIXTURE_SEED = 41;

const IDENTITY_MAT4: readonly number[] = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

export const FIXTURE_SOURCE_PHOTO_URL: string = fixturePhotoUrl;

export const fixtureCalibrationUnverified: Calibration = {
  status: "unverified",
  source: "provider_metric",
  rawMetricScaleFactor: 1.04,
  rawGroundPlaneOffset: -0.02,
  splatToWorld: IDENTITY_MAT4,
  colliderToWorld: IDENTITY_MAT4,
  correctionFactor: 1,
  uncertaintyNote:
    "Fixture scale from a provider metric hint only. Confirm against an operator-measured reference before quantitative use.",
};

export function verifiedCalibration(input: {
  referenceLabel: string;
  referenceLengthM: number;
  evidence: "operator_measured" | "assumed";
  correctionFactor: number;
}): Calibration {
  return {
    ...fixtureCalibrationUnverified,
    status: "verified",
    source: input.evidence === "operator_measured" ? "operator_reference" : "estimated_reference",
    reference: {
      label: input.referenceLabel,
      lengthM: input.referenceLengthM,
      evidence: input.evidence,
    },
    correctionFactor: input.correctionFactor,
    uncertaintyNote:
      input.evidence === "operator_measured"
        ? "Scale corrected against an operator-measured reference (fixture). Residual splat reconstruction error still applies."
        : "Scale reference was assumed, not measured. Treat all ranges as estimates (fixture).",
    verifiedAt: "2026-09-05T10:09:30.000-07:00",
  };
}

export const fixtureWorld: World = {
  id: "wrl-fixture-01",
  version: 1,
  name: "Intake Bay 3 (fixture sample)",
  sourcePhotoUrl: fixturePhotoUrl,
  splat: {
    id: "asset-fixture-splat",
    source: "procedural",
    url: "fixture:local/intake-bay-3.spz",
    sha256: "f1x7u5e0000000000000000000000000000000000000000000000000000splat",
    createdAt: FIXTURE_EPOCH,
  },
  collider: {
    id: "asset-fixture-collider",
    source: "procedural",
    url: "fixture:local/intake-bay-3-collider.glb",
    sha256: "f1x7u5e000000000000000000000000000000000000000000000000collider",
    createdAt: FIXTURE_EPOCH,
  },
  calibration: fixtureCalibrationUnverified,
  preparationMs: 183_000,
  cached: true,
};

export const fixtureLibrary: readonly HazardLibraryItem[] = [
  {
    id: "lib-cable-power",
    version: 1,
    name: "Suspended power cable - 12 mm (fixture)",
    type: "cable",
    dimensionsM: [0.012, 0.012, 5.8],
    dimensionEvidence: "operator_measured",
    materialClass: "dark_matte",
    returnAssumption:
      "Dark rubber sheath assumed to give weak stereo texture; support only where background contrast exists (fixture assumption).",
  },
  {
    id: "lib-cable-comms",
    version: 1,
    name: "Overhead comms line - 6 mm (fixture)",
    type: "cable",
    dimensionsM: [0.006, 0.006, 5.2],
    dimensionEvidence: "assumed",
    materialClass: "dark_matte",
    returnAssumption:
      "Thin dark line; assumed below stereo support threshold at typical standoff (fixture assumption).",
  },
  {
    id: "lib-pallet",
    version: 1,
    name: "Shrink-wrapped pallet stack (fixture stand-in)",
    type: "bulk",
    asset: {
      id: "asset-fixture-pallet",
      source: "procedural",
      url: "fixture:local/pallet-stack.glb",
      sha256: "f1x7u5e00000000000000000000000000000000000000000000000000pallet",
      createdAt: FIXTURE_EPOCH,
    },
    dimensionsM: [1.2, 1.4, 1.0],
    dimensionEvidence: "assumed",
    materialClass: "opaque",
    returnAssumption:
      "Large opaque volume with plastic wrap glare; dense stereo support assumed (fixture stand-in - the real bulk asset is Person B's Tripo deliverable).",
  },
];

export const fixtureHazards: readonly HazardInstance[] = [
  {
    id: "hz-cable-power",
    libraryItem: fixtureLibrary[0]!,
    geometry: {
      kind: "cable",
      startM: [-2.6, 0.34, 7.0],
      endM: [2.4, 0.3, 7.4],
      diameterM: 0.012,
    },
    placementSource: "preset",
    observedInPhoto: true,
    justification: "Low sag crossing the drive lane; visible in the fixture source photo.",
  },
  {
    id: "hz-cable-comms",
    libraryItem: fixtureLibrary[1]!,
    geometry: {
      kind: "cable",
      startM: [-2.2, 0.28, 9.4],
      endM: [2.5, 0.26, 9.7],
      diameterM: 0.006,
    },
    placementSource: "preset",
    observedInPhoto: false,
    justification:
      "Authored stress test: thinner line at the same height band, not confirmed in the photo.",
  },
  {
    id: "hz-pallet",
    libraryItem: fixtureLibrary[2]!,
    geometry: {
      kind: "box",
      pose: { positionM: [-1.1, 0.7, 4.0], orientation: [0, 0, 0, 1] },
      dimensionsM: [1.2, 1.4, 1.0],
    },
    placementSource: "preset",
    observedInPhoto: true,
    justification: "Staged pallet stack at the lane edge, matching the fixture photo.",
  },
];

function stereo(partial: Partial<StereoSensor>): StereoSensor {
  return {
    id: "sensor-front",
    kind: "passive_stereo_approximation",
    mount: { positionM: [0, 0.32, 0.18], orientation: [0, 0, 0, 1] },
    widthPx: 640,
    heightPx: 400,
    horizontalFovRad: 1.204,
    nearM: 0.3,
    farM: 12,
    minResolvableWidthPx: 2,
    textureDropoutEnabled: true,
    ...partial,
  };
}

const SHARED_CONFIG_ASSUMPTIONS = [
  "Single forward-facing stereo pair; no side or rear coverage.",
  "Platform route, speed, and braking identical across presets (fixture).",
  "Passive-stereo approximation, not a calibrated physical sensor model.",
] as const;

export const fixtureConfigs: Record<SensorConfig["presetId"], SensorConfig> = {
  baseline: {
    id: "cfg-baseline",
    version: 1,
    presetId: "baseline",
    label: "Baseline stereo",
    sensors: [stereo({})],
    modelVersion: "stereo-approx-fixture-1",
    assumptions: SHARED_CONFIG_ASSUMPTIONS,
  },
  higher_resolution: {
    id: "cfg-higher-res",
    version: 2,
    presetId: "higher_resolution",
    label: "Higher resolution",
    sensors: [stereo({ widthPx: 1280, heightPx: 800 })],
    modelVersion: "stereo-approx-fixture-1",
    assumptions: SHARED_CONFIG_ASSUMPTIONS,
  },
  permissive: {
    id: "cfg-permissive",
    version: 3,
    presetId: "permissive",
    label: "Permissive threshold",
    sensors: [stereo({ minResolvableWidthPx: 1, textureDropoutEnabled: false })],
    modelVersion: "stereo-approx-fixture-1",
    assumptions: [
      ...SHARED_CONFIG_ASSUMPTIONS,
      "Permissive support threshold adds 2 seeded spurious stops in fixture data to show the coverage/false-stop tradeoff.",
    ],
  },
};

export const fixtureScenario: Scenario = {
  id: "scn-fixture-01",
  version: 1,
  world: fixtureWorld,
  hazards: fixtureHazards,
  route: [
    { positionM: [0, 0, 0], orientation: [0, 0, 0, 1] },
    { positionM: [0, 0, 6], orientation: [0, 0, 0, 1] },
    { positionM: [0.4, 0, 12], orientation: [0, 0.049, 0, 0.999] },
  ],
  platform: {
    mode: "ground",
    radiusM: 0.35,
    heightM: 0.42,
    speedMps: 1.2,
    brakingDecelerationMps2: 1.5,
    controlLatencyS: 0.2,
    clearanceMarginM: 0.3,
    // The one REAL asset reference in this fixture set: an actual Mint MCP
    // generation (see public/mint/PROVENANCE.json). Decorative visual only;
    // the physical envelope stays radiusM/heightM above.
    visualAsset: {
      id: "asset-mint-robot",
      source: "mint",
      url: "/mint/teal-stripe-scout-rover.glb",
      thumbnailUrl: "/mint/teal-stripe-scout-rover-preview.webp",
      sha256: "85f69933396b670d9b46c8d3cdd61167a106567e3a28b0ff9ad15693ce3bc845",
      providerTaskId: "ks74ch8bya740cjkcz9zp55adx8dtnmn",
      createdAt: "2026-09-05T20:08:25.380Z",
    },
  },
  seed: FIXTURE_SEED,
  authoring: "preset",
  sentence:
    "Inspect the intake bay drive lane for low cables and staged pallets before the night shift.",
  assumptions: [
    "Kinematic ground platform with straight-line braking; no dynamics, slip, or controller model.",
    "World geometry from a generated reconstruction; positions are approximate.",
    "Hazard dimensions are authored envelopes with the stated evidence, not sensed values.",
  ],
};

/** Deterministic completed runs per preset. Fixture-only numbers with honest denominators. */
export const fixtureRuns: Record<SensorConfig["presetId"], CompletedRun> = {
  baseline: {
    id: "run-fixture-baseline",
    scenarioId: fixtureScenario.id,
    scenarioVersion: 1,
    config: fixtureConfigs.baseline,
    seed: FIXTURE_SEED,
    coverage: {
      pass: "diagnostic_full_route",
      eligibleEncounters: 3,
      detectedBeforeBoundary: 1,
      missedOrLate: 2,
      unknown: 0,
      excluded: 0,
      percent: 100 / 3,
    },
    outcome: {
      pass: "reactive",
      collisions: 1,
      nearMisses: 0,
      stopEvents: 2,
      falseStopEvents: 0,
      falseStopPercent: 0,
      routeCompletionPercent: 61,
      completionTimeMs: null,
      termination: "collision",
    },
    findings: [
      {
        hazardId: "hz-pallet",
        status: "detected_in_time",
        firstDetectionRangeM: 6.4,
        firstDetectionAxialDepthM: 6.8,
        theoreticalThresholdRangeM: 9.5,
        requiredStoppingDistanceM: 1.32,
        reason:
          "Large opaque volume produced dense stereo support well before the stop boundary (fixture data).",
        sampleMethod: "raster",
      },
      {
        hazardId: "hz-cable-power",
        status: "late",
        firstDetectionRangeM: 0.82,
        firstDetectionAxialDepthM: 1.08,
        theoreticalThresholdRangeM: 1.62,
        requiredStoppingDistanceM: 1.32,
        reason:
          "12 mm sheath first crossed the 2 px support threshold at 0.82 m remaining; required stopping distance is 1.32 m at 1.2 m/s, so braking started too late (fixture data).",
        sampleMethod: "raster",
      },
      {
        hazardId: "hz-cable-comms",
        status: "missed",
        firstDetectionRangeM: null,
        firstDetectionAxialDepthM: null,
        theoreticalThresholdRangeM: 0.94,
        requiredStoppingDistanceM: 1.32,
        reason:
          "6 mm line never exceeded the 2 px stereo support threshold anywhere on the tested trajectory (fixture data).",
        sampleMethod: "raster",
      },
    ],
    events: [
      { timeMs: 1800, kind: "first_detection", hazardId: "hz-pallet", positionM: [0, 0, 2.2] },
      { timeMs: 2600, kind: "braking", hazardId: "hz-pallet", positionM: [0, 0, 3.1] },
      { timeMs: 3400, kind: "stop", hazardId: "hz-pallet", positionM: [0, 0, 3.6] },
      { timeMs: 6100, kind: "first_detection", hazardId: "hz-cable-power", positionM: [0, 0, 6.2] },
      { timeMs: 6350, kind: "braking", hazardId: "hz-cable-power", positionM: [0, 0, 6.5] },
      { timeMs: 6900, kind: "collision", hazardId: "hz-cable-power", positionM: [0, 0, 7.0] },
    ],
    completedAt: "2026-09-05T10:14:12.000-07:00",
    engineVersion: "fixture-0",
    execution: "client_computed",
  },
  higher_resolution: {
    id: "run-fixture-higher-res",
    scenarioId: fixtureScenario.id,
    scenarioVersion: 1,
    config: fixtureConfigs.higher_resolution,
    seed: FIXTURE_SEED,
    coverage: {
      pass: "diagnostic_full_route",
      eligibleEncounters: 3,
      detectedBeforeBoundary: 2,
      missedOrLate: 1,
      unknown: 0,
      excluded: 0,
      percent: 200 / 3,
    },
    outcome: {
      pass: "reactive",
      collisions: 0,
      nearMisses: 1,
      stopEvents: 3,
      falseStopEvents: 0,
      falseStopPercent: 0,
      routeCompletionPercent: 100,
      completionTimeMs: 14_600,
      termination: "completed",
    },
    findings: [
      {
        hazardId: "hz-pallet",
        status: "detected_in_time",
        firstDetectionRangeM: 7.1,
        firstDetectionAxialDepthM: 7.5,
        theoreticalThresholdRangeM: 10.4,
        requiredStoppingDistanceM: 1.32,
        reason: "Dense stereo support far before the stop boundary (fixture data).",
        sampleMethod: "raster",
      },
      {
        hazardId: "hz-cable-power",
        status: "detected_in_time",
        firstDetectionRangeM: 2.9,
        firstDetectionAxialDepthM: 3.2,
        theoreticalThresholdRangeM: 3.24,
        requiredStoppingDistanceM: 1.32,
        reason:
          "Doubled horizontal resolution moved the 12 mm threshold crossing to 2.9 m remaining - ahead of the 1.32 m stop boundary (fixture data).",
        sampleMethod: "raster",
      },
      {
        hazardId: "hz-cable-comms",
        status: "missed",
        firstDetectionRangeM: null,
        firstDetectionAxialDepthM: null,
        theoreticalThresholdRangeM: 1.88,
        requiredStoppingDistanceM: 1.32,
        reason:
          "6 mm line stayed under the support threshold except in a fully occluded segment (fixture data).",
        sampleMethod: "raster",
      },
    ],
    events: [
      { timeMs: 1500, kind: "first_detection", hazardId: "hz-pallet", positionM: [0, 0, 1.8] },
      { timeMs: 2400, kind: "braking", hazardId: "hz-pallet", positionM: [0, 0, 2.9] },
      { timeMs: 3200, kind: "stop", hazardId: "hz-pallet", positionM: [0, 0, 3.4] },
      { timeMs: 5400, kind: "first_detection", hazardId: "hz-cable-power", positionM: [0, 0, 4.5] },
      { timeMs: 5700, kind: "braking", hazardId: "hz-cable-power", positionM: [0, 0, 4.9] },
      { timeMs: 6600, kind: "stop", hazardId: "hz-cable-power", positionM: [0, 0, 5.7] },
      { timeMs: 11_900, kind: "near_miss", hazardId: "hz-cable-comms", positionM: [0.1, 0, 9.5] },
      { timeMs: 13_800, kind: "stop", positionM: [0.4, 0, 12] },
    ],
    completedAt: "2026-09-05T10:21:40.000-07:00",
    engineVersion: "fixture-0",
    execution: "client_computed",
  },
  permissive: {
    id: "run-fixture-permissive",
    scenarioId: fixtureScenario.id,
    scenarioVersion: 1,
    config: fixtureConfigs.permissive,
    seed: FIXTURE_SEED,
    coverage: {
      pass: "diagnostic_full_route",
      eligibleEncounters: 3,
      detectedBeforeBoundary: 3,
      missedOrLate: 0,
      unknown: 0,
      excluded: 0,
      percent: 100,
    },
    outcome: {
      pass: "reactive",
      collisions: 0,
      nearMisses: 0,
      stopEvents: 5,
      falseStopEvents: 2,
      falseStopPercent: 40,
      routeCompletionPercent: 100,
      completionTimeMs: 17_900,
      termination: "completed",
    },
    findings: [
      {
        hazardId: "hz-pallet",
        status: "detected_in_time",
        firstDetectionRangeM: 6.6,
        firstDetectionAxialDepthM: 7.0,
        theoreticalThresholdRangeM: 9.5,
        requiredStoppingDistanceM: 1.32,
        reason: "Dense support well before the stop boundary (fixture data).",
        sampleMethod: "raster",
      },
      {
        hazardId: "hz-cable-power",
        status: "detected_in_time",
        firstDetectionRangeM: 3.1,
        firstDetectionAxialDepthM: 3.4,
        theoreticalThresholdRangeM: 3.24,
        requiredStoppingDistanceM: 1.32,
        reason: "1 px support threshold crossed at 3.1 m remaining (fixture data).",
        sampleMethod: "raster",
      },
      {
        hazardId: "hz-cable-comms",
        status: "detected_in_time",
        firstDetectionRangeM: 1.7,
        firstDetectionAxialDepthM: 1.95,
        theoreticalThresholdRangeM: 1.88,
        requiredStoppingDistanceM: 1.32,
        reason:
          "Permissive threshold caught the 6 mm line at 1.7 m remaining - 0.38 m of margin over the stop boundary (fixture data).",
        sampleMethod: "raster",
      },
    ],
    events: [
      { timeMs: 1700, kind: "first_detection", hazardId: "hz-pallet", positionM: [0, 0, 2.0] },
      { timeMs: 2500, kind: "braking", hazardId: "hz-pallet", positionM: [0, 0, 3.0] },
      { timeMs: 3300, kind: "stop", hazardId: "hz-pallet", positionM: [0, 0, 3.5] },
      { timeMs: 4800, kind: "stop", positionM: [0, 0, 4.4] },
      { timeMs: 6000, kind: "first_detection", hazardId: "hz-cable-power", positionM: [0, 0, 4.3] },
      { timeMs: 6900, kind: "stop", hazardId: "hz-cable-power", positionM: [0, 0, 5.9] },
      { timeMs: 9800, kind: "stop", positionM: [0, 0, 8.1] },
      { timeMs: 12_400, kind: "first_detection", hazardId: "hz-cable-comms", positionM: [0, 0, 7.9] },
      { timeMs: 13_300, kind: "stop", hazardId: "hz-cable-comms", positionM: [0, 0, 8.9] },
    ],
    completedAt: "2026-09-05T10:28:05.000-07:00",
    engineVersion: "fixture-0",
    execution: "client_computed",
  },
};

/** A run with unknown encounters: coverage percent must be null and reports incomplete. */
export const fixtureIncompleteRun: CompletedRun = {
  ...fixtureRuns.baseline,
  id: "run-fixture-incomplete",
  coverage: {
    pass: "diagnostic_full_route",
    eligibleEncounters: 3,
    detectedBeforeBoundary: 1,
    missedOrLate: 1,
    unknown: 1,
    excluded: 0,
    percent: null,
  },
  outcome: {
    pass: "not_evaluated",
    collisions: null,
    nearMisses: null,
    stopEvents: null,
    falseStopEvents: null,
    falseStopPercent: null,
    routeCompletionPercent: null,
    completionTimeMs: null,
    termination: "not_evaluated",
  },
  findings: [
    fixtureRuns.baseline.findings[0]!,
    fixtureRuns.baseline.findings[1]!,
    {
      ...fixtureRuns.baseline.findings[2]!,
      status: "unknown",
      theoreticalThresholdRangeM: null,
      reason:
        "Diagnostic pass aborted before this encounter was evaluated; status unknown (fixture data).",
      sampleMethod: "not_evaluated",
    },
  ],
  events: fixtureRuns.baseline.events.slice(0, 3),
  completedAt: "2026-09-05T10:33:20.000-07:00",
};

export const FIXTURE_REPORT_ID = "rpt-fixture-0001";

export const fixtureLimitations: readonly string[] = [
  "Fixture data: produced by the deterministic UI fixture bridge, not by a simulation run.",
  "World scale carries the stated calibration uncertainty; all ranges inherit it.",
  "Kinematic platform with straight-line braking; no dynamics, slip, or controller behavior.",
  "Passive-stereo approximation with a pixel-support threshold; not a physical sensor model.",
  "Hazards are authored envelopes; the comms line is an authored stress test, not photo-confirmed.",
  "Results apply to the tested route and configuration only.",
];

export function reportStatus(run: CompletedRun, scenario: Scenario): ReportSnapshot["status"] {
  const calibrationVerified = scenario.world.calibration.status === "verified";
  const hasUnknown = run.coverage.unknown > 0;
  const noEligible = run.coverage.eligibleEncounters === 0;
  const requiredPassFailed = run.outcome.pass === "not_evaluated";
  if (!calibrationVerified || hasUnknown || noEligible || requiredPassFailed) return "incomplete";
  const anyFailure =
    run.findings.some((f) => f.status === "missed" || f.status === "late") ||
    (run.outcome.collisions ?? 0) > 0;
  return anyFailure ? "blind_spot_observed" : "no_failure_observed";
}

export function buildFixtureReport(run: CompletedRun, scenario: Scenario): ReportSnapshot {
  return {
    contractVersion: CONTRACT_VERSION,
    id: FIXTURE_REPORT_ID,
    title: "Site Blind Spot Report",
    status: reportStatus(run, scenario),
    publishedAt: "2026-09-05T10:36:00.000-07:00",
    scenario,
    run,
    claimBoundary: CLAIM_BOUNDARY,
    limitations: fixtureLimitations,
    evidenceImageUrls: [],
  };
}

export function fixtureSession(publicOrigin: string | undefined): SessionSummary {
  const origin = publicOrigin?.trim().replace(/\/$/, "");
  return {
    id: "sess-fixture-01",
    siteName: "Intake Bay 3 (fixture)",
    controllerUrl: origin ? `${origin}/control/sess-fixture-01#token=fixture-controller-token` : null,
    operatorOnline: true,
    requestedConfigVersion: null,
    activeConfigVersion: null,
    completedConfigVersion: null,
  };
}
