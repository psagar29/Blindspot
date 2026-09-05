import { useSyncExternalStore } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CLAIM_BOUNDARY } from "../../shared/contracts";
import { createFixtureBridge, type FixtureBridge } from "../mocks/createFixtureBridge";
import { BlindspotApp } from "./BlindspotApp";

function Host({ bridge }: { bridge: FixtureBridge }) {
  const state = useSyncExternalStore(bridge.subscribe, bridge.getState);
  return <BlindspotApp state={state} actions={bridge.actions} viewport={null} />;
}

describe("BlindspotApp workspace", () => {
  it("renders the claim boundary verbatim near the gauge", async () => {
    const bridge = createFixtureBridge();
    bridge.dev.loadPreset("completed-baseline");
    render(<Host bridge={bridge} />);
    expect(await screen.findByText(CLAIM_BOUNDARY)).toBeInTheDocument();
    bridge.dispose();
  });

  it("shows 'Not evaluated' gauges before any run", async () => {
    const bridge = createFixtureBridge();
    bridge.dev.loadPreset("ready");
    render(<Host bridge={bridge} />);
    const notEvaluated = await screen.findAllByText("Not evaluated");
    expect(notEvaluated.length).toBeGreaterThanOrEqual(2);
    bridge.dispose();
  });

  it("labels a stale gauge as a previous run when a new config is queued", async () => {
    const bridge = createFixtureBridge();
    bridge.dev.loadPreset("queued-from-phone");
    render(<Host bridge={bridge} />);
    expect(await screen.findByText(/Previous run/)).toBeInTheDocument();
    expect(screen.getByText(/Selected: Higher resolution v2/)).toBeInTheDocument();
    bridge.dispose();
  });

  it("shows 'No stop events' rather than a 0% false-stop rate", async () => {
    const bridge = createFixtureBridge();
    bridge.dev.loadPreset("no-stop-events");
    render(<Host bridge={bridge} />);
    expect((await screen.findAllByText("No stop events")).length).toBeGreaterThanOrEqual(1);
    bridge.dispose();
  });

  it("keeps the incomplete run's percentage withheld", async () => {
    const bridge = createFixtureBridge();
    bridge.dev.loadPreset("incomplete-run");
    render(<Host bridge={bridge} />);
    expect(await screen.findByText("Incomplete")).toBeInTheDocument();
    expect(screen.getByText(/withheld/)).toBeInTheDocument();
    bridge.dispose();
  });

  it("preserves the typed sentence when authoring fails", async () => {
    const bridge = createFixtureBridge();
    render(<Host bridge={bridge} />);
    const textarea = await screen.findByLabelText("Describe the inspection");
    fireEvent.change(textarea, { target: { value: "Check the mezzanine lane for cables." } });
    bridge.dev.failNext("authorScenario");
    fireEvent.click(screen.getByRole("button", { name: /Generate world/ }));
    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toHaveTextContent(/fixture failure injection/);
      },
      { timeout: 3000 },
    );
    expect(screen.getByLabelText("Describe the inspection")).toHaveValue(
      "Check the mezzanine lane for cables.",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    bridge.dispose();
  });

  it("shows the fixture banner so sample data is unmistakable", async () => {
    const bridge = createFixtureBridge();
    render(<Host bridge={bridge} />);
    expect(await screen.findByText(/Fixture data: deterministic sample state/)).toBeInTheDocument();
    bridge.dispose();
  });
});

describe("BlindspotApp controller", () => {
  it("offers the three allowlisted presets and reports queueing", async () => {
    const bridge = createFixtureBridge({ initialPath: "/control/sess-fixture-01" });
    bridge.dev.loadPreset("ready");
    render(<Host bridge={bridge} />);
    expect(await screen.findByText("Baseline stereo")).toBeInTheDocument();
    expect(screen.getByText("Higher resolution")).toBeInTheDocument();
    expect(screen.getByText("Permissive threshold")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Higher resolution"));
    await waitFor(() => {
      const statuses = screen.getAllByRole("status").map((el) => el.textContent ?? "");
      expect(statuses.some((text) => /queued/i.test(text))).toBe(true);
    });
    bridge.dispose();
  });

  it("explains an offline operator instead of failing silently", async () => {
    const bridge = createFixtureBridge({ initialPath: "/control/sess-fixture-01" });
    bridge.dev.loadPreset("ready");
    bridge.dev.setOperatorOnline(false);
    render(<Host bridge={bridge} />);
    expect(await screen.findByText("Operator offline")).toBeInTheDocument();
    expect(screen.getByText(/Requests queue and run when it returns/)).toBeInTheDocument();
    bridge.dispose();
  });

  it("shows the expired-token state without preset buttons", async () => {
    const bridge = createFixtureBridge({ initialPath: "/control/sess-fixture-01" });
    bridge.dev.loadPreset("controller-token-expired");
    render(<Host bridge={bridge} />);
    expect(await screen.findByText(/controller link has expired/)).toBeInTheDocument();
    expect(screen.queryByText("Baseline stereo")).not.toBeInTheDocument();
    bridge.dispose();
  });
});

describe("BlindspotApp report", () => {
  it("renders a published report with claim boundary, denominators, and honest nulls", async () => {
    const bridge = createFixtureBridge();
    bridge.dev.loadPreset("published");
    bridge.actions.navigate("/reports/rpt-fixture-0001");
    render(<Host bridge={bridge} />);
    expect(await screen.findByText("Site Blind Spot Report", undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText("Blind spot observed")).toBeInTheDocument();
    expect(screen.getAllByText(CLAIM_BOUNDARY).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/1\/3 detected before the stop boundary/)).toBeInTheDocument();
    // baseline run terminated by collision: completion time must read as not completed
    expect(screen.getByText("Not completed")).toBeInTheDocument();
    expect(screen.getByText("Never detected on the tested trajectory")).toBeInTheDocument();
    expect(screen.getAllByText(/Authored stress test/).length).toBeGreaterThanOrEqual(1);
    bridge.dispose();
  });

  it("shows report-not-found for an unknown id", async () => {
    const bridge = createFixtureBridge({ initialPath: "/reports/rpt-unknown" });
    render(<Host bridge={bridge} />);
    expect(await screen.findByText("Report not found", undefined, { timeout: 3000 })).toBeInTheDocument();
    bridge.dispose();
  });
});
