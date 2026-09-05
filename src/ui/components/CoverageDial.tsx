import { useEffect, useRef } from "react";
import type { GaugeReading } from "../metrics";

const CX = 120;
const CY = 118;
const R = 92;

function angleFor(value: number): number {
  const clamped = Math.max(0, Math.min(100, value));
  return -90 + (clamped / 100) * 180;
}

function tickPoint(value: number, radius: number): [number, number] {
  const theta = ((angleFor(value) - 90) * Math.PI) / 180;
  return [CX + radius * Math.cos(theta), CY + radius * Math.sin(theta)];
}

function Needle(props: { value: number | null; shape: "coverage" | "falseStop" }) {
  const { value, shape } = props;
  // Animate only between two real values; jump when appearing from null.
  const previous = useRef<number | null>(null);
  const instant = previous.current === null || value === null;
  useEffect(() => {
    previous.current = value;
  }, [value]);
  if (value === null) return null;
  const style: React.CSSProperties = {
    transform: `rotate(${angleFor(value)}deg)`,
    transformOrigin: `${CX}px ${CY}px`,
    transition: instant ? "none" : "transform var(--bs-t-panel)",
  };
  if (shape === "coverage") {
    return (
      <g style={style}>
        <polygon
          points={`${CX - 5},${CY} ${CX + 5},${CY} ${CX},${CY - R + 16}`}
          fill="var(--bs-teal)"
        />
      </g>
    );
  }
  return (
    <g style={style}>
      <line x1={CX} y1={CY} x2={CX} y2={CY - R + 30} stroke="var(--bs-rust)" strokeWidth={3} />
      <circle cx={CX} cy={CY - R + 24} r={7} fill="none" stroke="var(--bs-rust)" strokeWidth={3} />
    </g>
  );
}

/**
 * Two-needle instrument dial, 0-100:
 * solid teal triangle = hazard coverage (higher is better),
 * open rust circle-tip = false-stop rate (lower is better).
 * Values/denominators are rendered as adjacent text by the caller; the dial
 * itself stays decorative-plus-redundant, never the only reading.
 */
export function CoverageDial(props: { coverage: GaugeReading; falseStop: GaugeReading; compact?: boolean }) {
  const { coverage, falseStop, compact } = props;
  const label =
    `Coverage ${coverage.headline} (${coverage.detail}). ` +
    `False stops ${falseStop.headline} (${falseStop.detail}).`;
  const ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  return (
    <svg
      viewBox="0 0 240 140"
      role="img"
      aria-label={label}
      style={{ width: compact ? 180 : "100%", maxWidth: 300, height: "auto", display: "block" }}
    >
      {/* recessed dial face */}
      <path
        d={`M ${CX - R - 10} ${CY} A ${R + 10} ${R + 10} 0 0 1 ${CX + R + 10} ${CY} L ${CX + R - 26} ${CY} A ${R - 26} ${R - 26} 0 0 0 ${CX - R + 26} ${CY} Z`}
        fill="var(--bs-surface-well)"
        stroke="var(--bs-border)"
        strokeWidth={1}
      />
      {ticks.map((t) => {
        const [x1, y1] = tickPoint(t, R - 18);
        const [x2, y2] = tickPoint(t, R - (t % 50 === 0 ? 4 : 10));
        return (
          <line
            key={t}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={t % 50 === 0 ? "var(--bs-text)" : "var(--bs-border)"}
            strokeWidth={t % 50 === 0 ? 2 : 1}
          />
        );
      })}
      <text x={CX - R + 4} y={CY + 14} fontSize={11} fill="var(--bs-text-secondary)" fontFamily="var(--bs-font-mono)">
        0
      </text>
      <text x={CX - 8} y={16} fontSize={11} fill="var(--bs-text-secondary)" fontFamily="var(--bs-font-mono)">
        50
      </text>
      <text x={CX + R - 24} y={CY + 14} fontSize={11} fill="var(--bs-text-secondary)" fontFamily="var(--bs-font-mono)">
        100
      </text>
      <Needle value={falseStop.value} shape="falseStop" />
      <Needle value={coverage.value} shape="coverage" />
      {/* hub */}
      <circle cx={CX} cy={CY} r={9} fill="var(--bs-surface)" stroke="var(--bs-border)" strokeWidth={2} />
      {(coverage.value === null || falseStop.value === null) && (
        <text
          x={CX}
          y={CY - 28}
          textAnchor="middle"
          fontSize={12}
          fill="var(--bs-text-secondary)"
          fontFamily="var(--bs-font-ui)"
        >
          {coverage.value === null && falseStop.value === null
            ? "Not evaluated"
            : coverage.value === null
              ? "Coverage not evaluated"
              : falseStop.headline === "No stop events"
                ? "No stop events"
                : "False stops not evaluated"}
        </text>
      )}
    </svg>
  );
}
