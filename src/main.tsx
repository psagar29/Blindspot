import { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BlindspotViewport, RuntimeRoot, useBlindspot } from "./runtime";
import { BlindspotApp } from "./ui/BlindspotApp";

function ComposedApp() {
  const bridge = useBlindspot();
  const viewport =
    bridge.state.route.kind === "workspace" ? (
      <Suspense fallback={<div role="status">Loading the calibrated 3D scene…</div>}>
        <BlindspotViewport />
      </Suspense>
    ) : null;

  return <BlindspotApp {...bridge} viewport={viewport} />;
}

const root = document.getElementById("root");
if (!root) throw new Error("Blindspot root element is missing.");

createRoot(root).render(
  <RuntimeRoot>
    <ComposedApp />
  </RuntimeRoot>,
);
