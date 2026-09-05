import { useId } from "react";
import type { RuntimeBridge, RunEvent } from "../../../shared/contracts";
import { fmtClock } from "../format";

const EVENT_LABEL: Record<RunEvent["kind"], string> = {
  first_detection: "First detection",
  braking: "Braking",
  stop: "Stop",
  collision: "Collision",
  near_miss: "Near miss",
};

function eventClass(kind: RunEvent["kind"]): string {
  if (kind === "collision") return "bs-event-mark bs-event-mark--collision";
  if (kind === "first_detection") return "bs-event-mark bs-event-mark--detection";
  return "bs-event-mark";
}

/** Route playback strip for the latest recorded run. Space toggles play/pause
 * only while focus is inside this strip; typing elsewhere is never intercepted. */
export function PlaybackStrip({ state, actions }: RuntimeBridge) {
  const run = state.latestRun;
  const frame = state.frame;
  const sliderId = useId();
  const running = state.status === "running";

  if (!run || !frame || running) {
    return (
      <div className="bs-playback bs-panel bs-panel--compact" aria-label="Run playback">
        <button type="button" className="bs-btn" disabled aria-label="Play recorded run">
          ▶
        </button>
        <span className="bs-support">
          {running ? "Evaluating… playback opens when the run completes." : "No recorded run yet."}
        </span>
      </div>
    );
  }

  const duration = run.events.length > 0 ? run.events[run.events.length - 1]!.timeMs : 0;
  const playing = frame.playback === "playing";

  function toggle() {
    actions.setPlayback(playing ? "paused" : "playing");
  }

  function onStripKeyDown(event: React.KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (event.code === "Space" && target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
      event.preventDefault();
      toggle();
    }
  }

  return (
    <div className="bs-playback bs-panel bs-panel--compact" aria-label="Run playback" onKeyDown={onStripKeyDown}>
      <button
        type="button"
        className="bs-btn"
        onClick={toggle}
        aria-label={playing ? "Pause playback" : "Play recorded run"}
        aria-pressed={playing}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <div className="bs-playback-track">
        <label className="bs-visually-hidden" htmlFor={sliderId}>
          Seek recorded run time
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={duration}
          step={100}
          value={frame.timeMs}
          onChange={(e) => actions.seek(Number(e.target.value))}
        />
        <div className="bs-playback-events" aria-hidden="true">
          {duration > 0
            ? run.events.map((event, index) => (
                <span
                  key={`${event.timeMs}-${index}`}
                  className={eventClass(event.kind)}
                  style={{ left: `${(event.timeMs / duration) * 100}%` }}
                  title={`${EVENT_LABEL[event.kind]} at ${fmtClock(event.timeMs)}`}
                />
              ))
            : null}
        </div>
      </div>
      <span className="bs-playback-time" aria-hidden="true">
        {fmtClock(frame.timeMs)}
      </span>
      <span className="bs-meta">Recorded playback · run {run.id}</span>
    </div>
  );
}
