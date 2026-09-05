import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { check, identifier } from "./validation";

export const LEASE_MS = 15_000;
export async function capabilityHash(token: string): Promise<string> {
  check(/^[A-Za-z0-9_-]{32,256}$/.test(token), "UNAUTHORIZED", "Invalid capability.");
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function matches(left: string, right: string) {
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index++) difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return difference === 0;
}
export async function findSession(ctx: QueryCtx | MutationCtx, sessionId: string) {
  identifier(sessionId, "Session ID");
  return ctx.db.query("sessions").withIndex("by_publicId", (q) => q.eq("publicId", sessionId)).unique();
}
export async function requireSession(ctx: QueryCtx | MutationCtx, sessionId: string) {
  const session = await findSession(ctx, sessionId);
  check(session, "SESSION_NOT_FOUND", "Session not found.");
  return session;
}
export async function authorize(session: Doc<"sessions">, token: string, allowController = false) {
  const digest = await capabilityHash(token);
  if (matches(digest, session.ownerCapabilityHash)) return "owner" as const;
  if (allowController && matches(digest, session.controllerCapabilityHash)) return "controller" as const;
  check(false, "UNAUTHORIZED", "This capability cannot perform that action.");
}
export function requireLease(session: Doc<"sessions">, instanceId: string, epoch?: number) {
  identifier(instanceId, "Operator instance ID");
  check(session.leaseInstanceId === instanceId && session.leaseExpiresAt > Date.now() && (epoch === undefined || session.leaseEpoch === epoch), "LEASE_EXPIRED", "An active operator lease is required. Reconnect the operator and try again.");
}
// Shared contracts use readonly tuples; Convex stores mutable, plain JSON arrays.
export type Mutable<T> = T extends readonly (infer U)[] ? Mutable<U>[] : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
export function plain<T>(value: T): Mutable<T> { return JSON.parse(JSON.stringify(value)) as Mutable<T>; }
