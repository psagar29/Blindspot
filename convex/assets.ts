import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { authorize, requireSession } from "./access";
import { check, hash } from "./validation";

export const generateUploadUrl = mutation({
  args: { sessionId: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.sessionId); await authorize(session, args.token);
    check(session.uploadCount < 128, "UPLOAD_LIMIT", "This session has reached its upload limit.");
    check(Date.now() - session.lastUploadAt >= 1000, "RATE_LIMITED", "Wait briefly before preparing another upload.");
    await ctx.db.patch(session._id, { lastUploadAt: Date.now(), uploadCount: session.uploadCount + 1 });
    // The temporary upload capability is returned only to the owner and is never persisted.
    return { uploadUrl: await ctx.storage.generateUploadUrl() };
  },
});
export const completeUpload = mutation({
  args: { sessionId: v.string(), token: v.string(), storageId: v.id("_storage"), sha256: v.string() },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.sessionId); await authorize(session, args.token); hash(args.sha256);
    const existing = await ctx.db.query("uploadedAssets").withIndex("by_storage", (q) => q.eq("storageId", args.storageId)).unique();
    if (existing) {
      check(existing.sessionId === session._id && existing.sha256 === args.sha256, "ASSET_OWNERSHIP", "This asset is already owned or has another digest.");
      return { storageId: args.storageId, url: existing.url };
    }
    const registered = await ctx.db.query("uploadedAssets").withIndex("by_session", (q) => q.eq("sessionId", session._id)).take(128);
    check(registered.length < session.uploadCount && registered.length < 128, "UPLOAD_REQUIRED", "Request an authorized upload before registering another asset.");
    const metadata = await ctx.db.system.get(args.storageId);
    check(metadata && metadata.size > 0 && metadata.size <= 256 * 1024 * 1024, "INVALID_ASSET", "Asset must be nonempty and no larger than 256 MiB.");
    check(["image/jpeg", "image/png", "image/webp", "model/gltf-binary", "application/octet-stream"].includes(metadata.contentType ?? ""), "INVALID_ASSET", "Unsupported asset content type.");
    const digest = Array.from(atob(metadata.sha256), (character) => character.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    check(digest === args.sha256, "DIGEST_MISMATCH", "Uploaded bytes do not match the expected SHA-256 digest.");
    const url = await ctx.storage.getUrl(args.storageId);
    check(url, "INVALID_ASSET", "Uploaded asset is unavailable.");
    await ctx.db.insert("uploadedAssets", { sessionId: session._id, storageId: args.storageId, url, sha256: args.sha256, size: metadata.size, contentType: metadata.contentType! });
    return { storageId: args.storageId, url };
  },
});
