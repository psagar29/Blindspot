import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { libraryItem } from "./validators";
import { authorize, findSession, requireSession } from "./access";
import { check, hash, identifier, same, validateLibraryItem } from "./validation";

export const ingest = mutation({
  args: { sessionId: v.string(), token: v.string(), item: libraryItem, requestHash: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.sessionId); await authorize(session, args.token);
    validateLibraryItem(args.item);
    if (args.requestHash) hash(args.requestHash);
    const previous = await ctx.db.query("hazardLibrary").withIndex("by_session_id_version", (q) => q.eq("sessionId", session._id).eq("publicId", args.item.id)).order("desc").first();
    if (previous?.version === args.item.version) {
      check(same(previous.value, args.item), "VERSION_IMMUTABLE", "An existing library version cannot change.");
      return { itemId: args.item.id, version: args.item.version };
    }
    check(args.item.version === (previous?.version ?? 0) + 1, "VERSION_MISMATCH", "Library versions must advance by exactly one.");
    const records = await ctx.db.query("hazardLibrary").withIndex("by_session", (q) => q.eq("sessionId", session._id)).take(129);
    check(records.length < 128, "SESSION_LIMIT", "This session has reached its library version limit.");
    await ctx.db.insert("hazardLibrary", { sessionId: session._id, publicId: args.item.id, version: args.item.version, requestHash: args.requestHash ?? `authored:${args.item.id}:${args.item.version}`, value: args.item });
    return { itemId: args.item.id, version: args.item.version };
  },
});
export const list = query({
  args: { sessionId: v.optional(v.string()), worldId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Public callers must choose a session; there is no global session enumeration.
    if (!args.sessionId) return [];
    const session = await findSession(ctx, args.sessionId);
    if (!session) return [];
    if (args.worldId) {
      identifier(args.worldId, "World ID");
      if (session.scenario.world.id !== args.worldId) return [];
    }
    const records = await ctx.db.query("hazardLibrary").withIndex("by_session", (q) => q.eq("sessionId", session._id)).order("desc").take(128);
    const latest = new Map<string, typeof records[number]["value"]>();
    for (const record of records) if (!latest.has(record.publicId)) latest.set(record.publicId, record.value);
    return [...latest.values()];
  },
});
