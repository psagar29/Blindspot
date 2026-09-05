/**
 * Person A's export boundary (docs/CONTRACTS.md):
 *   BlindspotApp(props: RuntimeBridge & { viewport: React.ReactNode })
 * The host (fixture preview today, Person C's composed app later) supplies
 * state/actions from the runtime bridge and a viewport React node. This module
 * imports no Convex hooks, no providers, and none of Person B's engine files.
 */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { RuntimeBridge } from "../../shared/contracts";
import { ModeBanner } from "./components/Badges";

import "@fontsource/manrope/400.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/workspace.css";
import "../styles/controller.css";
import "../styles/report.css";

// Route-level code splitting keeps the phone controller and public report
// bundles free of workspace-only weight (QR encoder, drawer, dial internals).
const Workspace = lazy(() => import("./workspace/Workspace"));
const PhoneController = lazy(() => import("./controller/PhoneController"));
const ReportPage = lazy(() => import("./report/ReportPage"));

function RouteFallback() {
  return (
    <div style={{ padding: "var(--bs-s6)", display: "flex", flexDirection: "column", gap: "var(--bs-s4)" }}>
      <div className="bs-skeleton" style={{ height: 64 }} />
      <div className="bs-skeleton" style={{ height: 360 }} />
      <div className="bs-skeleton" style={{ height: 120 }} />
    </div>
  );
}

function NotFound({ actions }: Pick<RuntimeBridge, "actions">) {
  return (
    <div style={{ padding: "var(--bs-s7)", display: "flex", flexDirection: "column", gap: "var(--bs-s4)", alignItems: "flex-start" }}>
      <h1 style={{ fontSize: "var(--bs-fs-title)" }}>Page not found</h1>
      <p className="bs-support">
        This address is not a workspace, controller, or report route.
      </p>
      <button type="button" className="bs-btn" onClick={() => actions.navigate("/")}>
        Open the workspace
      </button>
    </div>
  );
}

/** Announce queued/completed configuration changes politely; never per-frame. */
function useStatusAnnouncement(state: RuntimeBridge["state"]): string {
  const [message, setMessage] = useState("");
  const key = [
    state.status,
    state.session?.requestedConfigVersion ?? "",
    state.session?.completedConfigVersion ?? "",
  ].join("|");
  const previousKey = useRef(key);
  useEffect(() => {
    if (previousKey.current === key) return;
    previousKey.current = key;
    if (state.status === "queued" && state.session?.requestedConfigVersion != null) {
      setMessage(`Configuration version ${state.session.requestedConfigVersion} queued.`);
    } else if (state.status === "running") {
      setMessage("Evaluation running.");
    } else if (state.status === "ready" && state.session?.completedConfigVersion != null) {
      setMessage(`Run completed for configuration version ${state.session.completedConfigVersion}.`);
    } else if (state.status === "published") {
      setMessage("Report published.");
    } else if (state.status === "error" && state.error) {
      setMessage(`Error: ${state.error.message}`);
    }
  }, [key, state]);
  return message;
}

export function BlindspotApp(props: RuntimeBridge & { viewport: React.ReactNode }) {
  const { state, actions, viewport } = props;
  const announcement = useStatusAnnouncement(state);

  let page: React.ReactNode;
  switch (state.route.kind) {
    case "workspace":
      page = <Workspace state={state} actions={actions} viewport={viewport} />;
      break;
    case "controller":
      page = <PhoneController state={state} actions={actions} route={state.route} />;
      break;
    case "report":
      page = <ReportPage state={state} />;
      break;
    case "not_found":
      page = <NotFound actions={actions} />;
      break;
  }

  return (
    <>
      <ModeBanner mode={state.mode} />
      <div className="bs-visually-hidden" aria-live="polite" role="status">
        {announcement}
      </div>
      <Suspense fallback={<RouteFallback />}>{page}</Suspense>
    </>
  );
}

export default BlindspotApp;
