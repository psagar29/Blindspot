/**
 * Deterministic fixture bridge for the independent UI preview (src/ui/dev.tsx).
 * Implements the frozen RuntimeBridge contract with clearly labeled sample
 * data: no Convex, no providers, no engine. Person B's RuntimeRoot/useBlindspot
 * replaces this in the composed app; UI components must not know which one
 * they are talking to.
 */
import type {
  ActionResult,
  AppActions,
  AppError,
  AppState,
  CompletedRun,
  RouteState,
  RuntimeBridge,
  SensorConfig,
} from "../../shared/contracts";
import { CONTRACT_VERSION } from "../../shared/contracts";
import {
  buildFixtureReport,
  FIXTURE_REPORT_ID,
  fixtureConfigs,
  fixtureIncompleteRun,
  fixtureRuns,
  fixtureScenario,
  fixtureSession,
  fixtureWorld,
  verifiedCalibration,
} from "./fixtureData";

export type FixturePresetName =
  | "fresh"
  | "world-uncalibrated"
  | "ready"
  | "completed-baseline"
  | "queued-from-phone"
  | "running"
  | "published"
  | "incomplete-run"
  | "no-stop-events"
  | "generation-failed"
  | "offline"
  | "controller-token-expired";

export interface FixtureBridgeOptions {
  /** Public app origin for share links; unset disables sharing with a setup message. */
  publicOrigin?: string;
  /** Mirrors VITE_AUTHORING_ENABLED !== "false". */
  authoringEnabled?: boolean;
  /** Initial location path, e.g. "/", "/control/sess-fixture-01", "/reports/rpt-fixture-0001". */
  initialPath?: string;
  /** Sync browser history on navigate() (dev preview); off in unit tests by default. */
  syncHistory?: boolean;
}

export interface FixtureDevControls {
  loadPreset(name: FixturePresetName): void;
  /** Make the next call of one action fail with a retryable fixture error. */
  failNext(action: "authorScenario" | "requestConfig" | "startRun" | "publishReport" | null): void;
  setConnection(connection: AppState["connection"]): void;
  setOperatorOnline(online: boolean): void;
}

export interface FixtureBridge extends RuntimeBridge {
  subscribe(listener: () => void): () => void;
  getState(): AppState;
  /** Fixture-only controls for the dev preview panel. Not part of the contract. */
  dev: FixtureDevControls;
  /** Clears pending timers (unmount/tests). */
  dispose(): void;
}

export function parseRoute(path: string): RouteState {
  const clean = path.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
  if (clean === "/" || clean === "/ui.html" || clean === "/index.html") return { kind: "workspace" };
  const controller = /^\/control\/([^/]+)$/.exec(clean);
  if (controller?.[1]) return { kind: "controller", sessionId: controller[1] };
  const report = /^\/reports\/([^/]+)$/.exec(clean);
  if (report?.[1]) return { kind: "report", reportId: report[1] };
  return { kind: "not_found" };
}

function err(code: string, message: string, retryable: boolean): { ok: false; error: AppError } {
  return { ok: false, error: { code, message, retryable } };
}

const OK: ActionResult = { ok: true };

/** Deterministic pseudo point count so the frame summary moves without randomness. */
function pointCountAt(timeMs: number): number {
  return 1180 + ((Math.floor(timeMs / 200) * 137) % 640);
}

export function createFixtureBridge(options: FixtureBridgeOptions = {}): FixtureBridge {
  const publicOrigin = options.publicOrigin?.trim() ? options.publicOrigin.trim().replace(/\/$/, "") : undefined;
  const authoringEnabled = options.authoringEnabled ?? true;
  const syncHistory = options.syncHistory ?? false;

  const listeners = new Set<() => void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let disposed = false;

  let failNextAction: string | null = null;
  let lastFailed: { action: "authorScenario" | "requestConfig" | "startRun" | "publishReport"; run: () => Promise<ActionResult> } | null = null;
  let configVersionCounter = 1;
  let publishedReport: ReturnType<typeof buildFixtureReport> | null = null;

  function capabilitiesFor(route: RouteState): AppState["capabilities"] {
    if (route.kind === "workspace") {
      return authoringEnabled
        ? { authoring: true, run: true, publish: true }
        : {
            authoring: false,
            run: false,
            publish: false,
            authoringReason:
              "Read-only session: authoring and runs need the operator workstation with the local provider service.",
          };
    }
    if (route.kind === "controller") {
      return {
        authoring: false,
        run: false,
        publish: false,
        authoringReason: "Operator workstation required.",
      };
    }
    return { authoring: false, run: false, publish: false };
  }

  function baseState(route: RouteState): AppState {
    return {
      contractVersion: CONTRACT_VERSION,
      mode: "fixture",
      route,
      status: "empty",
      connection: "connected",
      capabilities: capabilitiesFor(route),
      session: fixtureSession(publicOrigin),
      world: null,
      scenario: null,
      config: null,
      library: [],
      frame: null,
      latestRun: null,
      report: null,
      reportLoading: false,
      reportUrl: null,
      error: null,
      stageLabel: null,
      elapsedMs: null,
    };
  }

  let state: AppState = baseState(parseRoute(options.initialPath ?? "/"));

  function emit() {
    for (const l of listeners) l();
  }

  function set(patch: Partial<AppState>) {
    if (disposed) return;
    state = { ...state, ...patch };
    emit();
  }

  function after(ms: number, fn: () => void): void {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!disposed) fn();
    }, ms);
    timers.add(t);
  }

  function clearTimers() {
    for (const t of timers) clearTimeout(t);
    timers.clear();
  }

  function shouldFail(action: string): boolean {
    if (failNextAction === action) {
      failNextAction = null;
      return true;
    }
    return false;
  }

  function readyScenarioState(): Partial<AppState> {
    const calibration = verifiedCalibration({
      referenceLabel: "Marked floor lane width",
      referenceLengthM: 2.4,
      evidence: "operator_measured",
      correctionFactor: 1.02,
    });
    const world = { ...fixtureWorld, calibration };
    const scenario = { ...fixtureScenario, world };
    return {
      status: "ready",
      world,
      scenario,
      library: scenario.hazards.map((h) => h.libraryItem),
      config: { ...fixtureConfigs.baseline, version: 1 },
      stageLabel: null,
      elapsedMs: null,
      error: null,
    };
  }

  function completedRunFor(presetId: SensorConfig["presetId"], version: number): CompletedRun {
    const run = fixtureRuns[presetId];
    return { ...run, config: { ...run.config, version } };
  }

  /** Finish a run for the requested preset and update session versions. */
  function completeRun(presetId: SensorConfig["presetId"], version: number) {
    const run = completedRunFor(presetId, version);
    const duration = run.events[run.events.length - 1]?.timeMs ?? 0;
    set({
      status: "ready",
      latestRun: run,
      frame: {
        timeMs: duration,
        pass: "recording",
        pose: run.events[run.events.length - 1]
          ? { positionM: run.events[run.events.length - 1]!.positionM, orientation: [0, 0, 0, 1] }
          : { positionM: [0, 0, 0], orientation: [0, 0, 0, 1] },
        speedMps: 0,
        playback: "finished",
        perceivedPointCount: pointCountAt(duration),
      },
      session: state.session
        ? {
            ...state.session,
            activeConfigVersion: null,
            completedConfigVersion: version,
            requestedConfigVersion:
              state.session.requestedConfigVersion === version ? null : state.session.requestedConfigVersion,
          }
        : state.session,
      stageLabel: null,
      elapsedMs: null,
    });
  }

  /** Simulated operator pickup for controller-originated requests. */
  function operatorExecutes(presetId: SensorConfig["presetId"], version: number) {
    after(1400, () => {
      if (!state.session?.operatorOnline) return; // stays queued
      set({
        status: "running",
        session: state.session ? { ...state.session, activeConfigVersion: version } : state.session,
        frame: {
          timeMs: 0,
          pass: "reactive",
          pose: { positionM: [0, 0, 0], orientation: [0, 0, 0, 1] },
          speedMps: 1.2,
          playback: "playing",
          perceivedPointCount: pointCountAt(0),
        },
      });
      after(2200, () => completeRun(presetId, version));
    });
  }

  // ---------- playback (recorded run) ----------
  let playbackTimer: ReturnType<typeof setInterval> | null = null;

  function stopPlaybackTimer() {
    if (playbackTimer !== null) {
      clearInterval(playbackTimer);
      playbackTimer = null;
    }
  }

  function playbackDuration(): number {
    const events = state.latestRun?.events;
    return events && events.length > 0 ? events[events.length - 1]!.timeMs : 0;
  }

  function setFrameTime(timeMs: number, playback: NonNullable<AppState["frame"]>["playback"]) {
    const duration = playbackDuration();
    const t = Math.max(0, Math.min(duration, Math.round(timeMs)));
    const speed = playback === "playing" && t < duration ? 1.2 : 0;
    set({
      frame: {
        timeMs: t,
        pass: "recording",
        pose: { positionM: [0, 0, (t / Math.max(duration, 1)) * 12], orientation: [0, 0, 0, 1] },
        speedMps: speed,
        playback: t >= duration && playback === "playing" ? "finished" : playback,
        perceivedPointCount: pointCountAt(t),
      },
    });
  }

  // ---------- actions ----------
  const actions: AppActions = {
    async authorScenario(input) {
      if (!state.capabilities.authoring) {
        return err(
          "authoring_unavailable",
          state.capabilities.authoringReason ?? "Authoring is unavailable in this session.",
          false,
        );
      }
      const sentence = input.sentence.trim();
      if (sentence.length < 8) {
        return err("invalid_sentence", "Describe the inspection in at least one short sentence.", false);
      }
      const run = async (): Promise<ActionResult> => {
        set({ status: "uploading", error: null, stageLabel: "Preparing source photo (fixture)", elapsedMs: 0 });
        if (shouldFail("authorScenario")) {
          after(700, () => {
            set({
              status: "error",
              error: {
                code: "provider_unavailable",
                message:
                  "World generation service unreachable (fixture failure injection). Your sentence and photo are preserved.",
                retryable: true,
              },
              stageLabel: null,
              elapsedMs: null,
            });
          });
          return OK; // failure surfaces through state; the submit itself was accepted
        }
        after(600, () => {
          set({ status: "generating", stageLabel: "Reconstructing world from photo (fixture)", elapsedMs: 600 });
          after(900, () => set({ elapsedMs: 1500, stageLabel: "Preparing collider mesh (fixture)" }));
          after(1800, () => {
            set({
              status: "calibrating",
              world: fixtureWorld,
              stageLabel: null,
              elapsedMs: null,
              scenario: null,
            });
          });
        });
        return OK;
      };
      lastFailed = { action: "authorScenario", run };
      return run();
    },

    async confirmCalibration(input) {
      if (!state.world || state.world.id !== input.worldId) {
        return err("unknown_world", "No world with that id is loaded.", false);
      }
      if (
        !Number.isFinite(input.referenceLengthM) ||
        input.referenceLengthM <= 0 ||
        !Number.isFinite(input.correctionFactor) ||
        input.correctionFactor <= 0
      ) {
        return err("invalid_calibration", "Reference length and correction factor must be positive numbers.", false);
      }
      const calibration = verifiedCalibration({
        referenceLabel: input.referenceLabel,
        referenceLengthM: input.referenceLengthM,
        evidence: input.evidence,
        correctionFactor: input.correctionFactor,
      });
      const world = { ...state.world, calibration };
      const scenario = { ...fixtureScenario, world };
      set({
        world,
        scenario,
        library: scenario.hazards.map((h) => h.libraryItem),
        config: state.config ?? { ...fixtureConfigs.baseline, version: 1 },
        status: "ready",
        error: null,
      });
      return OK;
    },

    async requestConfig(presetId) {
      const preset = fixtureConfigs[presetId];
      if (!preset) return err("unknown_preset", "That preset is not in the allowlist.", false);
      if (shouldFail("requestConfig")) {
        return err("request_rejected", "Configuration request was rejected (fixture failure injection).", true);
      }
      if (state.route.kind === "controller" && state.error?.code === "controller_token_expired") {
        return err("controller_token_expired", "This controller link has expired. Ask the operator for a fresh QR code.", false);
      }
      const version = ++configVersionCounter;
      set({
        config: { ...preset, version },
        status: state.status === "ready" || state.status === "queued" ? "queued" : state.status,
        session: state.session ? { ...state.session, requestedConfigVersion: version } : state.session,
        error: null,
      });
      if (state.route.kind === "controller") operatorExecutes(presetId, version);
      return OK;
    },

    async startRun() {
      if (!state.capabilities.run) {
        return err("run_unavailable", "Runs execute on the operator workstation.", false);
      }
      if (!state.scenario || !state.config) {
        return err("not_ready", "Author and calibrate a scenario before running.", false);
      }
      if (shouldFail("startRun")) {
        return err("engine_error", "Evaluation failed to start (fixture failure injection).", true);
      }
      const presetId = state.config.presetId;
      const version = state.config.version;
      stopPlaybackTimer();
      set({
        status: "running",
        error: null,
        session: state.session ? { ...state.session, activeConfigVersion: version } : state.session,
        frame: {
          timeMs: 0,
          pass: "reactive",
          pose: { positionM: [0, 0, 0], orientation: [0, 0, 0, 1] },
          speedMps: 1.2,
          playback: "playing",
          perceivedPointCount: pointCountAt(0),
        },
      });
      // Deterministic simulated progress: four coarse frame updates, then completion.
      const total = 2400;
      for (const t of [600, 1200, 1800]) {
        after(t, () => {
          if (state.status !== "running") return;
          set({
            frame: {
              timeMs: t,
              pass: "reactive",
              pose: { positionM: [0, 0, (t / total) * 12], orientation: [0, 0, 0, 1] },
              speedMps: 1.2,
              playback: "playing",
              perceivedPointCount: pointCountAt(t),
            },
          });
        });
      }
      after(total, () => completeRun(presetId, version));
      return OK;
    },

    async publishReport() {
      if (!state.capabilities.publish) {
        return err("publish_unavailable", "Publishing requires the operator session.", false);
      }
      if (!state.latestRun || !state.scenario) {
        return err("no_completed_run", "Publish needs a completed run.", false);
      }
      if (shouldFail("publishReport")) {
        return err("publish_failed", "Report storage rejected the snapshot (fixture failure injection).", true);
      }
      const run = state.latestRun;
      const scenario = state.scenario;
      set({ status: "publishing", error: null });
      after(900, () => {
        publishedReport = buildFixtureReport(run, scenario);
        set({
          status: "published",
          report: publishedReport,
          reportUrl: publicOrigin ? `${publicOrigin}/reports/${FIXTURE_REPORT_ID}` : null,
        });
      });
      return OK;
    },

    async retry() {
      if (state.error?.retryable && lastFailed) {
        const op = lastFailed;
        set({ error: null });
        return op.run();
      }
      if (state.error) {
        set({ error: null, status: state.world ? "ready" : "empty" });
        return OK;
      }
      return err("nothing_to_retry", "There is no failed operation to retry.", false);
    },

    navigate(path) {
      const route = parseRoute(path);
      if (syncHistory && typeof window !== "undefined" && window.location.pathname !== path) {
        window.history.pushState(null, "", path);
      }
      applyRoute(route);
    },

    setPlayback(value) {
      if (!state.latestRun || !state.frame) return;
      stopPlaybackTimer();
      if (value === "playing") {
        const duration = playbackDuration();
        const startFrom = state.frame.timeMs >= duration ? 0 : state.frame.timeMs;
        setFrameTime(startFrom, "playing");
        playbackTimer = setInterval(() => {
          const current = state.frame?.timeMs ?? 0;
          const next = current + 100;
          if (next >= duration) {
            stopPlaybackTimer();
            setFrameTime(duration, "playing"); // resolves to finished
          } else {
            setFrameTime(next, "playing");
          }
        }, 100);
        timers.add(playbackTimer as unknown as ReturnType<typeof setTimeout>);
      } else {
        setFrameTime(state.frame.timeMs, "paused");
      }
    },

    seek(timeMs) {
      if (!state.latestRun || !state.frame) return;
      stopPlaybackTimer();
      setFrameTime(timeMs, "paused");
    },
  };

  function applyRoute(route: RouteState) {
    const patch: Partial<AppState> = { route, capabilities: capabilitiesFor(route) };
    if (route.kind === "report") {
      patch.reportLoading = true;
      patch.report = null;
      set(patch);
      after(400, () => {
        const found = publishedReport && publishedReport.id === route.reportId ? publishedReport : null;
        set({ reportLoading: false, report: found });
      });
      return;
    }
    set(patch);
  }

  // ---------- dev controls (fixture-only) ----------
  const dev: FixtureDevControls = {
    loadPreset(name) {
      clearTimers();
      stopPlaybackTimer();
      const route = state.route;
      const ready = readyScenarioState();
      switch (name) {
        case "fresh":
          state = baseState(route);
          configVersionCounter = 1;
          publishedReport = null;
          emit();
          break;
        case "world-uncalibrated":
          state = { ...baseState(route), status: "calibrating", world: fixtureWorld };
          emit();
          break;
        case "ready":
          state = { ...baseState(route), ...ready };
          emit();
          break;
        case "completed-baseline": {
          configVersionCounter = 1;
          state = { ...baseState(route), ...ready };
          completeRun("baseline", 1);
          break;
        }
        case "queued-from-phone": {
          configVersionCounter = 2;
          state = { ...baseState(route), ...ready };
          completeRun("baseline", 1);
          const preset = fixtureConfigs.higher_resolution;
          set({
            config: { ...preset, version: 2 },
            status: "queued",
            session: state.session ? { ...state.session, requestedConfigVersion: 2 } : state.session,
          });
          break;
        }
        case "running":
          state = {
            ...baseState(route),
            ...ready,
            status: "running",
            frame: {
              timeMs: 1200,
              pass: "reactive",
              pose: { positionM: [0, 0, 4.2], orientation: [0, 0, 0, 1] },
              speedMps: 1.2,
              playback: "playing",
              perceivedPointCount: pointCountAt(1200),
            },
          };
          emit();
          break;
        case "published": {
          configVersionCounter = 1;
          state = { ...baseState(route), ...ready };
          completeRun("baseline", 1);
          publishedReport = buildFixtureReport(state.latestRun!, state.scenario!);
          set({
            status: "published",
            report: publishedReport,
            reportUrl: publicOrigin ? `${publicOrigin}/reports/${FIXTURE_REPORT_ID}` : null,
          });
          break;
        }
        case "incomplete-run":
          state = { ...baseState(route), ...ready, latestRun: fixtureIncompleteRun };
          emit();
          break;
        case "no-stop-events": {
          const base = fixtureRuns.higher_resolution;
          state = {
            ...baseState(route),
            ...ready,
            latestRun: {
              ...base,
              id: "run-fixture-no-stops",
              outcome: {
                ...base.outcome,
                collisions: 0,
                nearMisses: 0,
                stopEvents: 0,
                falseStopEvents: 0,
                falseStopPercent: null,
                termination: "completed",
              },
            },
          };
          emit();
          break;
        }
        case "generation-failed":
          state = {
            ...baseState(route),
            status: "error",
            error: {
              code: "provider_unavailable",
              message:
                "World generation service unreachable (fixture failure injection). Your sentence and photo are preserved.",
              retryable: true,
            },
          };
          emit();
          break;
        case "offline":
          set({ connection: "offline", session: state.session ? { ...state.session, operatorOnline: false } : state.session });
          break;
        case "controller-token-expired":
          set({
            error: {
              code: "controller_token_expired",
              message: "This controller link has expired. Ask the operator for a fresh QR code.",
              retryable: false,
            },
          });
          break;
      }
    },
    failNext(action) {
      failNextAction = action;
    },
    setConnection(connection) {
      set({ connection });
    },
    setOperatorOnline(online) {
      set({ session: state.session ? { ...state.session, operatorOnline: online } : state.session });
    },
  };

  if (syncHistory && typeof window !== "undefined") {
    window.addEventListener("popstate", () => applyRoute(parseRoute(window.location.pathname)));
  }

  return {
    get state() {
      return state;
    },
    actions,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState: () => state,
    dev,
    dispose() {
      disposed = true;
      clearTimers();
      stopPlaybackTimer();
    },
  };
}
