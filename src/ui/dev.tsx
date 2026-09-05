import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// A0 bootstrap placeholder. The full fixture preview (createFixtureBridge +
// BlindspotApp) replaces this in the next Person A commits.
function BootstrapNotice() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "48px" }}>
      <h1>Blindspot UI preview</h1>
      <p>A0 bootstrap is in place. Fixture-mode workspace lands next.</p>
    </main>
  );
}

const container = document.getElementById("root");
if (!container) throw new Error("ui.html is missing #root");
createRoot(container).render(
  <StrictMode>
    <BootstrapNotice />
  </StrictMode>,
);
