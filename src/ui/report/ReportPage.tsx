import type { HazardFinding, HazardInstance, ReportSnapshot, RuntimeBridge } from "../../../shared/contracts";
import { fmtDeg, fmtDims, fmtIsoTime, fmtMeters, fmtPercent, fmtSeconds, shortSha } from "../format";
import { Badge, ModeBadge } from "../components/Badges";
import { coverageReading, falseStopReading, FINDING_STATUS_LABEL, REPORT_STATUS_LABEL, TERMINATION_LABEL } from "../metrics";

function Kv({ k, children, mono }: { k: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="bs-kv">
      <dt>{k}</dt>
      <dd className={mono ? "bs-mono" : undefined}>{children}</dd>
    </div>
  );
}

function statusTone(status: ReportSnapshot["status"]): "rust" | "amber" | "neutral" {
  if (status === "blind_spot_observed") return "rust";
  if (status === "incomplete") return "amber";
  return "neutral";
}

function findingTone(status: HazardFinding["status"]): "rust" | "amber" | "teal" | "neutral" {
  if (status === "missed" || status === "late") return "rust";
  if (status === "unknown") return "amber";
  if (status === "detected_in_time") return "teal";
  return "neutral";
}

function DetectionValue({ finding }: { finding: HazardFinding }) {
  if (finding.firstDetectionRangeM !== null) return <>{fmtMeters(finding.firstDetectionRangeM)}</>;
  if (finding.status === "missed") return <>Never detected on the tested trajectory</>;
  return <>Not evaluated</>;
}

function FindingCard({ finding, hazard }: { finding: HazardFinding; hazard: HazardInstance | undefined }) {
  return (
    <article className="bs-finding">
      <div className="bs-finding-head">
        <span className="bs-finding-name">{hazard?.libraryItem.name ?? finding.hazardId}</span>
        <Badge tone={findingTone(finding.status)}>{FINDING_STATUS_LABEL[finding.status]}</Badge>
      </div>
      {hazard ? (
        <div style={{ display: "flex", gap: "var(--bs-s2)", flexWrap: "wrap" }}>
          <Badge tone={hazard.observedInPhoto ? "teal" : "amber"}>
            {hazard.observedInPhoto ? "Seen in source photo" : "Authored stress test"}
          </Badge>
          <span className="bs-meta">
            {hazard.geometry.kind === "cable"
              ? `cable ⌀ ${(hazard.geometry.diameterM * 1000).toFixed(0)} mm`
              : `box ${fmtDims(hazard.geometry.dimensionsM)}`}
            {" · "}
            {hazard.libraryItem.materialClass.replace("_", " ")} · dimensions {hazard.libraryItem.dimensionEvidence.replace("_", " ")}
          </span>
        </div>
      ) : null}
      {hazard ? <p className="bs-meta">{hazard.justification}</p> : null}
      <div className="bs-finding-grid">
        <div className="bs-finding-cell">
          <span className="bs-meta">First detection (route clearance)</span>
          <span className="bs-mono">
            <DetectionValue finding={finding} />
          </span>
        </div>
        <div className="bs-finding-cell">
          <span className="bs-meta">First detection (camera depth)</span>
          <span className="bs-mono">
            {finding.firstDetectionAxialDepthM !== null ? fmtMeters(finding.firstDetectionAxialDepthM) : "Not evaluated"}
          </span>
        </div>
        <div className="bs-finding-cell">
          <span className="bs-meta">Theoretical threshold (camera depth)</span>
          <span className="bs-mono">
            {finding.theoreticalThresholdRangeM !== null ? fmtMeters(finding.theoreticalThresholdRangeM) : "Not evaluated"}
          </span>
        </div>
        <div className="bs-finding-cell">
          <span className="bs-meta">Required stopping distance</span>
          <span className="bs-mono">
            {finding.requiredStoppingDistanceM !== null ? fmtMeters(finding.requiredStoppingDistanceM) : "Not evaluated"}
          </span>
        </div>
      </div>
      <p className="bs-finding-reason">{finding.reason}</p>
      <p className="bs-meta">Sampling: {finding.sampleMethod.replace(/_/g, " ")}</p>
    </article>
  );
}

function ReportBody({ report, mode }: { report: ReportSnapshot; mode: RuntimeBridge["state"]["mode"] }) {
  const { scenario, run } = report;
  const world = scenario.world;
  const calibration = world.calibration;
  const config = run.config;
  const sensor = config.sensors[0];
  const coverage = coverageReading(run.coverage);
  const falseStops = falseStopReading(run.outcome);
  const hazardsById = new Map(scenario.hazards.map((h) => [h.id, h]));

  return (
    <div className="bs-report">
      <header className="bs-report-header">
        <div className="bs-report-status-row">
          <span className="bs-wordmark">
            Blind<em>spot</em>
          </span>
          <ModeBadge mode={mode} />
          <span className="bs-topbar-spacer" />
          <span className="bs-meta bs-mono">{report.id}</span>
        </div>
        <h1 className="bs-report-title">{report.title}</h1>
        <div className="bs-report-status-row">
          <Badge tone={statusTone(report.status)}>{REPORT_STATUS_LABEL[report.status]}</Badge>
          <span className="bs-meta">Published {fmtIsoTime(report.publishedAt)}</span>
          <span className="bs-meta">Contract v{report.contractVersion}</span>
        </div>
        <p className="bs-report-claim">{report.claimBoundary}</p>
        <div className="bs-report-actions">
          <button type="button" className="bs-btn" onClick={() => window.print()}>
            Print report
          </button>
        </div>
      </header>

      <section aria-label="Site and world">
        <h2>Site and world</h2>
        <div className="bs-report-photo">
          <img src={world.sourcePhotoUrl} alt={`Source photo for ${world.name}`} />
        </div>
        <dl>
          <Kv k="World">{world.name} (v{world.version})</Kv>
          <Kv k="Appearance asset" mono>
            {world.splat.source} · {shortSha(world.splat.sha256)} · {fmtIsoTime(world.splat.createdAt)}
          </Kv>
          <Kv k="Collider asset" mono>
            {world.collider.source} · {shortSha(world.collider.sha256)}
          </Kv>
          <Kv k="Preparation">
            {world.preparationMs !== null ? fmtSeconds(world.preparationMs) : "Not recorded"}
            {world.cached ? " (cached before this session)" : ""}
          </Kv>
          <Kv k="Scale source">
            {calibration.source.replace(/_/g, " ")} · {calibration.status}
            {calibration.reference
              ? ` · reference "${calibration.reference.label}" ${calibration.reference.lengthM.toFixed(2)} m (${calibration.reference.evidence.replace("_", " ")})`
              : " · no reference"}
          </Kv>
          <Kv k="Scale correction" mono>
            ×{calibration.correctionFactor.toFixed(3)}
          </Kv>
          <Kv k="Scale uncertainty">{calibration.uncertaintyNote}</Kv>
        </dl>
      </section>

      <section aria-label="Scenario">
        <h2>Scenario</h2>
        <dl>
          <Kv k="Instruction">
            “{scenario.sentence}”{" "}
            <Badge tone={scenario.authoring === "model" ? "teal" : "neutral"}>
              {scenario.authoring === "model" ? "Model authored" : "Preset parser"}
            </Badge>
          </Kv>
          <Kv k="Platform" mono>
            {scenario.platform.mode} · r {scenario.platform.radiusM.toFixed(2)} m · h {scenario.platform.heightM.toFixed(2)} m ·{" "}
            {scenario.platform.speedMps.toFixed(1)} m/s · brake {scenario.platform.brakingDecelerationMps2.toFixed(1)} m/s² · latency{" "}
            {scenario.platform.controlLatencyS.toFixed(2)} s · margin {scenario.platform.clearanceMarginM.toFixed(2)} m
          </Kv>
          <Kv k="Route" mono>
            {scenario.route.length} waypoints · seed {scenario.seed} · scenario v{scenario.version}
          </Kv>
          {scenario.platform.visualAsset ? (
            <Kv k="Robot visual">
              {scenario.platform.visualAsset.source} asset{" "}
              <span className="bs-mono">{shortSha(scenario.platform.visualAsset.sha256)}</span> · decorative only;
              the physical envelope is the platform geometry above
            </Kv>
          ) : null}
        </dl>
        <ul className="bs-report-limitations">
          {scenario.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </section>

      <section aria-label="Sensor configuration">
        <h2>Sensor configuration</h2>
        <dl>
          <Kv k="Preset">
            {config.label} · v{config.version}
          </Kv>
          <Kv k="Perception model" mono>
            {config.modelVersion}
          </Kv>
          {sensor ? (
            <>
              <Kv k="Stereo raster" mono>
                {sensor.widthPx} × {sensor.heightPx} px · h-fov {fmtDeg(sensor.horizontalFovRad)}
              </Kv>
              <Kv k="Working range" mono>
                {sensor.nearM.toFixed(1)} – {sensor.farM.toFixed(1)} m · min target {sensor.minResolvableWidthPx.toFixed(0)} px ·
                dropout {sensor.textureDropoutEnabled ? "on" : "off"}
              </Kv>
            </>
          ) : null}
        </dl>
        <ul className="bs-report-limitations">
          {config.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </section>

      <section aria-label="Metrics">
        <h2>Metrics</h2>
        <dl>
          <Kv k="Hazard coverage">
            <strong>{coverage.headline}</strong> · {coverage.detail} · pass: {run.coverage.pass.replace(/_/g, " ")}
          </Kv>
          <Kv k="False stops">
            <strong>{falseStops.headline}</strong> · {falseStops.detail} · pass: {run.outcome.pass}
          </Kv>
          <Kv k="Collisions" mono>
            {run.outcome.collisions ?? "Not evaluated"}
          </Kv>
          <Kv k="Near misses" mono>
            {run.outcome.nearMisses ?? "Not evaluated"}
          </Kv>
          <Kv k="Route completion" mono>
            {run.outcome.routeCompletionPercent !== null ? fmtPercent(run.outcome.routeCompletionPercent, 0) : "Not evaluated"}
          </Kv>
          <Kv k="Completion time" mono>
            {run.outcome.completionTimeMs !== null ? fmtSeconds(run.outcome.completionTimeMs) : "Not completed"}
          </Kv>
          <Kv k="Termination">{TERMINATION_LABEL[run.outcome.termination]}</Kv>
          <Kv k="Run" mono>
            {run.id} · seed {run.seed} · engine {run.engineVersion} · {run.execution.replace(/_/g, " ")} · completed{" "}
            {fmtIsoTime(run.completedAt)}
          </Kv>
        </dl>
      </section>

      <section aria-label="Hazard findings">
        <h2>Hazard findings ({run.findings.length})</h2>
        {run.findings.map((finding) => (
          <FindingCard key={finding.hazardId} finding={finding} hazard={hazardsById.get(finding.hazardId)} />
        ))}
      </section>

      <section aria-label="Scene evidence">
        <h2>Scene evidence</h2>
        {report.evidenceImageUrls.length > 0 ? (
          <div style={{ display: "flex", gap: "var(--bs-s3)", flexWrap: "wrap" }}>
            {report.evidenceImageUrls.map((url, index) => (
              <div className="bs-report-photo" style={{ maxWidth: 260 }} key={url}>
                <img src={url} alt={`Scene capture ${index + 1}`} />
              </div>
            ))}
          </div>
        ) : (
          <p className="bs-support">No scene captures were attached to this run.</p>
        )}
      </section>

      <section aria-label="Limitations">
        <h2>Limitations</h2>
        <ul className="bs-report-limitations">
          {report.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </section>

      <footer className="bs-report-footer">
        <span>{report.claimBoundary}</span>
        <span className="bs-mono">
          report {report.id} · scenario {scenario.id} v{scenario.version} · world {world.id} v{world.version} · config v
          {config.version}
        </span>
      </footer>
    </div>
  );
}

export function ReportPage({ state }: Pick<RuntimeBridge, "state">) {
  if (state.reportLoading) {
    return (
      <div className="bs-report-root">
        <div className="bs-report" aria-busy="true" aria-label="Loading report">
          <div className="bs-skeleton" style={{ height: 160 }} />
          <div className="bs-skeleton" style={{ height: 320 }} />
          <div className="bs-skeleton" style={{ height: 240 }} />
        </div>
      </div>
    );
  }
  if (!state.report) {
    return (
      <div className="bs-report-root">
        <div className="bs-report">
          <header className="bs-report-header">
            <h1 className="bs-report-title">Report not found</h1>
            <p className="bs-support">
              No published report exists at this address. Reports are immutable snapshots; if you followed a shared
              link, ask the operator to confirm the URL.
            </p>
          </header>
        </div>
      </div>
    );
  }
  return (
    <div className="bs-report-root">
      <ReportBody report={state.report} mode={state.mode} />
    </div>
  );
}

export default ReportPage;
