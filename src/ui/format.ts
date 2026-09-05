/** Formatting helpers for measurements. Null handling stays at call sites so
 * "Not evaluated" vs "No stop events" wording remains explicit. */
import type { Vec3 } from "../../shared/contracts";

export function fmtMeters(value: number, digits = 2): string {
  return `${value.toFixed(digits)} m`;
}

export function fmtPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function fmtSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

export function fmtClock(ms: number): string {
  return `t = ${(ms / 1000).toFixed(2)} s`;
}

export function fmtDims(dims: Vec3): string {
  const part = (n: number) => (n < 0.1 ? `${(n * 1000).toFixed(0)} mm` : `${n.toFixed(2)} m`);
  return `${part(dims[0])} × ${part(dims[1])} × ${part(dims[2])}`;
}

export function fmtDeg(rad: number): string {
  return `${((rad * 180) / Math.PI).toFixed(0)}°`;
}

export function fmtIsoTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function shortSha(sha: string): string {
  return sha.length > 14 ? `${sha.slice(0, 14)}…` : sha;
}

export function fmtSpeed(mps: number): string {
  return `${mps.toFixed(1)} m/s`;
}
