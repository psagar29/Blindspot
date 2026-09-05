import { CLAIM_BOUNDARY, type RuntimeBridge } from "../../../shared/contracts";
import { CoverageDial } from "../components/CoverageDial";
import { coverageReading, falseStopReading, isPreviousRun } from "../metrics";
import { Badge } from "../components/Badges";

/** Shared two-needle dial plus textual values with denominators. Never an
 * overall safety score; the claim boundary sits directly beneath. */
export function MetricsPanel({ state }: Pick<RuntimeBridge, "state">) {
  const run = state.latestRun;
  const coverage = coverageReading(run?.coverage ?? null);
  const falseStops = falseStopReading(run?.outcome ?? null);
  const stale = isPreviousRun(run, state.config);
  const queued = state.session?.requestedConfigVersion ?? null;

  return (
    <section className="bs-metrics bs-panel" aria-label="Run metrics">
      <CoverageDial coverage={coverage} falseStop={falseStops} />
      <div className="bs-metric-values">
        {run && stale ? (
          <div style={{ display: "flex", gap: "var(--bs-s2)", flexWrap: "wrap" }}>
            <Badge tone="amber">
              Previous run · {run.config.label} v{run.config.version}
            </Badge>
            {state.config ? (
              <span className="bs-meta">
                Selected: {state.config.label} v{state.config.version}
                {queued === state.config.version ? " (queued, not yet run)" : " (not yet run)"}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="bs-metric-line">
          <span className="bs-metric-key">
            <svg className="bs-needle-swatch" viewBox="0 0 14 14" aria-hidden="true">
              <polygon points="2,13 12,13 7,1" fill="var(--bs-teal)" />
            </svg>
            Hazard coverage
          </span>
          <span className="bs-metric-number">{coverage.headline}</span>
          <span className="bs-metric-denominator">{coverage.detail}</span>
        </div>
        <div className="bs-metric-line">
          <span className="bs-metric-key">
            <svg className="bs-needle-swatch" viewBox="0 0 14 14" aria-hidden="true">
              <line x1="7" y1="13" x2="7" y2="6" stroke="var(--bs-rust)" strokeWidth="2.5" />
              <circle cx="7" cy="4" r="3" fill="none" stroke="var(--bs-rust)" strokeWidth="2.5" />
            </svg>
            False stops
          </span>
          <span className="bs-metric-number">{falseStops.headline}</span>
          <span className="bs-metric-denominator">{falseStops.detail}</span>
        </div>
        {run ? (
          <p className="bs-meta">
            Coverage from the {run.coverage.pass.replace(/_/g, " ")} pass ·{" "}
            {run.outcome.pass === "not_evaluated"
              ? "reactive outcome not evaluated"
              : `outcome from the ${run.outcome.pass} pass`}
            {" · seed "}
            {run.seed} · engine {run.engineVersion}
          </p>
        ) : null}
        <p className="bs-claim-boundary">{CLAIM_BOUNDARY}</p>
      </div>
    </section>
  );
}
