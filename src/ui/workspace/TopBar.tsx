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
        {state.session ? state.session.siteName : "No session"}
      </span>
      <ModeBadge mode={state.mode} />
      <span className="bs-topbar-spacer" />
      <ConnectionBadge connection={state.connection} />
      <button
        type="button"
        className="bs-btn"
        onClick={onToggleDrawer}
        aria-expanded={drawerOpen}
        aria-controls="bs-sensor-drawer"
      >
        Sensors
      </button>
      {state.status === "published" && state.report ? (
        <button
          type="button"
          className="bs-btn bs-btn--primary"
          onClick={() => actions.navigate(`/reports/${state.report!.id}`)}
        >
          View report
        </button>
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
        >
          {state.status === "publishing" ? "Publishing…" : "Publish report"}
        </button>
      )}
    </header>
  );
}
