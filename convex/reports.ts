import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { CLAIM_BOUNDARY, CONTRACT_VERSION, type ReportSnapshot } from "../shared/contracts";
import { authorize, plain } from "./access";
import { check, identifier, reportStatus, safeAssetUrl, validateCompletedRun, validateConfig, validateScenario } from "./validation";

export const publish = mutation({
  args: { runId: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    identifier(args.runId, "Run ID");
    const runId = ctx.db.normalizeId("runs", args.runId);
    const run = runId ? await ctx.db.get(runId) : null;
    check(run, "RUN_NOT_FOUND", "Run not found.");
    const session = await ctx.db.get(run.sessionId);
    check(session, "SESSION_NOT_FOUND", "Session not found."); await authorize(session, args.token);
    const existing = await ctx.db.query("reports").withIndex("by_run", (q) => q.eq("runId", run._id)).unique();
    if (existing) return { reportId: existing.publicId };
    check(run.status === "completed" && run.result, "RUN_INCOMPLETE", "Complete the run before publishing.");
    const scenario = validateScenario(run.scenario);
    const result = validateCompletedRun(run.result, scenario, validateConfig(run.config));
    const status = reportStatus(scenario, result);
    check(status !== "incomplete", "REPORT_INCOMPLETE", "Quantitative publication requires verified calibration, known eligible encounters, and both simulation passes.");
    const urls = new Set([scenario.world.sourcePhotoUrl, scenario.world.splat.url, scenario.world.collider.url]);
    const referencedAssets = [scenario.world.splat, scenario.world.collider, scenario.platform.visualAsset, ...scenario.hazards.map((hazard) => hazard.libraryItem.asset)];
    for (const asset of referencedAssets) {
      if (asset) { urls.add(asset.url); if (asset.thumbnailUrl) urls.add(asset.thumbnailUrl); }
    }
    const assets = await ctx.db.query("uploadedAssets").withIndex("by_session", (q) => q.eq("sessionId", session._id)).take(128);
    const durable = new Set(assets.map((asset) => asset.url));
    for (const url of urls) {
      safeAssetUrl(url, true);
      check(durable.has(url), "ASSET_NOT_DURABLE", "Copy report assets into this session's durable storage before publishing.");
    }
    const digests = new Map(assets.map((asset) => [asset.url, asset.sha256]));
    for (const asset of referencedAssets) if (asset) check(digests.get(asset.url) === asset.sha256, "ASSET_DIGEST_MISMATCH", "Report asset checksums must match the registered durable bytes.");
    const reportId = crypto.randomUUID();
    const snapshot: ReportSnapshot = {
      contractVersion: CONTRACT_VERSION, id: reportId, title: "Site Blind Spot Report", status,
      publishedAt: new Date().toISOString(), scenario, run: result, claimBoundary: CLAIM_BOUNDARY,
      limitations: [...new Set([
        "Client-computed modeled results are not independently certified measurements.",
        "Coverage measures tested route-hazard encounters, not all site surfaces or probability of safety.",
        "Authored stress hazards are hypotheses, not photo-confirmed site infrastructure.",
        scenario.world.calibration.uncertaintyNote,
        ...scenario.assumptions,
        ...scenario.hazards.map((hazard) => hazard.libraryItem.returnAssumption),
        ...result.config.assumptions,
      ])], evidenceImageUrls: [scenario.world.sourcePhotoUrl],
    };
    await ctx.db.insert("reports", { publicId: reportId, runId: run._id, snapshot: plain(snapshot) });
    return { reportId };
  },
});
export const get = query({
  args: { reportId: v.string() },
  handler: async (ctx, args) => {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(args.reportId)) return null;
    const report = await ctx.db.query("reports").withIndex("by_publicId", (q) => q.eq("publicId", args.reportId)).unique();
    return report?.snapshot ?? null;
  },
});
