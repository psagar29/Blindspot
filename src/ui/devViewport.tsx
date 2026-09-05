/**
 * Fixture stand-in for Person B's engine viewport, used only by the dev
 * preview (dev.tsx). A deterministic top-down schematic of the fixture
 * scenario: ground truth on the left, modeled perception on the right. It is
 * watermarked and never claims to be the 3D engine.
 */
import type { AppState, HazardFinding } from "../../shared/contracts";

const W = 960;
const H = 470;
const PANE_W = W / 2;
const ROUTE_LENGTH_M = 12;
const TOP_PAD = 46;
const BOTTOM_PAD = 34;

/** Map route z (0..12 m) to schematic y (bottom -> top). */
function yFor(z: number): number {
  const usable = H - TOP_PAD - BOTTOM_PAD;
  return H - BOTTOM_PAD - (z / ROUTE_LENGTH_M) * usable;
}

function xFor(paneOffset: number, x: number): number {
  return paneOffset + PANE_W / 2 + x * 34;
}

function Grid({ offset }: { offset: number }) {
  const lines: React.ReactNode[] = [];
  for (let i = 1; i < 6; i += 1) {
    const y = yFor((i * ROUTE_LENGTH_M) / 6);
    lines.push(
      <g key={`h${i}`}>
        <line x1={offset + 18} y1={y} x2={offset + PANE_W - 18} y2={y} stroke="#25333d" strokeWidth={1} />
        <text x={offset + 22} y={y - 4} fontSize={10} fill="#4d616f" fontFamily="var(--bs-font-mono)">
          {((i * ROUTE_LENGTH_M) / 6).toFixed(0)} m
        </text>
      </g>,
    );
  }
  return <>{lines}</>;
}

function TruthPane({ offset, robotZ }: { offset: number; robotZ: number }) {
  const palletY = yFor(4);
  return (
    <g>
      <Grid offset={offset} />
      {/* route */}
      <line
        x1={xFor(offset, 0)}
        y1={yFor(0)}
        x2={xFor(offset, 0)}
        y2={yFor(12)}
        stroke="#3a4a56"
        strokeWidth={2}
        strokeDasharray="6 6"
      />
      {/* pallet (box) */}
      <rect
        x={xFor(offset, -1.1) - 20}
        y={palletY - 17}
        width={40}
        height={34}
        fill="#233340"
        stroke="#7a8894"
        strokeWidth={1.5}
      />
      {/* cables (full spans in truth) */}
      <line x1={xFor(offset, -2.6)} y1={yFor(7.2)} x2={xFor(offset, 2.4)} y2={yFor(7.2)} stroke="#a33422" strokeWidth={3} />
      <line x1={xFor(offset, -2.2)} y1={yFor(9.55)} x2={xFor(offset, 2.5)} y2={yFor(9.55)} stroke="#8a6d1f" strokeWidth={1.6} />
      {/* robot */}
      <circle cx={xFor(offset, 0)} cy={yFor(robotZ)} r={10} fill="#006b78" stroke="#7fd1cd" strokeWidth={2} />
      <line
        x1={xFor(offset, 0)}
        y1={yFor(robotZ)}
        x2={xFor(offset, 0)}
        y2={yFor(robotZ) - 16}
        stroke="#7fd1cd"
        strokeWidth={2}
      />
    </g>
  );
}

/** Deterministic dotted representation of what the modeled sensor supports. */
function PerceptionPane({
  offset,
  robotZ,
  findings,
}: {
  offset: number;
  robotZ: number;
  findings: readonly HazardFinding[] | null;
}) {
  const byId = new Map((findings ?? []).map((f) => [f.hazardId, f.status]));
  const palletStatus = byId.get("hz-pallet") ?? "detected_in_time";
  const powerStatus = byId.get("hz-cable-power") ?? "late";
  const commsStatus = byId.get("hz-cable-comms") ?? "missed";

  const dots: React.ReactNode[] = [];
  // Pallet: dense support cluster unless unknown.
  if (palletStatus === "detected_in_time" || palletStatus === "late") {
    for (let i = 0; i < 24; i += 1) {
      const dx = ((i * 37) % 40) - 20;
      const dy = ((i * 53) % 34) - 17;
      dots.push(
        <circle key={`p${i}`} cx={xFor(offset, -1.1) + dx} cy={yFor(4) + dy} r={1.6} fill="#9fd4d9" opacity={0.9} />,
      );
    }
  }
  // Power cable: sparse support, only mid-span, only when late/detected.
  if (powerStatus === "detected_in_time" || powerStatus === "late") {
    const count = powerStatus === "detected_in_time" ? 14 : 5;
    for (let i = 0; i < count; i += 1) {
      const t = (i + 1) / (count + 1);
      dots.push(
        <circle
          key={`c${i}`}
          cx={xFor(offset, -2.6 + 5 * t)}
          cy={yFor(7.2) + (((i * 29) % 5) - 2)}
          r={1.4}
          fill="#e0a08f"
          opacity={0.95}
        />,
      );
    }
  }
  // Comms line: dots only if detected (permissive preset).
  if (commsStatus === "detected_in_time") {
    for (let i = 0; i < 8; i += 1) {
      const t = (i + 1) / 9;
      dots.push(
        <circle key={`m${i}`} cx={xFor(offset, -2.2 + 4.7 * t)} cy={yFor(9.55)} r={1.2} fill="#d9c98f" opacity={0.9} />,
      );
    }
  }

  return (
    <g>
      <Grid offset={offset} />
      <line
        x1={xFor(offset, 0)}
        y1={yFor(0)}
        x2={xFor(offset, 0)}
        y2={yFor(12)}
        stroke="#3a4a56"
        strokeWidth={2}
        strokeDasharray="6 6"
      />
      {dots}
      {commsStatus === "missed" ? (
        <text
          x={xFor(offset, 0)}
          y={yFor(9.55) - 6}
          fontSize={10}
          fill="#6b7c88"
          textAnchor="middle"
          fontFamily="var(--bs-font-mono)"
        >
          no support: 6 mm line
        </text>
      ) : null}
      <circle cx={xFor(offset, 0)} cy={yFor(robotZ)} r={10} fill="none" stroke="#7fd1cd" strokeWidth={2} strokeDasharray="4 3" />
    </g>
  );
}

export function FixtureViewport({ state }: { state: AppState }) {
  const robotZ = Math.max(0, Math.min(ROUTE_LENGTH_M, state.frame?.pose.positionM[2] ?? 0));
  const findings = state.latestRun?.findings ?? null;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Fixture schematic of the scenario. Ground truth on the left, modeled perception support on the right. Person B's 3D engine replaces this in the composed app."
      style={{ width: "100%", height: "100%", display: "block", background: "var(--bs-viewport)" }}
      preserveAspectRatio="xMidYMid meet"
    >
      <line x1={PANE_W} y1={12} x2={PANE_W} y2={H - 12} stroke="#25333d" strokeWidth={2} />
      <TruthPane offset={0} robotZ={robotZ} />
      <PerceptionPane offset={PANE_W} robotZ={robotZ} findings={findings} />
      <text x={W / 2} y={H - 12} fontSize={11} fill="#6b7c88" textAnchor="middle" fontFamily="var(--bs-font-mono)">
        FIXTURE SCHEMATIC · Person B's engine viewport mounts here
      </text>
    </svg>
  );
}
