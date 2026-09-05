import { useState } from "react";
import type { RuntimeBridge, SensorConfig } from "../../../shared/contracts";
import { PRESET_DISPLAY, PRESET_IDS } from "../presets";
import { fmtDeg } from "../format";
import { Badge } from "../components/Badges";
import { QrImage } from "../components/QrImage";
import { InfoCallout } from "../components/Callout";

function PresetCard(props: {
  presetId: SensorConfig["presetId"];
  config: SensorConfig | null;
  selected: boolean;
  disabled: boolean;
  onRequest: () => void;
}) {
  const { presetId, config, selected, disabled, onRequest } = props;
  const display = PRESET_DISPLAY[presetId];
  const sensor = selected && config ? config.sensors[0] : undefined;
  return (
    <button type="button" className="bs-preset" aria-pressed={selected} disabled={disabled} onClick={onRequest}>
      <span style={{ display: "flex", justifyContent: "space-between", gap: "var(--bs-s2)" }}>
        <strong>{selected && config ? config.label : display.label}</strong>
        {selected ? <Badge tone="teal">Selected</Badge> : null}
      </span>
      <span className="bs-meta">{display.blurb}</span>
      {sensor ? (
        <span className="bs-preset-params">
          <span>raster</span>
          <span>
            {sensor.widthPx} × {sensor.heightPx} px
          </span>
          <span>h-fov</span>
          <span>{fmtDeg(sensor.horizontalFovRad)}</span>
          <span>range</span>
          <span>
            {sensor.nearM.toFixed(1)} – {sensor.farM.toFixed(1)} m
          </span>
          <span>min target</span>
          <span>{sensor.minResolvableWidthPx.toFixed(0)} px</span>
          <span>dropout</span>
          <span>{sensor.textureDropoutEnabled ? "on" : "off"}</span>
        </span>
      ) : null}
    </button>
  );
}

export function SensorDrawer(props: RuntimeBridge & { open: boolean; onClose: () => void }) {
  const { state, actions, open, onClose } = props;
  const [requestError, setRequestError] = useState<string | null>(null);
  if (!open) return null;

  const busy = state.status === "running" || state.status === "publishing";
  const session = state.session;

  async function request(presetId: SensorConfig["presetId"]) {
    setRequestError(null);
    const result = await actions.requestConfig(presetId);
    if (!result.ok) setRequestError(result.error.message);
  }

  return (
    <aside id="bs-sensor-drawer" className="bs-drawer bs-panel" aria-label="Sensor presets and sharing">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="bs-section-title">Sensor presets</h2>
        <button type="button" className="bs-btn" onClick={onClose} aria-label="Close sensor drawer">
          Close
        </button>
      </div>
      <p className="bs-meta">
        A preset changes the next run only. Completed results keep the configuration they were measured with.
      </p>
      {PRESET_IDS.map((presetId) => (
        <PresetCard
          key={presetId}
          presetId={presetId}
          config={state.config}
          selected={state.config?.presetId === presetId}
          disabled={busy || !state.scenario}
          onRequest={() => void request(presetId)}
        />
      ))}
      {!state.scenario ? <p className="bs-meta">Author a scenario to enable presets.</p> : null}
      {requestError ? (
        <p className="bs-meta" role="alert" style={{ color: "var(--bs-rust)" }}>
          {requestError}
        </p>
      ) : null}
      {session ? (
        <p className="bs-meta bs-mono">
          requested v{session.requestedConfigVersion ?? "–"} · active v{session.activeConfigVersion ?? "–"} · completed v
          {session.completedConfigVersion ?? "–"}
        </p>
      ) : null}

      <h2 className="bs-section-title" style={{ marginTop: "var(--bs-s3)" }}>
        Phone controller
      </h2>
      {session?.controllerUrl ? (
        <div className="bs-share-qr">
          <QrImage value={session.controllerUrl} label={`QR code for the phone controller of ${session.siteName}`} />
          <span className="bs-share-url">{session.controllerUrl.replace(/#.*$/, "#…")}</span>
        </div>
      ) : (
        <InfoCallout title="Sharing disabled">
          Set VITE_PUBLIC_APP_ORIGIN to the deployed HTTPS origin and restart to generate controller and report links.
          Localhost is never the public share origin.
        </InfoCallout>
      )}
      {state.reportUrl ? (
        <>
          <h2 className="bs-section-title" style={{ marginTop: "var(--bs-s3)" }}>
            Published report
          </h2>
          <span className="bs-share-url">{state.reportUrl}</span>
        </>
      ) : null}
    </aside>
  );
}
