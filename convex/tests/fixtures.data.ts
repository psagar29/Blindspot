import type { CompletedRun, HazardLibraryItem, Scenario, World } from "../../shared/contracts";
import { createSensorConfig } from "../../src/engine/presets";

export const ownerToken = "owner_capability_abcdefghijklmnopqrstuvwxyz_12345";
export const controllerToken = "controller_capability_abcdefghijklmnop_12345";
export const sessionId = "backend-test-session";
export const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export function fixtures() {
  const asset = { id: "test-world-asset", source: "procedural" as const, url: "https://assets.example.com/site.glb", sha256: "a".repeat(64), createdAt: "2026-09-05T00:00:00.000Z" };
  const world: World = {
    id: "test-world", version: 1, name: "Test site", sourcePhotoUrl: "https://assets.example.com/photo.png",
    splat: { ...asset, id: "test-splat", url: "https://assets.example.com/site.spz" }, collider: asset,
    calibration: { status: "verified", source: "operator_reference", splatToWorld: identity, colliderToWorld: identity,
      reference: { label: "Measured doorway", lengthM: 1, evidence: "operator_measured" }, correctionFactor: 1,
      uncertaintyNote: "Coarse environment reconstruction remains uncertain.", verifiedAt: "2026-09-05T00:00:00.000Z" },
    preparationMs: 0, cached: true,
  };
  const cable: HazardLibraryItem = { id: "test-cable", version: 1, name: "Cable", type: "cable", dimensionsM: [1, 0.01, 0.01], dimensionEvidence: "assumed", materialClass: "opaque", returnAssumption: "Modeled opaque thin target." };
  const box: HazardLibraryItem = { id: "test-box", version: 1, name: "Box", type: "bulk", dimensionsM: [0.5, 0.5, 0.5], dimensionEvidence: "assumed", materialClass: "opaque", returnAssumption: "Modeled opaque bulk target." };
  const scenario: Scenario = {
    id: "test-scenario", version: 1, world,
    hazards: [
      { id: "near-cable", libraryItem: cable, geometry: { kind: "cable", startM: [-1, 0.1, -2], endM: [1, 0.1, -2], diameterM: 0.01 }, placementSource: "preset", observedInPhoto: false, justification: "Authored route stress hazard." },
      { id: "route-box", libraryItem: box, geometry: { kind: "box", pose: { positionM: [0, 0.25, -4], orientation: [0, 0, 0, 1] }, dimensionsM: [0.5, 0.5, 0.5] }, placementSource: "preset", observedInPhoto: false, justification: "Authored bulk hazard." },
      { id: "off-route-box", libraryItem: box, geometry: { kind: "box", pose: { positionM: [4, 0.25, -4], orientation: [0, 0, 0, 1] }, dimensionsM: [0.5, 0.5, 0.5] }, placementSource: "preset", observedInPhoto: false, justification: "Off-route exclusion." },
    ], route: [{ positionM: [0, 0, 0], orientation: [0, 0, 0, 1] }, { positionM: [0, 0, -6], orientation: [0, 0, 0, 1] }],
    platform: { mode: "ground", radiusM: 0.3, heightM: 0.7, speedMps: 1, brakingDecelerationMps2: 1, controlLatencyS: 0.2, clearanceMarginM: 0.1 },
    seed: 5, authoring: "preset", sentence: "Test ground route with a cable and boxes.", assumptions: ["Authored hazards are not observed infrastructure."],
  };
  return { world, library: [cable, box], scenario, baselineConfig: createSensorConfig("baseline", 1) };
}
export function completed(runId: string, scenario = fixtures().scenario, config = createSensorConfig("baseline", 1)): CompletedRun {
  return {
    id: runId, scenarioId: scenario.id, scenarioVersion: scenario.version, config, seed: scenario.seed,
    coverage: { pass: "diagnostic_full_route", eligibleEncounters: 2, detectedBeforeBoundary: 1, missedOrLate: 1, unknown: 0, excluded: 1, percent: 50 },
    outcome: { pass: "reactive", collisions: 1, nearMisses: 0, stopEvents: 0, falseStopEvents: 0, falseStopPercent: null, routeCompletionPercent: 30, completionTimeMs: null, termination: "collision" },
    findings: [
      { hazardId: "near-cable", status: "missed", firstDetectionRangeM: null, firstDetectionAxialDepthM: null, theoreticalThresholdRangeM: 0.8, requiredStoppingDistanceM: 0.8, reason: "Below declared width threshold before the stopping boundary.", sampleMethod: "analytic_with_occlusion" },
      { hazardId: "route-box", status: "detected_in_time", firstDetectionRangeM: 3, firstDetectionAxialDepthM: 3.3, theoreticalThresholdRangeM: null, requiredStoppingDistanceM: 0.8, reason: "Bulk geometry appears before the boundary.", sampleMethod: "raster" },
      { hazardId: "off-route-box", status: "excluded", firstDetectionRangeM: null, firstDetectionAxialDepthM: null, theoreticalThresholdRangeM: null, requiredStoppingDistanceM: null, reason: "Outside the fixed route corridor.", sampleMethod: "not_evaluated" },
    ], events: [{ timeMs: 1800, kind: "collision", hazardId: "near-cable", positionM: [0, 0, -1.8] }],
    completedAt: "2026-09-05T00:00:03.000Z", engineVersion: "backend-fixture-1", execution: "client_computed",
  };
}
