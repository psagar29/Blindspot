import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { presetId } from "./validators";
import { authorize, plain, requireSession } from "./access";
import { check, identifier } from "./validation";
import { createSensorConfig } from "../src/engine/presets";

export const request = mutation({
  args: { sessionId: v.string(), token: v.string(), presetId, clientRequestId: v.string() },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.sessionId);
    const submitter = await authorize(session, args.token, true);
    identifier(args.clientRequestId, "Client request ID");
    const duplicate = await ctx.db.query("configs").withIndex("by_session_requestId", (q) => q.eq("sessionId", session._id).eq("clientRequestId", args.clientRequestId)).unique();
    if (duplicate) {
      check(duplicate.value.presetId === args.presetId, "REQUEST_CONFLICT", "A request ID cannot be reused for another preset.");
      return { configVersion: duplicate.version };
    }
    check(Date.now() - session.lastConfigRequestAt >= 250, "RATE_LIMITED", "Wait briefly before requesting another preset.");
    check(session.requestedConfigVersion < 1_000_000, "SESSION_LIMIT", "This session has reached its config limit.");
    const configVersion = session.requestedConfigVersion + 1;
    const config = createSensorConfig(args.presetId, configVersion);
    await ctx.db.insert("configs", { sessionId: session._id, version: configVersion, value: plain(config), clientRequestId: args.clientRequestId, submitter, createdAt: Date.now() });
    await ctx.db.patch(session._id, { requestedConfigVersion: configVersion, status: "queued", lastConfigRequestAt: Date.now() });
    return { configVersion };
  },
});
