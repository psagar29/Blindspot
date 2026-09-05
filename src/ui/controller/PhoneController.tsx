import { useState } from "react";
import type { RouteState, RuntimeBridge, SensorConfig } from "../../../shared/contracts";
import { PRESET_DISPLAY, PRESET_IDS } from "../presets";
import { Badge, ConnectionBadge, ModeBadge } from "../components/Badges";
import { ErrorCallout } from "../components/Callout";
import { CoverageDial } from "../components/CoverageDial";
import { coverageReading, falseStopReading } from "../metrics";

/**
 * Lightweight preset controller for phones. No engine, no splats, no authoring:
 * submit one allowlisted preset and watch the session status. Works at 360px.
 */
export function PhoneController(props: RuntimeBridge & { route: Extract<RouteState, { kind: "controller" }> }) {
  const { state, actions, route } = props;
  const [requestError, setRequestError] = useState<string | null>(null);
  const [lastRequested, setLastRequested] = useState<SensorConfig["presetId"] | null>(null);

  const session = state.session;
  const run = state.latestRun;
  const expired = state.error?.code === "controller_token_expired";
  const offline = state.connection === "offline";
  const operatorOffline = session ? !session.operatorOnline : true;

  async function request(presetId: SensorConfig["presetId"]) {
    setRequestError(null);
    setLastRequested(presetId);
    const result = await actions.requestConfig(presetId);
    if (!result.ok) setRequestError(result.error.message);
  }

  const statusLine = (() => {
    if (!session) return "Waiting for session…";
    if (state.status === "running") return "Operator is running the evaluation…";
    if (session.requestedConfigVersion !== null && session.requestedConfigVersion !== session.completedConfigVersion) {
      return `Configuration v${session.requestedConfigVersion} queued${operatorOffline ? " (waiting for the operator)" : ""}`;
    }
    if (session.completedConfigVersion !== null) {
      return `Latest completed run used configuration v${session.completedConfigVersion}`;
    }
    return "No run completed yet";
  })();

  return (
    <div className="bs-controller">
      <header className="bs-controller-head bs-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--bs-s2)" }}>
          <span className="bs-wordmark">
            Blind<em>spot</em>
          </span>
          <ModeBadge mode={state.mode} />
        </div>
        <span className="bs-controller-site">{session?.siteName ?? "Unknown session"}</span>
        <span className="bs-controller-session">session {route.sessionId}</span>
        <div style={{ display: "flex", gap: "var(--bs-s2)", flexWrap: "wrap" }}>
          <ConnectionBadge connection={state.connection} />
          <Badge tone={operatorOffline ? "rust" : "teal"}>
            {operatorOffline ? "Operator offline" : "Operator online"}
          </Badge>
        </div>
      </header>

      {expired && state.error ? (
        <ErrorCallout error={state.error} />
      ) : (
        <>
          <section className="bs-controller-presets bs-panel" aria-label="Sensor presets">
            <h2 className="bs-section-title">Choose the next configuration</h2>
            {PRESET_IDS.map((presetId) => (
              <button
                key={presetId}
                type="button"
                className="bs-preset"
                disabled={offline}
                aria-pressed={lastRequested === presetId}
                onClick={() => void request(presetId)}
              >
                <strong>{PRESET_DISPLAY[presetId].label}</strong>
                <span className="bs-meta">{PRESET_DISPLAY[presetId].blurb}</span>
              </button>
            ))}
            {offline ? (
              <p className="bs-meta">You are offline. Reconnect to submit a preset; nothing was sent.</p>
            ) : operatorOffline ? (
              <p className="bs-meta">The operator laptop is offline. Requests queue and run when it returns.</p>
            ) : null}
            {requestError ? (
              <p className="bs-meta" role="alert" style={{ color: "var(--bs-rust)" }}>
                {requestError}
              </p>
            ) : null}
          </section>

          <section className="bs-controller-status bs-panel" aria-label="Session status">
            <h2 className="bs-section-title">Status</h2>
            <p className="bs-support" role="status">
              {statusLine}
            </p>
          </section>

          <section className="bs-controller-gauge bs-panel" aria-label="Latest completed result">
            <h2 className="bs-section-title">Latest completed result</h2>
            {run ? (
              <>
                <p className="bs-meta">
                  {run.config.label} · config v{run.config.version} · completed{" "}
                  {new Date(run.completedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </p>
                <CoverageDial
                  compact
                  coverage={coverageReading(run.coverage)}
                  falseStop={falseStopReading(run.outcome)}
                />
                <div className="bs-metric-values">
                  <div className="bs-metric-line">
                    <span className="bs-metric-key">Coverage</span>
                    <span className="bs-metric-number">{coverageReading(run.coverage).headline}</span>
                  </div>
                  <p className="bs-metric-denominator">{coverageReading(run.coverage).detail}</p>
                  <div className="bs-metric-line">
                    <span className="bs-metric-key">False stops</span>
                    <span className="bs-metric-number">{falseStopReading(run.outcome).headline}</span>
                  </div>
                  <p className="bs-metric-denominator">{falseStopReading(run.outcome).detail}</p>
                </div>
              </>
            ) : (
              <p className="bs-support">Not evaluated. Results appear after the operator completes a run.</p>
            )}
            {state.report ? (
              <button
                type="button"
                className="bs-btn"
                style={{ minHeight: 44 }}
                onClick={() => actions.navigate(`/reports/${state.report!.id}`)}
              >
                Open published report
              </button>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

export default PhoneController;
