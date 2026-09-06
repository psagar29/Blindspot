import type { RuntimeBridge } from "../../../shared/contracts";
import { fmtClock, fmtSeconds, fmtSpeed } from "../format";
import { Badge } from "../components/Badges";

/** UI-side capability probe; presentation only. B's viewport owns real GL setup.
 * Probed once per page: every probe allocates a WebGL context, and browsers cap live
 * contexts per page (Chrome: 16, oldest evicted). Re-probing on each render during a
 * run evicted the live viewport context within two seconds. */
let probedSupport: boolean | null = null;
export function webglSupported(): boolean {
  if (typeof window !== "undefined" && (window as { __BLINDSPOT_FORCE_NO_WEBGL?: boolean }).__BLINDSPOT_FORCE_NO_WEBGL) {
    return false;
  }
  if (probedSupport === null) {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      probedSupport = Boolean(gl);
      (gl as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      probedSupport = false;
    }
  }
  return probedSupport;
}

function ViewportState(props: { title: string; body?: string; children?: React.ReactNode; photoUrl?: string }) {
  return (
    <div className="bs-viewport-state">
      {props.photoUrl ? (
        <img className="bs-viewport-photo-backdrop" src={props.photoUrl} alt="" aria-hidden="true" />
      ) : null}
      <p className="bs-viewport-state-title" style={{ position: "relative" }}>
        {props.title}
      </p>
      {props.body ? (
        <p className="bs-viewport-state-body" style={{ position: "relative" }}>
          {props.body}
        </p>
      ) : null}
      {props.children}
    </div>
  );
}

/**
 * The dark evidence area. A owns the shell, surrounding overlays (view labels,
 * shared time / run id) and non-3D states; B's viewport node renders inside and
 * owns anything requiring 3D positioning.
 */
export function ViewportShell(props: RuntimeBridge & { viewport: React.ReactNode }) {
  const { state, viewport } = props;
  const world = state.world;
  const run = state.latestRun;
  const frame = state.frame;

  let content: React.ReactNode;
  if (!webglSupported()) {
    content = (
      <ViewportState
        title="3D evidence unavailable on this device"
        body="This browser does not offer WebGL. The phone controller and published reports still work; open the workspace on the operator laptop to view the scene."
      />
    );
  } else if (state.status === "empty" && !world) {
    content = (
      <ViewportState
        title="No world yet"
        body="Describe the inspection in the rail and generate a world from a site photo. Generation is asynchronous and can take minutes for a fresh photo; cached worlds load immediately."
      />
    );
  } else if (state.status === "uploading" || state.status === "generating") {
    content = (
      <ViewportState
        title={state.stageLabel ?? "Preparing world…"}
        photoUrl={world?.sourcePhotoUrl}
        body="No progress percentage is available; this is the provider's actual stage."
      >
        {state.elapsedMs !== null ? (
          <p className="bs-stage-elapsed" style={{ position: "relative" }}>
            {fmtSeconds(state.elapsedMs)} elapsed
          </p>
        ) : null}
      </ViewportState>
    );
  } else if (state.status === "error" && state.error && !world) {
    content = (
      <ViewportState title="World generation failed" body={state.error.message} />
    );
  } else if (state.status === "calibrating" && world) {
    content = (
      <ViewportState
        title="Confirm the world scale"
        photoUrl={world.sourcePhotoUrl}
        body="Enter a reference with a known length in the rail. Measurements stay estimates until a reference is confirmed, and the report records which kind it was."
      />
    );
  } else if (viewport) {
    content = <div className="bs-viewport-canvas">{viewport}</div>;
  } else {
    content = (
      <ViewportState
        title="Engine viewport not loaded"
        body={
          state.mode === "fixture"
            ? "Fixture preview: Person B's engine viewport mounts here in the composed app."
            : "The 3D engine has not been loaded in this session."
        }
      />
    );
  }

  const showOverlays = world !== null && (state.status === "ready" || state.status === "running" || state.status === "queued" || state.status === "publishing" || state.status === "published");

  return (
    <div className="bs-viewport-shell" role="region" aria-label="3D evidence viewport">
      {content}
      {showOverlays ? (
        <div className="bs-viewport-overlay">
          <div className="bs-viewport-overlay-row">
            <span className="bs-viewport-label" style={{ textTransform: "uppercase" }}>Ground truth</span>
            {state.status === "running" ? (
              <Badge tone="teal">
                <span className="bs-dot" aria-hidden="true" />
                Evaluating
              </Badge>
            ) : null}
            <span className="bs-viewport-label" style={{ textTransform: "uppercase" }}>Modeled perception</span>
          </div>
          <div className="bs-viewport-overlay-row">
            <span className="bs-viewport-label">
              {frame ? fmtClock(frame.timeMs) : "t = 0.00 s"}
              {frame ? ` · ${fmtSpeed(frame.speedMps)}` : ""}
              {frame?.pass === "recording" ? " · recorded playback" : ""}
            </span>
            <span className="bs-viewport-label">
              {run ? `run ${run.id} · config v${run.config.version}` : "no completed run"}
              {frame ? ` · ${frame.perceivedPointCount.toLocaleString()} pts` : ""}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
