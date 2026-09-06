import { useState } from "react";
import type { RuntimeBridge } from "../../../shared/contracts";
import { TopBar } from "./TopBar";
import { LeftRail } from "./LeftRail";
import { ViewportShell } from "./ViewportShell";
import { PlaybackStrip } from "./PlaybackStrip";
import { MetricsPanel } from "./MetricsPanel";
import { SensorDrawer } from "./SensorDrawer";
import { Badge } from "../components/Badges";
import { ErrorCallout, InfoCallout } from "../components/Callout";

/** Run status + start control between viewport and playback. */
function RunControls({ state, actions }: RuntimeBridge) {
  const [error, setError] = useState<string | null>(null);
  const canRun = state.capabilities.run && state.scenario !== null && state.config !== null;
  const running = state.status === "running";
  const queued = state.status === "queued";

  async function start() {
    setError(null);
    const result = await actions.startRun();
    if (!result.ok) setError(result.error.message);
  }

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: "var(--bs-s3)", flexWrap: "wrap" }}
      aria-label="Run controls"
    >
      <button
        type="button"
        className="bs-btn bs-btn--primary"
        disabled={!canRun || running}
        onClick={() => void start()}
      >
        {running ? "Evaluating…" : queued ? "Run queued config" : "Start run"}
      </button>
      {state.config ? (
        <span className="bs-support">
          Next run: <strong>{state.config.label}</strong>{" "}
          <span className="bs-mono">v{state.config.version}</span>
        </span>
      ) : (
        <span className="bs-support">Author a scenario to enable runs.</span>
      )}
      {queued ? <Badge tone="amber">Queued</Badge> : null}
      {running ? (
        <Badge tone="teal">
          <span className="bs-dot" aria-hidden="true" />
          Running
        </Badge>
      ) : null}
      {!state.capabilities.run ? (
        <span className="bs-meta">
          {state.mode === "recording" && state.scenario ? "Loading the 3D scene for browser replay…" : "Runs execute on the operator workstation."}
        </span>
      ) : null}
      {error ? (
        <span className="bs-meta" role="alert" style={{ color: "var(--bs-rust)" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function Workspace(props: RuntimeBridge & { viewport: React.ReactNode }) {
  const { state, actions, viewport } = props;
  const [railOpen, setRailOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="bs-app">
      <TopBar
        state={state}
        actions={actions}
        onToggleRail={() => setRailOpen((v) => !v)}
        onToggleDrawer={() => setDrawerOpen((v) => !v)}
        drawerOpen={drawerOpen}
      />
      {state.connection !== "connected" ? (
        <div style={{ padding: "var(--bs-s3) var(--bs-s5) 0" }}>
          <InfoCallout title={state.connection === "offline" ? "Offline" : "Reconnecting…"}>
            {state.connection === "offline"
              ? "The session backend is unreachable. Cached results stay visible; configuration requests and publishing resume after reconnect."
              : "Connection dropped; retrying. Nothing has been lost."}
          </InfoCallout>
        </div>
      ) : null}
      <div className={`bs-workspace${drawerOpen ? " bs-workspace--drawer-open" : ""}`}>
        <LeftRail state={state} actions={actions} open={railOpen} />
        <main className="bs-main">
          <ViewportShell state={state} actions={actions} viewport={viewport} />
          <RunControls state={state} actions={actions} />
          <PlaybackStrip state={state} actions={actions} />
          <MetricsPanel state={state} />
          {state.status === "error" && state.error && state.world ? (
            <ErrorCallout error={state.error} onRetry={() => void actions.retry()} />
          ) : null}
        </main>
        <SensorDrawer state={state} actions={actions} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </div>
    </div>
  );
}

export default Workspace;
