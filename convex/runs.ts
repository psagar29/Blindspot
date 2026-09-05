import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { completedRun, brakingDecision } from "./validators";
import { authorize, requireLease, requireSession } from "./access";
import { check, identifier, same, validateCompletedRun, validateScenario, validateConfig, validateBrakingDecision } from "./validation";

export const claimNext = mutation({
  args: { sessionId: v.string(), token: v.string(), instanceId: v.string() },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.sessionId);
    await authorize(session, args.token); requireLease(session, args.instanceId);
    const active = await ctx.db.query("runs").withIndex("by_session_status", (q) => q.eq("sessionId", session._id).eq("status", "running")).take(4);
    for (const run of active) {
      if (run.instanceId === args.instanceId && run.leaseEpoch === session.leaseEpoch) return { runId: run._id, scenario: run.scenario, config: run.config, leaseExpiresAt: session.leaseExpiresAt };
      await ctx.db.patch(run._id, { status: "abandoned" });
    }
    if (session.completedConfigVersion === session.requestedConfigVersion) return null;
    const config = await ctx.db.query("configs").withIndex("by_session_version", (q) => q.eq("sessionId", session._id).eq("version", session.requestedConfigVersion)).unique();
    check(config, "CONFIG_NOT_FOUND", "The requested preset snapshot is missing.");
    const runId = await ctx.db.insert("runs", { sessionId: session._id, scenario: session.scenario, config: config.value, instanceId: args.instanceId, leaseEpoch: session.leaseEpoch, createdAt: Date.now(), status: "running" });
    await ctx.db.patch(session._id, { activeConfigVersion: config.version, status: "running" });
    return { runId, scenario: session.scenario, config: config.value, leaseExpiresAt: session.leaseExpiresAt };
  },
});
export const complete = mutation({
  args: { runId: v.string(), token: v.string(), instanceId: v.string(), scenarioVersion: v.number(), configVersion: v.number(), result: completedRun, brakingDecision: v.optional(v.union(brakingDecision, v.null())) },
  handler: async (ctx, args) => {
    identifier(args.runId, "Run ID");
    const id = ctx.db.normalizeId("runs", args.runId);
    const run = id ? await ctx.db.get(id) : null;
    check(run, "RUN_NOT_FOUND", "Run not found.");
    const session = await ctx.db.get(run.sessionId);
    check(session, "SESSION_NOT_FOUND", "Session not found.");
    await authorize(session, args.token);
    check(run.instanceId === args.instanceId && run.scenario.version === args.scenarioVersion && run.config.version === args.configVersion && args.result.id === args.runId, "VERSION_MISMATCH", "Run identity or versions do not match the claimed snapshot.");
    if (run.status === "completed") {
      check(same(run.result, args.result) && same(run.brakingDecision ?? null, args.brakingDecision ?? null), "RUN_IMMUTABLE", "A completed run cannot be changed.");
      return { runId: args.runId, acceptedForDisplay: session.latestRunId === run._id };
    }
    requireLease(session, args.instanceId, run.leaseEpoch);
    check(run.status === "running", "RUN_ABANDONED", "The run no longer belongs to the active operator lease.");
    const scenario = validateScenario(run.scenario);
    const result = validateCompletedRun(args.result, scenario, validateConfig(run.config));
    validateBrakingDecision(args.brakingDecision, scenario, result);
    await ctx.db.patch(run._id, { status: "completed", result: args.result, brakingDecision: args.brakingDecision ?? null });
    const acceptedForDisplay = session.requestedConfigVersion === run.config.version && same(session.scenario, run.scenario);
    if (acceptedForDisplay) await ctx.db.patch(session._id, { completedConfigVersion: run.config.version, latestRunId: run._id, activeConfigVersion: null, status: "ready" });
    else await ctx.db.patch(session._id, { activeConfigVersion: null, status: "queued" });
    return { runId: args.runId, acceptedForDisplay };
  },
});
