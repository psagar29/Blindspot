import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { world } from "./validators";
import { authorize, requireSession } from "./access";
import { check, hash, identifier, same, validateWorld } from "./validation";

export const latest = query({
  args: { sessionId: v.string(), token: v.string(), worldId: v.string() },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.sessionId); await authorize(session, args.token);
    identifier(args.worldId, "World ID");
    const record = await ctx.db.query("worlds").withIndex("by_session_id_version", (q) => q.eq("sessionId", session._id).eq("publicId", args.worldId)).order("desc").first();
    return record?.value ?? null;
  },
});

export const ingest = mutation({
  args: { sessionId: v.string(), token: v.string(), world, inputHash: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.sessionId); await authorize(session, args.token);
    validateWorld(args.world);
    if (args.inputHash) hash(args.inputHash);
    const previous = await ctx.db.query("worlds").withIndex("by_session_id_version", (q) => q.eq("sessionId", session._id).eq("publicId", args.world.id)).order("desc").first();
    if (previous?.version === args.world.version) {
      check(same(previous.value, args.world), "VERSION_IMMUTABLE", "An existing world version cannot change.");
      return { worldId: args.world.id, version: args.world.version };
    }
    check(args.world.version === (previous?.version ?? 0) + 1, "VERSION_MISMATCH", "World versions must advance by exactly one.");
    await ctx.db.insert("worlds", { sessionId: session._id, publicId: args.world.id, version: args.world.version, inputHash: args.inputHash ?? args.world.splat.sha256, value: args.world });
    return { worldId: args.world.id, version: args.world.version };
  },
});
