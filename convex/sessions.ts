import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authorize, findSession, LEASE_MS, requireSession } from "./access";
import { check, hash, identifier } from "./validation";

export const getPublic = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const session = await findSession(ctx, args.sessionId);
    if (!session) return null;
    const config = await ctx.db.query("configs").withIndex("by_session_version", (q) => q.eq("sessionId", session._id).eq("version", session.requestedConfigVersion)).unique();
    const latest = session.latestRunId ? await ctx.db.get(session.latestRunId) : null;
    const report = latest ? await ctx.db.query("reports").withIndex("by_run", (q) => q.eq("runId", latest._id)).unique() : null;
    const items = await ctx.db.query("hazardLibrary").withIndex("by_session", (q) => q.eq("sessionId", session._id)).order("desc").take(128);
    const latestLibrary = new Map<string, typeof items[number]["value"]>();
    for (const item of items) if (!latestLibrary.has(item.publicId)) latestLibrary.set(item.publicId, item.value);
    const library = [...latestLibrary.values()];
    return {
      session: { id: session.publicId, siteName: session.scenario.world.name, controllerUrl: null,
        operatorOnline: session.leaseExpiresAt > Date.now(), requestedConfigVersion: session.requestedConfigVersion,
        activeConfigVersion: session.activeConfigVersion, completedConfigVersion: session.completedConfigVersion },
      status: session.status, scenario: session.scenario, world: session.scenario.world, library,
      config: config?.value ?? null, latestRun: latest?.result ?? null, latestReportId: report?.publicId ?? null,
      leaseExpiresAt: session.leaseExpiresAt,
    };
  },
});
export const claimLease = mutation({
  args: { sessionId: v.string(), token: v.string(), instanceId: v.string() },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.sessionId);
    await authorize(session, args.token); identifier(args.instanceId, "Operator instance ID");
    const now = Date.now();
    if (session.leaseExpiresAt > now && session.leaseInstanceId !== args.instanceId) return { leased: false, leaseExpiresAt: session.leaseExpiresAt };
    const leaseExpiresAt = now + LEASE_MS;
    const leaseEpoch = session.leaseExpiresAt > now ? session.leaseEpoch : session.leaseEpoch + 1;
    await ctx.db.patch(session._id, { leaseInstanceId: args.instanceId, leaseExpiresAt, leaseEpoch });
    return { leased: true, leaseExpiresAt };
  },
});

export const rotateControllerCapability = mutation({
  args: { sessionId: v.string(), token: v.string(), controllerCapabilityHash: v.string() },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.sessionId);
    await authorize(session, args.token);
    hash(args.controllerCapabilityHash);
    check(
      args.controllerCapabilityHash !== session.ownerCapabilityHash,
      "INVALID_CAPABILITY",
      "Owner and controller capabilities must be different.",
    );
    await ctx.db.patch(session._id, { controllerCapabilityHash: args.controllerCapabilityHash });
    return { rotated: true };
  },
});
