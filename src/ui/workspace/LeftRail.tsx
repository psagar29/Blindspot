import { useId, useState } from "react";
import type { RuntimeBridge } from "../../../shared/contracts";
import { fmtDims, fmtSeconds } from "../format";
import { Badge } from "../components/Badges";
import { ErrorCallout, InfoCallout } from "../components/Callout";

function SourcePhoto({ state }: Pick<RuntimeBridge, "state">) {
  const world = state.world;
  if (!world) return null;
  return (
    <section aria-label="Source image and world status">
      <div className="bs-source-photo">
        <img src={world.sourcePhotoUrl} alt={`Source image for ${world.name}`} />
        {state.mode === "fixture" ? (
          <span className="bs-source-photo-tag">
            <Badge tone="amber">Fixture</Badge>
          </span>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: "var(--bs-s2)", flexWrap: "wrap", marginTop: "var(--bs-s2)" }}>
        <span className="bs-support" style={{ fontWeight: 700, color: "var(--bs-text)" }}>
          {world.name}
        </span>
        {world.cached ? <Badge>Cached world</Badge> : null}
        {world.preparationMs !== null ? (
          <span className="bs-meta bs-mono">prepared in {fmtSeconds(world.preparationMs)}</span>
        ) : null}
      </div>
      <p className="bs-meta" style={{ marginTop: "var(--bs-s1)" }}>
        Scale: {world.calibration.status === "verified" ? "verified" : "unverified"}
        {world.calibration.reference
          ? `, ref "${world.calibration.reference.label}" ${world.calibration.reference.lengthM.toFixed(2)} m (${world.calibration.reference.evidence.replace("_", " ")})`
          : ", no reference yet"}
      </p>
    </section>
  );
}

function AuthoringComposer({ state, actions }: RuntimeBridge) {
  const [sentence, setSentence] = useState("");
  const [photo, setPhoto] = useState<File | undefined>(undefined);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputId = useId();
  const fileId = useId();

  const busy = state.status === "uploading" || state.status === "generating";
  const disabled = !state.capabilities.authoring || busy;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLocalError(null);
    const result = await actions.authorScenario({ sentence, photo, worldId: state.world?.id });
    if (!result.ok) setLocalError(result.error.message);
  }

  return (
    <section aria-label="Scenario authoring">
      <h2 className="bs-section-title">Scenario</h2>
      {state.scenario ? (
        <>
          <p className="bs-support" style={{ marginTop: "var(--bs-s2)" }}>
            “{state.scenario.sentence}”{" "}
            <Badge tone={state.scenario.authoring === "model" ? "teal" : "neutral"}>
              {state.scenario.authoring === "model" ? "Model authored" : "Preset parser"}
            </Badge>
          </p>
          {state.scenario.platform.visualAsset?.source === "mint" ? (
            <p className="bs-meta" style={{ marginTop: "var(--bs-s1)" }}>
              Robot body: Mint-generated 3D asset (decorative; physical envelope is the platform geometry).
            </p>
          ) : null}
        </>
      ) : null}
      {!state.capabilities.authoring ? (
        <InfoCallout title="Read-only session">
          {state.capabilities.authoringReason ?? "Authoring requires the operator workstation."}
        </InfoCallout>
      ) : (
        <form onSubmit={(e) => void submit(e)} style={{ display: "flex", flexDirection: "column", gap: "var(--bs-s3)", marginTop: "var(--bs-s2)" }}>
          <div className="bs-field">
            <label htmlFor={inputId}>Describe the inspection</label>
            <textarea
              id={inputId}
              className="bs-textarea"
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              placeholder="e.g. Check the intake lane for low cables before the night shift."
              disabled={disabled}
              rows={3}
            />
          </div>
          <div className="bs-field">
            <label htmlFor={fileId}>Site photo (optional)</label>
            <input
              id={fileId}
              className="bs-input"
              type="file"
              accept="image/*"
              disabled={disabled}
              onChange={(e) => setPhoto(e.target.files?.[0])}
            />
          </div>
          <div>
            <button type="submit" className="bs-btn bs-btn--primary" disabled={disabled || sentence.trim().length === 0}>
              {busy ? "Working…" : state.world ? "Author scenario" : "Generate world"}
            </button>
          </div>
          {busy ? (
            <p className="bs-meta" role="status">
              {state.stageLabel ?? "Working…"}
              {state.elapsedMs !== null ? ` · ${fmtSeconds(state.elapsedMs)} elapsed` : ""}
            </p>
          ) : null}
          {localError ? <p className="bs-meta" style={{ color: "var(--bs-rust)" }}>{localError}</p> : null}
        </form>
      )}
      {state.status === "error" && state.error ? (
        <ErrorCallout error={state.error} onRetry={() => void actions.retry()} />
      ) : null}
    </section>
  );
}

function CalibrationCard({ state, actions }: RuntimeBridge) {
  const world = state.world;
  const [label, setLabel] = useState("Marked floor lane width");
  const [lengthM, setLengthM] = useState("2.40");
  const [evidence, setEvidence] = useState<"operator_measured" | "assumed">("operator_measured");
  const [correction, setCorrection] = useState("1.00");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const labelId = useId();
  const lenId = useId();
  const evId = useId();
  const corrId = useId();

  if (!world || world.calibration.status !== "unverified") return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await actions.confirmCalibration({
      worldId: world!.id,
      referenceLabel: label,
      referenceLengthM: Number(lengthM),
      evidence,
      correctionFactor: Number(correction),
    });
    setSubmitting(false);
    if (!result.ok) setError(result.error.message);
  }

  return (
    <section className="bs-well" style={{ padding: "var(--bs-s3)" }} aria-label="Scale calibration">
      <h2 className="bs-section-title">Confirm scale</h2>
      <p className="bs-meta" style={{ margin: "var(--bs-s2) 0" }}>
        {world.calibration.uncertaintyNote}
      </p>
      <form onSubmit={(e) => void submit(e)} style={{ display: "flex", flexDirection: "column", gap: "var(--bs-s3)" }}>
        <div className="bs-field">
          <label htmlFor={labelId}>Reference object</label>
          <input id={labelId} className="bs-input" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--bs-s3)" }}>
          <div className="bs-field">
            <label htmlFor={lenId}>Length (m)</label>
            <input
              id={lenId}
              className="bs-input bs-mono"
              inputMode="decimal"
              value={lengthM}
              onChange={(e) => setLengthM(e.target.value)}
            />
          </div>
          <div className="bs-field">
            <label htmlFor={corrId}>Correction ×</label>
            <input
              id={corrId}
              className="bs-input bs-mono"
              inputMode="decimal"
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
            />
          </div>
        </div>
        <div className="bs-field">
          <label htmlFor={evId}>Evidence</label>
          <select
            id={evId}
            className="bs-select"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value as "operator_measured" | "assumed")}
          >
            <option value="operator_measured">Operator measured</option>
            <option value="assumed">Assumed (estimate only)</option>
          </select>
        </div>
        {evidence === "assumed" ? (
          <p className="bs-meta" style={{ color: "var(--bs-amber)" }}>
            An assumed reference keeps the scale estimated. The report will say so.
          </p>
        ) : null}
        <div>
          <button type="submit" className="bs-btn bs-btn--primary" disabled={submitting}>
            {submitting ? "Confirming…" : "Confirm calibration"}
          </button>
        </div>
        {error ? <p className="bs-meta" style={{ color: "var(--bs-rust)" }}>{error}</p> : null}
      </form>
    </section>
  );
}

function HazardList({ state }: Pick<RuntimeBridge, "state">) {
  const hazards = state.scenario?.hazards ?? [];
  if (hazards.length === 0) return null;
  return (
    <section aria-label="Hazard library">
      <h2 className="bs-section-title">Hazards ({hazards.length})</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--bs-s2)", marginTop: "var(--bs-s2)" }}>
        {hazards.map((hazard) => (
          <article key={hazard.id} className="bs-hazard-row">
            <div className="bs-hazard-row-head">
              <span className="bs-hazard-name">{hazard.libraryItem.name}</span>
              <span className="bs-hazard-dims bs-mono">
                {hazard.geometry.kind === "cable"
                  ? `⌀ ${(hazard.geometry.diameterM * 1000).toFixed(0)} mm`
                  : fmtDims(hazard.geometry.dimensionsM)}
              </span>
            </div>
            <div style={{ display: "flex", gap: "var(--bs-s2)", flexWrap: "wrap" }}>
              <Badge tone={hazard.observedInPhoto ? "teal" : "amber"}>
                {hazard.observedInPhoto ? "Seen in photo" : "Authored stress test"}
              </Badge>
              <span className="bs-meta">{hazard.libraryItem.dimensionEvidence.replace("_", " ")}</span>
            </div>
            <p className="bs-hazard-reason">{hazard.justification}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function LeftRail(props: RuntimeBridge & { open: boolean }) {
  const { open, ...bridge } = props;
  return (
    <aside className={`bs-rail bs-panel${open ? " bs-rail--open" : ""}`} aria-label="Scenario rail">
      <SourcePhoto state={bridge.state} />
      <AuthoringComposer {...bridge} />
      <CalibrationCard {...bridge} />
      <HazardList state={bridge.state} />
    </aside>
  );
}
