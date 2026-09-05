/** Presentation logic for run metrics. Pure functions so the honesty rules
 * (denominators, null handling, no invented percentages) are unit-testable. */
import type { CompletedRun, CoverageMetrics, OutcomeMetrics, SensorConfig } from "../../shared/contracts";
import { fmtPercent } from "./format";

export interface GaugeReading {
  /** 0..100 needle position, or null to hide the needle. */
  value: number | null;
  /** Headline text, e.g. "33.3%" or "Not evaluated". */
  headline: string;
  /** Denominator/context line. Always present, never a bare percentage. */
  detail: string;
}

export function coverageReading(coverage: CoverageMetrics | null): GaugeReading {
  if (!coverage) {
    return { value: null, headline: "Not evaluated", detail: "No completed run yet." };
  }
  const { eligibleEncounters, detectedBeforeBoundary, missedOrLate, unknown, excluded, percent } = coverage;
  const base = `${detectedBeforeBoundary}/${eligibleEncounters} detected before the stop boundary`;
  const extras: string[] = [`${missedOrLate} missed or late`];
  if (unknown > 0) extras.push(`${unknown} unknown`);
  if (excluded > 0) extras.push(`${excluded} excluded off-route`);
  const detail = `${base} (${extras.join(", ")})`;
  if (percent === null) {
    if (eligibleEncounters === 0) {
      return { value: null, headline: "No eligible encounters", detail: "Nothing on the tested route to score." };
    }
    return {
      value: null,
      headline: "Incomplete",
      detail: `${detail}. Percentage withheld while any encounter is unknown.`,
    };
  }
  return { value: percent, headline: fmtPercent(percent), detail };
}

export function falseStopReading(outcome: OutcomeMetrics | null): GaugeReading {
  if (!outcome || outcome.pass === "not_evaluated") {
    return { value: null, headline: "Not evaluated", detail: "Reactive pass did not run." };
  }
  const { stopEvents, falseStopEvents, falseStopPercent } = outcome;
  if (stopEvents === null || falseStopEvents === null) {
    return { value: null, headline: "Not evaluated", detail: "Stop events were not recorded." };
  }
  if (stopEvents === 0) {
    return { value: null, headline: "No stop events", detail: "The platform never stopped on this run." };
  }
  if (falseStopPercent === null) {
    return { value: null, headline: "Not evaluated", detail: `${falseStopEvents}/${stopEvents} stops were false.` };
  }
  return {
    value: falseStopPercent,
    headline: fmtPercent(falseStopPercent),
    detail: `${falseStopEvents}/${stopEvents} stops were false`,
  };
}

/** True when the latest completed run does not belong to the currently selected config. */
export function isPreviousRun(run: CompletedRun | null, selected: SensorConfig | null): boolean {
  if (!run || !selected) return false;
  return run.config.version !== selected.version || run.config.presetId !== selected.presetId;
}

export const REPORT_STATUS_LABEL = {
  blind_spot_observed: "Blind spot observed",
  no_failure_observed: "No failure observed in this run",
  incomplete: "Incomplete",
} as const;

export const FINDING_STATUS_LABEL = {
  detected_in_time: "Detected in time",
  late: "Detected late",
  missed: "Missed",
  unknown: "Unknown (not evaluated)",
  excluded: "Excluded (off route)",
} as const;

export const TERMINATION_LABEL = {
  completed: "Route completed",
  collision: "Terminated by collision",
  stopped: "Stopped before completion",
  timeout: "Timed out before completion",
  not_evaluated: "Not evaluated",
} as const;
