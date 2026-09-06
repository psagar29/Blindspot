import type { AppState } from "../../../shared/contracts";

export function Badge(props: {
  tone?: "neutral" | "teal" | "rust" | "amber" | "dark";
  children: React.ReactNode;
  title?: string;
}) {
  const tone = props.tone ?? "neutral";
  const cls = tone === "neutral" ? "bs-badge" : `bs-badge bs-badge--${tone}`;
  return (
    <span className={cls} title={props.title}>
      {props.children}
    </span>
  );
}

const CONNECTION_LABEL: Record<AppState["connection"], string> = {
  connected: "Connected",
  connecting: "Reconnecting…",
  offline: "Offline",
};

export function ConnectionBadge({ connection }: { connection: AppState["connection"] }) {
  const tone = connection === "connected" ? "teal" : connection === "connecting" ? "amber" : "rust";
  return (
    <Badge tone={tone} title={`Session connection: ${CONNECTION_LABEL[connection]}`}>
      <span className="bs-dot" aria-hidden="true" />
      <span className="bs-badge-label">{CONNECTION_LABEL[connection]}</span>
    </Badge>
  );
}

const MODE_LABEL: Record<AppState["mode"], string> = {
  fixture: "Fixture data",
  live: "Live session",
  recording: "Judge demo",
};

export function ModeBadge({ mode }: { mode: AppState["mode"] }) {
  const tone = mode === "fixture" ? "amber" : mode === "recording" ? "dark" : "teal";
  return <Badge tone={tone}>{MODE_LABEL[mode]}</Badge>;
}

/** Full-width stripe so fixture/recorded sessions are unmistakable. */
export function ModeBanner({ mode }: { mode: AppState["mode"] }) {
  if (mode === "live") return null;
  return (
    <div className="bs-mode-banner" role="note">
      {mode === "fixture"
        ? "Fixture data: deterministic sample state for UI development, not a live run."
        : "Judge demo: published scenario and durable assets. Replays run in this browser and do not alter the immutable report."}
    </div>
  );
}
