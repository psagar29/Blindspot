import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { world, libraryItem, scenario, sensorConfig } from "./validators";
import { check, hash, identifier, same, validateWorld, validateLibraryItem, validateScenario, validateConfig } from "./validation";
import { findSession, plain } from "./access";
import { createSensorConfig } from "../src/engine/presets";

export const bootstrap = internalMutation({
  args: { sessionId: v.string(), ownerCapabilityHash: v.string(), controllerCapabilityHash: v.string(), world, library: v.array(libraryItem), scenario, baselineConfig: sensorConfig },
  handler: async (ctx, args) => {
    identifier(args.sessionId, "Session ID"); hash(args.ownerCapabilityHash); hash(args.controllerCapabilityHash);
    check(args.ownerCapabilityHash !== args.controllerCapabilityHash, "INVALID_CAPABILITY", "Owner and controller capabilities must be different.");
    validateWorld(args.world); validateScenario(args.scenario); validateConfig(args.baselineConfig);
    check(args.library.length >= 1 && args.library.length <= 32, "TOO_LARGE", "Bootstrap requires a bounded hazard library.");
    args.library.forEach(validateLibraryItem);
    check(new Set(args.library.map((item) => item.id)).size === args.library.length, "INVALID_ID", "Library IDs must be unique.");
    check(same(args.scenario.world, args.world), "VERSION_MISMATCH", "Scenario world must match the initial world.");
    check(args.scenario.hazards.every((hazard) => args.library.some((item) => same(item, hazard.libraryItem))), "VERSION_MISMATCH", "Scenario hazards must use initial library snapshots.");
    check(same(args.baselineConfig, createSensorConfig("baseline", 1)), "INVALID_CONFIG", "Bootstrap requires the frozen baseline preset.");
    const existing = await findSession(ctx, args.sessionId);
    if (existing) {
      check(existing.ownerCapabilityHash === args.ownerCapabilityHash && existing.controllerCapabilityHash === args.controllerCapabilityHash, "BOOTSTRAP_CONFLICT", "Session already exists with other capabilities.");
      return { sessionId: existing.publicId, created: false };
    }
    const sessionId = await ctx.db.insert("sessions", {
      publicId: args.sessionId, ownerCapabilityHash: args.ownerCapabilityHash, controllerCapabilityHash: args.controllerCapabilityHash,
      scenario: args.scenario, baselineConfig: args.baselineConfig, requestedConfigVersion: 1,
      activeConfigVersion: null, completedConfigVersion: null, leaseExpiresAt: 0, leaseEpoch: 0,
      status: "queued", lastConfigRequestAt: 0, lastUploadAt: 0, uploadCount: 0,
    });
    await ctx.db.insert("worlds", { sessionId, publicId: args.world.id, version: args.world.version, inputHash: `bootstrap:${args.world.id}`, value: args.world });
    for (const item of args.library) await ctx.db.insert("hazardLibrary", { sessionId, publicId: item.id, version: item.version, requestHash: `bootstrap:${item.id}`, value: item });
    await ctx.db.insert("scenarios", { sessionId, publicId: args.scenario.id, version: args.scenario.version, value: args.scenario });
    await ctx.db.insert("configs", { sessionId, version: 1, value: plain(createSensorConfig("baseline", 1)), clientRequestId: "bootstrap", submitter: "owner", createdAt: Date.now() });
    return { sessionId: args.sessionId, created: true };
  },
});
