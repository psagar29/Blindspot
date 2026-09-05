import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { scenario } from "./validators";
import { authorize, plain, requireSession } from "./access";
import { check, identifier, same, validateScenario } from "./validation";
import { createSensorConfig } from "../src/engine/presets";

export const latest = query({
  args: { sessionId: v.string(), token: v.string(), scenarioId: v.string() },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.sessionId); await authorize(session, args.token);
    identifier(args.scenarioId, "Scenario ID");
    const record = await ctx.db.query("scenarios").withIndex("by_session_id_version", (q) => q.eq("sessionId", session._id).eq("publicId", args.scenarioId)).order("desc").first();
    return record?.value ?? null;
  },
});

export const create = mutation({
  args: { sessionId: v.string(), token: v.string(), scenario },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.sessionId); await authorize(session, args.token);
    validateScenario(args.scenario);
    const previous = await ctx.db.query("scenarios").withIndex("by_session_id_version", (q) => q.eq("sessionId", session._id).eq("publicId", args.scenario.id)).order("desc").first();
    if (previous?.version === args.scenario.version) {
      check(same(previous.value, args.scenario), "VERSION_IMMUTABLE", "An existing scenario version cannot change.");
      return { scenarioId: args.scenario.id, version: args.scenario.version, configVersion: session.requestedConfigVersion };
    }
    check(args.scenario.version === (previous?.version ?? 0) + 1, "VERSION_MISMATCH", "Scenario versions must advance by exactly one.");
    const world = await ctx.db.query("worlds").withIndex("by_session_id_version", (q) => q.eq("sessionId", session._id).eq("publicId", args.scenario.world.id).eq("version", args.scenario.world.version)).unique();
    check(world && same(world.value, args.scenario.world), "VERSION_MISMATCH", "Scenario must use an ingested world owned by this session.");
    for (const hazard of args.scenario.hazards) {
      const item = await ctx.db.query("hazardLibrary").withIndex("by_session_id_version", (q) => q.eq("sessionId", session._id).eq("publicId", hazard.libraryItem.id).eq("version", hazard.libraryItem.version)).unique();
      check(item && same(item.value, hazard.libraryItem), "VERSION_MISMATCH", "Scenario must use ingested library versions owned by this session.");
    }
    await ctx.db.insert("scenarios", { sessionId: session._id, publicId: args.scenario.id, version: args.scenario.version, value: args.scenario });
    const selected = await ctx.db.query("configs").withIndex("by_session_version", (q) => q.eq("sessionId", session._id).eq("version", session.requestedConfigVersion)).unique();
    const configVersion = session.requestedConfigVersion + 1;
    check(configVersion <= 1_000_000, "SESSION_LIMIT", "This session has reached its config limit.");
    const config = createSensorConfig(selected?.value.presetId ?? "baseline", configVersion);
    await ctx.db.insert("configs", { sessionId: session._id, version: configVersion, value: plain(config), clientRequestId: `scenario:${args.scenario.id}:${args.scenario.version}`, submitter: "owner", createdAt: Date.now() });
    await ctx.db.patch(session._id, { scenario: args.scenario, requestedConfigVersion: configVersion, status: "queued" });
    return { scenarioId: args.scenario.id, version: args.scenario.version, configVersion };
  },
});
