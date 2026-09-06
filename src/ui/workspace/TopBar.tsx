import type { RuntimeBridge } from "../../../shared/contracts";
import { ConnectionBadge, ModeBadge } from "../components/Badges";

export function TopBar(
  props: RuntimeBridge & {
    onToggleRail: () => void;
    onToggleDrawer: () => void;
    drawerOpen: boolean;
  },
) {
  const { state, actions, onToggleRail, onToggleDrawer, drawerOpen } = props;
  const publishDisabled =
    !state.capabilities.publish ||
    !state.latestRun ||
    state.status === "publishing" ||
    state.status === "running";

  return (
    <header className="bs-topbar">
      <button
        type="button"
        className="bs-btn bs-rail-toggle"
        onClick={onToggleRail}
        aria-label="Toggle scenario rail"
      >
        ☰
      </button>
      <span className="bs-wordmark">
        Blind<em>spot</em>
      </span>
      <span className="bs-topbar-site" title={state.session?.siteName}>
        {state.session ? state.session.siteName : state.mode === "recording" && state.world ? state.world.name : "No session"}
      </span>
      <span className="bs-topbar-mode">
        <ModeBadge mode={state.mode} />
      </span>
      <span className="bs-topbar-spacer" />
      <span className="bs-topbar-connection">
        <ConnectionBadge connection={state.connection} />
      </span>
      <button
        type="button"
        className="bs-btn"
        onClick={onToggleDrawer}
        aria-expanded={drawerOpen}
        aria-controls="bs-sensor-drawer"
      >
        Sensors
      </button>
      {state.reportUrl ? (
        <a className="bs-btn bs-btn--primary" href={state.reportUrl} aria-label="Open published report">
          <span className="bs-action-full">View report</span>
          <span className="bs-action-short" aria-hidden="true">Report</span>
        </a>
      ) : (
        <button
          type="button"
          className="bs-btn bs-btn--primary"
          disabled={publishDisabled}
          title={
            publishDisabled
              ? state.capabilities.publish
                ? "Publishing needs a completed run."
                : "Publishing requires the operator session."
              : "Publish an immutable Site Blind Spot Report"
          }
          onClick={() => void actions.publishReport()}
          aria-label="Publish report"
        >
          {state.status === "publishing" ? (
            "Publishing…"
          ) : (
            <>
              <span className="bs-action-full">Publish report</span>
              <span className="bs-action-short" aria-hidden="true">Publish</span>
            </>
          )}
        </button>
      )}
    </header>
  );
}
