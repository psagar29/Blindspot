import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFixtureBridge, parseRoute } from "./createFixtureBridge";

describe("parseRoute", () => {
  it("maps the contract routes", () => {
    expect(parseRoute("/")).toEqual({ kind: "workspace" });
    expect(parseRoute("/ui.html")).toEqual({ kind: "workspace" });
    expect(parseRoute("/control/sess-1")).toEqual({ kind: "controller", sessionId: "sess-1" });
    expect(parseRoute("/reports/rpt-9")).toEqual({ kind: "report", reportId: "rpt-9" });
    expect(parseRoute("/nope/xyz")).toEqual({ kind: "not_found" });
  });
});

describe("createFixtureBridge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("walks authoring through uploading, generating, calibrating", async () => {
    const bridge = createFixtureBridge();
    const result = await bridge.actions.authorScenario({ sentence: "Check the intake lane for cables." });
    expect(result.ok).toBe(true);
    expect(bridge.state.status).toBe("uploading");
    await vi.advanceTimersByTimeAsync(700);
    expect(bridge.state.status).toBe("generating");
    expect(bridge.state.stageLabel).toContain("fixture");
    await vi.advanceTimersByTimeAsync(2000);
    expect(bridge.state.status).toBe("calibrating");
    expect(bridge.state.world).not.toBeNull();
    expect(bridge.state.world?.calibration.status).toBe("unverified");
    expect(bridge.state.scenario).toBeNull();
    bridge.dispose();
  });

  it("rejects a too-short sentence without changing state", async () => {
    const bridge = createFixtureBridge();
    const result = await bridge.actions.authorScenario({ sentence: "hi" });
    expect(result.ok).toBe(false);
    expect(bridge.state.status).toBe("empty");
    bridge.dispose();
  });

  it("verifies calibration and builds the scenario", async () => {
    const bridge = createFixtureBridge();
    await bridge.actions.authorScenario({ sentence: "Check the intake lane for cables." });
    await vi.advanceTimersByTimeAsync(3000);
    const worldId = bridge.state.world!.id;

    const bad = await bridge.actions.confirmCalibration({
      worldId,
      referenceLabel: "Lane width",
      referenceLengthM: -2,
      evidence: "operator_measured",
      correctionFactor: 1,
    });
    expect(bad.ok).toBe(false);
    expect(bridge.state.status).toBe("calibrating");

    const good = await bridge.actions.confirmCalibration({
      worldId,
      referenceLabel: "Lane width",
      referenceLengthM: 2.4,
      evidence: "operator_measured",
      correctionFactor: 1.02,
    });
    expect(good.ok).toBe(true);
    expect(bridge.state.status).toBe("ready");
    expect(bridge.state.world?.calibration.status).toBe("verified");
    expect(bridge.state.world?.calibration.reference?.label).toBe("Lane width");
    expect(bridge.state.scenario?.hazards).toHaveLength(3);
    expect(bridge.state.config?.presetId).toBe("baseline");
    bridge.dispose();
  });

  it("distinguishes a requested config from the last completed run", async () => {
    const bridge = createFixtureBridge();
    bridge.dev.loadPreset("completed-baseline");
    const completedVersion = bridge.state.latestRun!.config.version;

    await bridge.actions.requestConfig("higher_resolution");
    expect(bridge.state.status).toBe("queued");
    expect(bridge.state.config?.presetId).toBe("higher_resolution");
    expect(bridge.state.session?.requestedConfigVersion).toBeGreaterThan(completedVersion);
    // the old gauge data still belongs to the old config version
    expect(bridge.state.latestRun?.config.version).toBe(completedVersion);

    await bridge.actions.startRun();
    expect(bridge.state.status).toBe("running");
    await vi.advanceTimersByTimeAsync(2500);
    expect(bridge.state.status).toBe("ready");
    expect(bridge.state.latestRun?.config.presetId).toBe("higher_resolution");
    expect(bridge.state.session?.completedConfigVersion).toBe(bridge.state.latestRun?.config.version);
    bridge.dispose();
  });

  it("runs a controller request through queued, running, completed when the operator is online", async () => {
    const bridge = createFixtureBridge({ initialPath: "/control/sess-fixture-01" });
    bridge.dev.loadPreset("ready");
    const result = await bridge.actions.requestConfig("permissive");
    expect(result.ok).toBe(true);
    expect(bridge.state.status).toBe("queued");
    await vi.advanceTimersByTimeAsync(1500);
    expect(bridge.state.status).toBe("running");
    await vi.advanceTimersByTimeAsync(2300);
    expect(bridge.state.status).toBe("ready");
    expect(bridge.state.latestRun?.config.presetId).toBe("permissive");
    bridge.dispose();
  });

  it("keeps a controller request queued while the operator is offline", async () => {
    const bridge = createFixtureBridge({ initialPath: "/control/sess-fixture-01" });
    bridge.dev.loadPreset("ready");
    bridge.dev.setOperatorOnline(false);
    await bridge.actions.requestConfig("baseline");
    await vi.advanceTimersByTimeAsync(5000);
    expect(bridge.state.status).toBe("queued");
    expect(bridge.state.latestRun).toBeNull();
    bridge.dispose();
  });

  it("publishes a report and resolves it by id, honoring the unset public origin", async () => {
    const bridge = createFixtureBridge();
    bridge.dev.loadPreset("completed-baseline");
    await bridge.actions.publishReport();
    expect(bridge.state.status).toBe("publishing");
    await vi.advanceTimersByTimeAsync(1000);
    expect(bridge.state.status).toBe("published");
    expect(bridge.state.report?.claimBoundary).toContain("does not certify safety");
    expect(bridge.state.reportUrl).toBeNull(); // no VITE_PUBLIC_APP_ORIGIN configured

    bridge.actions.navigate("/reports/rpt-fixture-0001");
    expect(bridge.state.reportLoading).toBe(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(bridge.state.report?.id).toBe("rpt-fixture-0001");

    bridge.actions.navigate("/reports/rpt-missing");
    await vi.advanceTimersByTimeAsync(500);
    expect(bridge.state.report).toBeNull();
    expect(bridge.state.reportLoading).toBe(false);
    bridge.dispose();
  });

  it("builds share URLs from the configured public origin", async () => {
    const bridge = createFixtureBridge({ publicOrigin: "https://blindspot.example" });
    bridge.dev.loadPreset("completed-baseline");
    expect(bridge.state.session?.controllerUrl).toBe(
      "https://blindspot.example/control/sess-fixture-01#token=fixture-controller-token",
    );
    await bridge.actions.publishReport();
    await vi.advanceTimersByTimeAsync(1000);
    expect(bridge.state.reportUrl).toBe("https://blindspot.example/reports/rpt-fixture-0001");
    bridge.dispose();
  });

  it("surfaces injected failures as retryable errors and recovers on retry", async () => {
    const bridge = createFixtureBridge();
    bridge.dev.loadPreset("ready");
    bridge.dev.failNext("startRun");
    const failed = await bridge.actions.startRun();
    expect(failed).toMatchObject({ ok: false, error: { retryable: true } });
    expect(bridge.state.status).toBe("ready"); // no spinner left running

    const retried = await bridge.actions.startRun();
    expect(retried.ok).toBe(true);
    await vi.advanceTimersByTimeAsync(2500);
    expect(bridge.state.latestRun).not.toBeNull();
    bridge.dispose();
  });

  it("seeks and plays back a recorded run without mutating measured results", async () => {
    const bridge = createFixtureBridge();
    bridge.dev.loadPreset("completed-baseline");
    const before = bridge.state.latestRun;
    bridge.actions.seek(1000);
    expect(bridge.state.frame?.timeMs).toBe(1000);
    expect(bridge.state.frame?.playback).toBe("paused");
    bridge.actions.setPlayback("playing");
    await vi.advanceTimersByTimeAsync(400);
    expect(bridge.state.frame!.timeMs).toBeGreaterThan(1000);
    bridge.actions.setPlayback("paused");
    expect(bridge.state.latestRun).toBe(before);
    bridge.dispose();
  });

  it("denies authoring on the controller route with a reason", async () => {
    const bridge = createFixtureBridge({ initialPath: "/control/sess-fixture-01" });
    const result = await bridge.actions.authorScenario({ sentence: "Check the lane for cables." });
    expect(result).toMatchObject({ ok: false, error: { code: "authoring_unavailable" } });
    bridge.dispose();
  });
});
