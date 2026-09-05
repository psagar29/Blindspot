import { describe, expect, it } from "vitest";
import type { CoverageMetrics, OutcomeMetrics } from "../../shared/contracts";
import { fixtureConfigs, fixtureRuns } from "../mocks/fixtureData";
import { coverageReading, falseStopReading, isPreviousRun } from "./metrics";

function coverage(partial: Partial<CoverageMetrics>): CoverageMetrics {
  return {
    pass: "diagnostic_full_route",
    eligibleEncounters: 3,
    detectedBeforeBoundary: 1,
    missedOrLate: 2,
    unknown: 0,
    excluded: 0,
    percent: 100 / 3,
    ...partial,
  };
}

function outcome(partial: Partial<OutcomeMetrics>): OutcomeMetrics {
  return {
    pass: "reactive",
    collisions: 0,
    nearMisses: 0,
    stopEvents: 2,
    falseStopEvents: 0,
    falseStopPercent: 0,
    routeCompletionPercent: 100,
    completionTimeMs: 10_000,
    termination: "completed",
    ...partial,
  };
}

describe("coverageReading", () => {
  it("shows the percentage with its denominator", () => {
    const reading = coverageReading(coverage({}));
    expect(reading.headline).toBe("33.3%");
    expect(reading.detail).toContain("1/3 detected before the stop boundary");
    expect(reading.value).toBeCloseTo(33.33, 1);
  });

  it("withholds the percentage while any encounter is unknown", () => {
    const reading = coverageReading(coverage({ unknown: 1, percent: null }));
    expect(reading.headline).toBe("Incomplete");
    expect(reading.value).toBeNull();
    expect(reading.detail).toContain("1 unknown");
    expect(reading.detail).toContain("withheld");
  });

  it("says no eligible encounters instead of inventing 0%", () => {
    const reading = coverageReading(
      coverage({ eligibleEncounters: 0, detectedBeforeBoundary: 0, missedOrLate: 0, percent: null }),
    );
    expect(reading.headline).toBe("No eligible encounters");
    expect(reading.value).toBeNull();
  });

  it("reads not evaluated before any run", () => {
    expect(coverageReading(null).headline).toBe("Not evaluated");
  });
});

describe("falseStopReading", () => {
  it("shows 0/0 stop events as 'No stop events', never 0%", () => {
    const reading = falseStopReading(outcome({ stopEvents: 0, falseStopEvents: 0, falseStopPercent: null }));
    expect(reading.headline).toBe("No stop events");
    expect(reading.value).toBeNull();
  });

  it("shows a real rate with its denominator", () => {
    const reading = falseStopReading(outcome({ stopEvents: 5, falseStopEvents: 2, falseStopPercent: 40 }));
    expect(reading.headline).toBe("40.0%");
    expect(reading.detail).toBe("2/5 stops were false");
    expect(reading.value).toBe(40);
  });

  it("treats a skipped reactive pass as not evaluated", () => {
    const reading = falseStopReading(
      outcome({ pass: "not_evaluated", stopEvents: null, falseStopEvents: null, falseStopPercent: null }),
    );
    expect(reading.headline).toBe("Not evaluated");
  });
});

describe("isPreviousRun", () => {
  it("is false when the completed run matches the selected config", () => {
    const run = fixtureRuns.baseline;
    expect(isPreviousRun(run, run.config)).toBe(false);
  });

  it("is true when the selected config moved past the completed run", () => {
    const run = fixtureRuns.baseline;
    expect(isPreviousRun(run, { ...fixtureConfigs.higher_resolution, version: run.config.version + 1 })).toBe(true);
  });

  it("is false with no completed run", () => {
    expect(isPreviousRun(null, fixtureConfigs.baseline)).toBe(false);
  });
});
