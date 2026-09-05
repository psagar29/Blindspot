// @vitest-environment edge-runtime
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import { capabilityHash, LEASE_MS, plain } from "../access";
import { completed, controllerToken, fixtures, ownerToken, sessionId } from "./fixtures.data";
import type { Scenario, SensorConfig } from "../../shared/contracts";
import { evaluate } from "../../src/engine/evaluate";

const modules = import.meta.glob(["../**/*.ts", "!../tests/**"]);
const instanceId = "operator-tab-one";
async function setup(data = fixtures()) {
  const t = convexTest(schema, modules);
  await t.mutation(internal.seed.bootstrap, { sessionId, ...plain(data), ownerCapabilityHash: await capabilityHash(ownerToken), controllerCapabilityHash: await capabilityHash(controllerToken) });
  return { t, data };
}
async function claim(t: Awaited<ReturnType<typeof setup>>["t"], instance = instanceId) {
  await t.mutation(api.sessions.claimLease, { sessionId, token: ownerToken, instanceId: instance });
  return t.mutation(api.runs.claimNext, { sessionId, token: ownerToken, instanceId: instance });
}
async function finish(t: Awaited<ReturnType<typeof setup>>["t"], run: { runId: string; scenario: Scenario; config: SensorConfig }, result = completed(run.runId, run.scenario, run.config)) {
  return t.mutation(api.runs.complete, { runId: run.runId, token: ownerToken, instanceId, scenarioVersion: run.scenario.version, configVersion: run.config.version, result: plain(result) });
}
async function registerDurableAssets(t: Awaited<ReturnType<typeof setup>>["t"], scenario: Scenario, owningSessionId = sessionId) {
  await t.run(async (ctx) => {
    const session = await ctx.db.query("sessions").withIndex("by_publicId", (q) => q.eq("publicId", owningSessionId)).unique();
    for (const url of [scenario.world.sourcePhotoUrl, scenario.world.splat.url, scenario.world.collider.url]) {
      const storageId = await ctx.storage.store(new Blob(["durable-test-bytes"], { type: "application/octet-stream" }));
      await ctx.db.insert("uploadedAssets", { sessionId: session!._id, storageId, url, sha256: "a".repeat(64), size: 18, contentType: "application/octet-stream" });
    }
  });
}

describe("capabilities and execution ownership", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-05T01:00:00Z")); });
  afterEach(() => vi.useRealTimers());

  it("seeds idempotently and exposes no capabilities or lease identity", async () => {
    const { t, data } = await setup();
    const again = await t.mutation(internal.seed.bootstrap, { sessionId, ...plain(data), ownerCapabilityHash: await capabilityHash(ownerToken), controllerCapabilityHash: await capabilityHash(controllerToken) });
    expect(again).toEqual({ sessionId, created: false });
    const publicState = await t.query(api.sessions.getPublic, { sessionId });
    expect(publicState.session.requestedConfigVersion).toBe(1);
    expect(publicState.status).toBe("queued");
    expect(publicState.session.operatorOnline).toBe(false);
    const serialized = JSON.stringify(publicState);
    expect(serialized).not.toContain(ownerToken); expect(serialized).not.toContain(controllerToken);
    expect(serialized).not.toContain("CapabilityHash"); expect(serialized).not.toContain("leaseInstanceId");
  });

  it("atomically permits one operator lease and fences the loser", async () => {
    const { t } = await setup();
    const a = await t.mutation(api.sessions.claimLease, { sessionId, token: ownerToken, instanceId });
    const b = await t.mutation(api.sessions.claimLease, { sessionId, token: ownerToken, instanceId: "operator-tab-two" });
    expect(a.leased).toBe(true); expect(b.leased).toBe(false);
    await expect(t.mutation(api.runs.claimNext, { sessionId, token: ownerToken, instanceId: "operator-tab-two" })).rejects.toThrow("active operator lease");
    const first = await t.mutation(api.runs.claimNext, { sessionId, token: ownerToken, instanceId });
    const repeated = await t.mutation(api.runs.claimNext, { sessionId, token: ownerToken, instanceId });
    expect(repeated.runId).toBe(first.runId);
  });

  it("rejects controller ownership, result submission, publication, ingestion and uploads", async () => {
    const { t, data } = await setup();
    const run = await claim(t);
    const forbidden = [
      () => t.mutation(api.sessions.claimLease, { sessionId, token: controllerToken, instanceId }),
      () => t.mutation(api.runs.claimNext, { sessionId, token: controllerToken, instanceId }),
      () => t.mutation(api.runs.complete, { runId: run.runId, token: controllerToken, instanceId, scenarioVersion: 1, configVersion: 1, result: plain(completed(run.runId)) }),
      () => t.mutation(api.reports.publish, { runId: run.runId, token: controllerToken }),
      () => t.mutation(api.assets.generateUploadUrl, { sessionId, token: controllerToken }),
      () => t.mutation(api.worlds.ingest, { sessionId, token: controllerToken, world: plain(data.world) }),
      () => t.mutation(api.library.ingest, { sessionId, token: controllerToken, item: plain(data.library[0]) }),
      () => t.mutation(api.scenarios.create, { sessionId, token: controllerToken, scenario: plain(data.scenario) }),
    ];
    for (const call of forbidden) await expect(call()).rejects.toThrow("capability");
  });

  it("lets the owner revoke and rotate the controller capability", async () => {
    const { t } = await setup();
    const nextControllerToken = "controller_capability_rotated_abcdefghijklmnop";
    const controllerCapabilityHash = await capabilityHash(nextControllerToken);

    await expect(
      t.mutation(api.sessions.rotateControllerCapability, {
        sessionId,
        token: controllerToken,
        controllerCapabilityHash,
      }),
    ).rejects.toThrow("capability");

    await expect(
      t.mutation(api.sessions.rotateControllerCapability, {
        sessionId,
        token: ownerToken,
        controllerCapabilityHash,
      }),
    ).resolves.toEqual({ rotated: true });

    await expect(
      t.mutation(api.configs.request, {
        sessionId,
        token: controllerToken,
        presetId: "higher_resolution",
        clientRequestId: "revoked-controller",
      }),
    ).rejects.toThrow("capability");
    await expect(
      t.mutation(api.configs.request, {
        sessionId,
        token: nextControllerToken,
        presetId: "higher_resolution",
        clientRequestId: "rotated-controller",
      }),
    ).resolves.toEqual({ configVersion: 2 });
  });

  it("deduplicates request IDs, enforces presets and keeps offline sessions queued", async () => {
    const { t, data } = await setup();
    const args = { sessionId, token: controllerToken, presetId: "higher_resolution", clientRequestId: "phone-request-1" };
    expect(await t.mutation(api.configs.request, args)).toEqual({ configVersion: 2 });
    expect(await t.mutation(api.configs.request, args)).toEqual({ configVersion: 2 });
    await expect(t.mutation(api.configs.request, { ...args, presetId: "permissive" })).rejects.toThrow("request ID");
    await expect(t.mutation(api.configs.request, { ...args, presetId: "arbitrary_json", clientRequestId: "bad-request" })).rejects.toThrow();
    const publicState = await t.query(api.sessions.getPublic, { sessionId });
    expect(publicState.status).toBe("queued"); expect(publicState.latestRun).toBeNull();
    expect(publicState.config.sensors[0].widthPx).toBe(320);
    expect(publicState.scenario).toEqual(plain(data.scenario));
  });

  it("accepts stale completion only as historical data, never the newer display", async () => {
    const { t } = await setup();
    const run = await claim(t);
    await t.mutation(api.configs.request, { sessionId, token: controllerToken, presetId: "higher_resolution", clientRequestId: "newer-request" });
    expect(await finish(t, run)).toEqual({ runId: run.runId, acceptedForDisplay: false });
    const state = await t.query(api.sessions.getPublic, { sessionId });
    expect(state.latestRun).toBeNull(); expect(state.session.completedConfigVersion).toBeNull(); expect(state.status).toBe("queued");
    const next = await t.mutation(api.runs.claimNext, { sessionId, token: ownerToken, instanceId });
    expect(next.config.version).toBe(2); expect(next.scenario).toEqual(run.scenario);
    await finish(t, next);
    expect((await t.query(api.sessions.getPublic, { sessionId })).latestRun.config.version).toBe(2);
  });

  it("rejects stale completion after lease expiry even if the same instance returns", async () => {
    const { t } = await setup();
    const original = await claim(t);
    vi.advanceTimersByTime(LEASE_MS + 1);
    await expect(finish(t, original)).rejects.toThrow("active operator lease");
    const renewed = await claim(t);
    expect(renewed.runId).not.toBe(original.runId);
    await expect(finish(t, original)).rejects.toThrow("active operator lease");
    await finish(t, renewed);
  });

  it("rejects changed frozen versions and immutable completed results", async () => {
    const { t } = await setup();
    const run = await claim(t);
    const wrongSeed = completed(run.runId); wrongSeed.seed++;
    await expect(finish(t, run, wrongSeed)).rejects.toThrow("frozen scenario/config");
    await finish(t, run);
    expect(await finish(t, run)).toEqual({ runId: run.runId, acceptedForDisplay: true });
    const changed = completed(run.runId); changed.engineVersion = "altered-engine";
    await expect(finish(t, run, changed)).rejects.toThrow("cannot be changed");
  });

  it("accepts actual engine results and saved braking decisions for all frozen presets", async () => {
    const { t, data } = await setup();
    for (const presetId of ["baseline", "higher_resolution", "permissive"] as const) {
      if (presetId !== "baseline") {
        vi.advanceTimersByTime(250);
        await t.mutation(api.configs.request, { sessionId, token: controllerToken, presetId, clientRequestId: `engine-${presetId}` });
      }
      const claimResult = await claim(t);
      const result = await evaluate(claimResult.scenario as unknown as Scenario, claimResult.config as unknown as SensorConfig, { runId: claimResult.runId, completedAt: "2026-09-05T00:00:03.000Z" });
      expect(result.run.coverage.eligibleEncounters).toBe(2);
      expect(await t.mutation(api.runs.complete, { runId: claimResult.runId, token: ownerToken, instanceId, scenarioVersion: claimResult.scenario.version, configVersion: claimResult.config.version, result: plain(result.run), brakingDecision: plain(result.brakingDecision) })).toEqual({ runId: claimResult.runId, acceptedForDisplay: true });
      const publicState = await t.query(api.sessions.getPublic, { sessionId });
      expect(publicState!.latestRun).toEqual(plain(result.run));
      expect(publicState!.scenario.route).toEqual(plain(data.scenario.route));
      expect(publicState!.scenario.seed).toBe(data.scenario.seed);
    }
  });

  it("rejects unknown denominators, inconsistent tallies and invented completion", async () => {
    const { t } = await setup();
    const run = await claim(t);
    const badUnknown = completed(run.runId); badUnknown.coverage.unknown = 1;
    await expect(finish(t, run, badUnknown)).rejects.toThrow("retain missed and unknown");
    const fabricated = completed(run.runId); fabricated.coverage.percent = 100;
    await expect(finish(t, run, fabricated)).rejects.toThrow("denominator");
    const fakeTime = completed(run.runId); fakeTime.outcome.completionTimeMs = 1000;
    await expect(finish(t, run, fakeTime)).rejects.toThrow("Only completed routes");
    const fakeBoundary = completed(run.runId); fakeBoundary.findings = fakeBoundary.findings.map((finding) => ({ ...finding, requiredStoppingDistanceM: finding.requiredStoppingDistanceM === null ? null : 0.1 }));
    await expect(finish(t, run, fakeBoundary)).rejects.toThrow("Diagnostic stopping distance");
  });

  it("requires unknowns to suppress coverage and blocks incomplete publication", async () => {
    const { t } = await setup();
    const run = await claim(t);
    const result = completed(run.runId);
    result.coverage.missedOrLate = 0; result.coverage.unknown = 1;
    result.findings = result.findings.map((finding) => finding.hazardId === "near-cable" ? { ...finding, status: "unknown", sampleMethod: "not_evaluated" } : finding);
    await expect(finish(t, run, result)).rejects.toThrow("denominator");
    result.coverage.percent = null; await finish(t, run, result);
    await expect(t.mutation(api.reports.publish, { runId: run.runId, token: ownerToken })).rejects.toThrow("Quantitative publication");
  });

  it("publishes one immutable token-free report after durable asset registration", async () => {
    const { t, data } = await setup();
    const run = await claim(t); await finish(t, run);
    await expect(t.mutation(api.reports.publish, { runId: run.runId, token: ownerToken })).rejects.toThrow("durable storage");
    await registerDurableAssets(t, data.scenario);
    const published = await t.mutation(api.reports.publish, { runId: run.runId, token: ownerToken });
    expect(await t.mutation(api.reports.publish, { runId: run.runId, token: ownerToken })).toEqual(published);
    expect((await t.query(api.sessions.getPublic, { sessionId })).latestReportId).toBe(published.reportId);
    const snapshot = await t.query(api.reports.get, published);
    expect(snapshot.status).toBe("blind_spot_observed");
    await t.mutation(api.library.ingest, { sessionId, token: ownerToken, item: plain({ ...data.library[0], version: 2, name: "Later library edit" }) });
    await t.mutation(api.configs.request, { sessionId, token: controllerToken, presetId: "permissive", clientRequestId: "later-config" });
    expect(await t.query(api.reports.get, published)).toEqual(snapshot);
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain(ownerToken); expect(serialized).not.toContain(controllerToken);
    expect(serialized).not.toContain("CapabilityHash");
    expect(await t.query(api.reports.get, { reportId: "unknown-report" })).toBeNull();
    expect(await t.query(api.reports.get, { reportId: "../../invalid" })).toBeNull();
  });

  it("requires durable report assets to belong to the run's session", async () => {
    const { t, data } = await setup();
    const otherSessionId = "other-assets-session";
    await t.mutation(internal.seed.bootstrap, { sessionId: otherSessionId, ...plain(data), ownerCapabilityHash: await capabilityHash(`${ownerToken}_other`), controllerCapabilityHash: await capabilityHash(`${controllerToken}_other`) });
    await registerDurableAssets(t, data.scenario, otherSessionId);
    const run = await claim(t); await finish(t, run);
    await expect(t.mutation(api.reports.publish, { runId: run.runId, token: ownerToken })).rejects.toThrow("this session's durable storage");
    await registerDurableAssets(t, data.scenario);
    const published = await t.mutation(api.reports.publish, { runId: run.runId, token: ownerToken });
    expect((await t.query(api.reports.get, published))!.scenario).toEqual(plain(data.scenario));
  });

  it("prominently preserves development proxy and hazard assumptions without duplicate limitations", async () => {
    const data = fixtures();
    const proxyLabel = "Development bulk proxy: Tripo integration pending.";
    data.scenario.assumptions = [...data.scenario.assumptions, proxyLabel, data.baselineConfig.assumptions[0]!];
    data.library[1]!.returnAssumption = proxyLabel;
    const { t } = await setup(data);
    const run = await claim(t); await finish(t, run);
    await registerDurableAssets(t, data.scenario);
    const published = await t.mutation(api.reports.publish, { runId: run.runId, token: ownerToken });
    const snapshot = await t.query(api.reports.get, published);
    expect(snapshot!.limitations).toContain(proxyLabel);
    expect(snapshot!.limitations).toContain(data.library[0]!.returnAssumption);
    for (const assumption of data.scenario.assumptions) expect(snapshot!.limitations).toContain(assumption);
    expect(snapshot!.limitations.filter((limitation) => limitation === proxyLabel)).toHaveLength(1);
    expect(new Set(snapshot!.limitations).size).toBe(snapshot!.limitations.length);
    await t.mutation(api.scenarios.create, { sessionId, token: ownerToken, scenario: plain({ ...data.scenario, version: 2, assumptions: ["Revised scenario assumptions."] }) });
    expect(await t.mutation(api.reports.publish, { runId: run.runId, token: ownerToken })).toEqual(published);
    expect(await t.query(api.reports.get, published)).toEqual(snapshot);
  });

  it("rejects a report checksum that differs from the owned uploaded bytes", async () => {
    const data = fixtures(); data.world.splat.sha256 = "b".repeat(64);
    const { t } = await setup(data);
    const run = await claim(t); await finish(t, run);
    await registerDurableAssets(t, data.scenario);
    await expect(t.mutation(api.reports.publish, { runId: run.runId, token: ownerToken })).rejects.toThrow("checksums must match");
  });

  it("returns latest owned world and scenario versions while rejecting controller queries", async () => {
    const { t, data } = await setup();
    const worldArgs = { sessionId, token: ownerToken, worldId: data.world.id };
    const scenarioArgs = { sessionId, token: ownerToken, scenarioId: data.scenario.id };
    expect(await t.query(api.worlds.latest, worldArgs)).toEqual(plain(data.world));
    expect(await t.query(api.scenarios.latest, scenarioArgs)).toEqual(plain(data.scenario));
    await expect(t.query(api.worlds.latest, { ...worldArgs, token: controllerToken })).rejects.toThrow("capability");
    await expect(t.query(api.scenarios.latest, { ...scenarioArgs, token: controllerToken })).rejects.toThrow("capability");
    const world = plain({ ...data.world, version: 2, name: "Second site version" });
    await t.mutation(api.worlds.ingest, { sessionId, token: ownerToken, world });
    const scenario = plain({ ...data.scenario, version: 2, world: world as unknown as Scenario["world"] });
    await t.mutation(api.scenarios.create, { sessionId, token: ownerToken, scenario });
    expect(await t.query(api.worlds.latest, worldArgs)).toEqual(world);
    expect(await t.query(api.scenarios.latest, scenarioArgs)).toEqual(scenario);
    expect(await t.query(api.worlds.latest, { ...worldArgs, worldId: "unknown-world" })).toBeNull();
    expect(await t.query(api.scenarios.latest, { ...scenarioArgs, scenarioId: "unknown-scenario" })).toBeNull();
    const other = fixtures(); other.world.name = "Other session's site";
    await t.mutation(internal.seed.bootstrap, { sessionId: "other-latest-session", ...plain(other), ownerCapabilityHash: await capabilityHash(`${ownerToken}_other`), controllerCapabilityHash: await capabilityHash(`${controllerToken}_other`) });
    await expect(t.query(api.worlds.latest, { ...worldArgs, sessionId: "other-latest-session" })).rejects.toThrow("capability");
    await expect(t.query(api.scenarios.latest, { ...scenarioArgs, sessionId: "other-latest-session" })).rejects.toThrow("capability");
    expect((await t.query(api.worlds.latest, worldArgs))!.name).toBe("Second site version");
  });

  it("validates uploaded bytes, owner registration and accepted content types", async () => {
    const { t } = await setup();
    const bytes = new TextEncoder().encode("actual uploaded asset bytes");
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const storageId = await t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob([bytes], { type: "model/gltf-binary" }));
      // convex-test 0.0.56 omits contentType when storing a Blob; model the upload metadata explicitly.
      await ctx.db.patch(id as never, { contentType: "model/gltf-binary" } as never);
      return id;
    });
    await expect(t.mutation(api.assets.completeUpload, { sessionId, token: ownerToken, storageId, sha256: digest })).rejects.toThrow("authorized upload");
    const upload = await t.mutation(api.assets.generateUploadUrl, { sessionId, token: ownerToken });
    expect(upload.uploadUrl).toMatch(/^https:\/\//);
    await expect(t.mutation(api.assets.completeUpload, { sessionId, token: ownerToken, storageId, sha256: "0".repeat(64) })).rejects.toThrow("SHA-256");
    const registered = await t.mutation(api.assets.completeUpload, { sessionId, token: ownerToken, storageId, sha256: digest });
    expect(registered.storageId).toBe(storageId); expect(registered.url).toMatch(/^https:\/\//);
    expect(await t.mutation(api.assets.completeUpload, { sessionId, token: ownerToken, storageId, sha256: digest })).toEqual(registered);
    vi.advanceTimersByTime(1000);
    await t.mutation(api.assets.generateUploadUrl, { sessionId, token: ownerToken });
    const badType = await t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob([bytes], { type: "text/html" }));
      await ctx.db.patch(id as never, { contentType: "text/html" } as never);
      return id;
    });
    await expect(t.mutation(api.assets.completeUpload, { sessionId, token: ownerToken, storageId: badType, sha256: digest })).rejects.toThrow("Unsupported asset");
  });

  it("blocks publication while estimated calibration registration is unverified", async () => {
    const { t, data } = await setup();
    const estimated = plain(data.world); estimated.version = 2;
    estimated.calibration.status = "unverified"; estimated.calibration.source = "estimated_reference";
    estimated.calibration.reference!.evidence = "assumed";
    await t.mutation(api.worlds.ingest, { sessionId, token: ownerToken, world: estimated });
    const changed = plain(data.scenario); changed.version = 2; changed.world = estimated;
    await t.mutation(api.scenarios.create, { sessionId, token: ownerToken, scenario: changed });
    const run = await claim(t); await finish(t, run);
    await expect(t.mutation(api.reports.publish, { runId: run.runId, token: ownerToken })).rejects.toThrow("verified calibration");
    const forged = { ...estimated, version: 3, calibration: { ...estimated.calibration, status: "verified", reference: { ...estimated.calibration.reference!, evidence: "operator_measured" } } };
    await expect(t.mutation(api.worlds.ingest, { sessionId, token: ownerToken, world: forged })).rejects.toThrow("must retain assumed evidence");
  });

  it("preserves inspected estimated scale as assumed evidence in an immutable report", async () => {
    const { t, data } = await setup();
    const estimated = plain(data.world); estimated.version = 2;
    estimated.calibration.source = "estimated_reference";
    estimated.calibration.reference = { label: "Estimated doorway", lengthM: 1, evidence: "assumed" };
    estimated.calibration.uncertaintyNote = "Scale is estimated from a typical doorway. Floor and transform registration were inspected; the reference was not measured.";
    await t.mutation(api.worlds.ingest, { sessionId, token: ownerToken, world: estimated });
    const changed = plain(data.scenario); changed.version = 2; changed.world = estimated;
    await t.mutation(api.scenarios.create, { sessionId, token: ownerToken, scenario: changed });
    const run = await claim(t); await finish(t, run);
    await registerDurableAssets(t, run.scenario);
    const published = await t.mutation(api.reports.publish, { runId: run.runId, token: ownerToken });
    const snapshot = await t.query(api.reports.get, published);
    expect(snapshot!.scenario.world.calibration).toEqual(estimated.calibration);
    expect(snapshot!.scenario.world.calibration.reference!.evidence).toBe("assumed");
    expect(snapshot!.limitations).toContain(estimated.calibration.uncertaintyNote);
    const revised = { ...estimated, version: 3, calibration: { ...estimated.calibration, reference: { ...estimated.calibration.reference, lengthM: 1.2 } } };
    await t.mutation(api.worlds.ingest, { sessionId, token: ownerToken, world: revised });
    expect(await t.query(api.reports.get, published)).toEqual(snapshot);
  });

  it("requires explicit evidence, inspection timestamp and uncertainty for verified estimated scale", async () => {
    const { t, data } = await setup();
    const estimated = plain(data.world); estimated.version = 2;
    estimated.calibration.source = "estimated_reference";
    estimated.calibration.reference!.evidence = "assumed";
    const missingReference = structuredClone(estimated); delete missingReference.calibration.reference;
    await expect(t.mutation(api.worlds.ingest, { sessionId, token: ownerToken, world: missingReference })).rejects.toThrow("must retain assumed evidence");
    const missingInspection = structuredClone(estimated); delete missingInspection.calibration.verifiedAt;
    await expect(t.mutation(api.worlds.ingest, { sessionId, token: ownerToken, world: missingInspection })).rejects.toThrow("inspection timestamp");
    const missingUncertainty = structuredClone(estimated); missingUncertainty.calibration.uncertaintyNote = " ";
    await expect(t.mutation(api.worlds.ingest, { sessionId, token: ownerToken, world: missingUncertainty })).rejects.toThrow("Calibration uncertainty");
    const mislabeledMeasured = structuredClone(estimated); mislabeledMeasured.calibration.source = "operator_reference";
    await expect(t.mutation(api.worlds.ingest, { sessionId, token: ownerToken, world: mislabeledMeasured })).rejects.toThrow("must be measured");
  });

  it("persists the pre-braking corridor and rejects a zero-speed recomputation", async () => {
    const { t } = await setup();
    const run = await claim(t);
    const result = completed(run.runId);
    result.outcome = { pass: "reactive", collisions: 0, nearMisses: 0, stopEvents: 1, falseStopEvents: 0, falseStopPercent: 0, routeCompletionPercent: 25, completionTimeMs: null, termination: "stopped" };
    result.events = [{ timeMs: 100, kind: "braking", positionM: [0, 0, -0.1] }, { timeMs: 1300, kind: "stop", positionM: [0, 0, -0.8] }];
    const args = { runId: run.runId, token: ownerToken, instanceId, scenarioVersion: 1, configVersion: 1, result: plain(result) };
    await expect(t.mutation(api.runs.complete, args)).rejects.toThrow("saved decision corridor");
    const decision = { timeMs: 100, pose: { positionM: [0, 0, -0.1], orientation: [0, 0, 0, 1] }, speedMps: 1, corridorM: 0.8, truthHazardIds: ["near-cable"], environmentInCorridor: false };
    await expect(t.mutation(api.runs.complete, { ...args, brakingDecision: { ...decision, corridorM: 0.1 } })).rejects.toThrow("Saved stopping corridor");
    await expect(t.mutation(api.runs.complete, { ...args, brakingDecision: { ...decision, speedMps: 0 } })).rejects.toThrow("Pre-braking speed");
    await expect(t.mutation(api.runs.complete, { ...args, brakingDecision: { ...decision, truthHazardIds: [] } })).rejects.toThrow("False stops");
    await t.mutation(api.runs.complete, { ...args, brakingDecision: decision });
    const saved = await t.run(async (ctx) => ctx.db.get(ctx.db.normalizeId("runs", run.runId)!));
    expect(saved!.brakingDecision).toEqual(decision);
  });

  it("blocks unknown-free quantitative publication when the required reactive pass times out", async () => {
    const { t } = await setup();
    const run = await claim(t); const result = completed(run.runId);
    result.outcome.termination = "timeout"; result.outcome.collisions = 0; result.events = [];
    await finish(t, run, result);
    await expect(t.mutation(api.reports.publish, { runId: run.runId, token: ownerToken })).rejects.toThrow("Quantitative publication");
  });

  it("requires monotonic owned snapshots and rejects unsafe URLs/nonfinite geometry", async () => {
    const { t, data } = await setup();
    await expect(t.mutation(api.worlds.ingest, { sessionId, token: ownerToken, world: plain({ ...data.world, version: 3 }) })).rejects.toThrow("exactly one");
    await expect(t.mutation(api.worlds.ingest, { sessionId, token: ownerToken, world: plain({ ...data.world, version: 2, sourcePhotoUrl: "https://provider.example.com/photo?token=secret" }) })).rejects.toThrow("without credentials");
    const invalid = plain(data.scenario); invalid.version = 2; invalid.route[0].positionM[0] = NaN;
    await expect(t.mutation(api.scenarios.create, { sessionId, token: ownerToken, scenario: invalid })).rejects.toThrow("allowed range");
    const fakeWorld = plain(data.scenario); fakeWorld.version = 2; fakeWorld.world.name = "Not ingested";
    await expect(t.mutation(api.scenarios.create, { sessionId, token: ownerToken, scenario: fakeWorld })).rejects.toThrow("ingested world");
  });
});
