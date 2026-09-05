import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { world, libraryItem, scenario, sensorConfig, completedRun, reportSnapshot, brakingDecision } from "./validators";

export default defineSchema({
  sessions: defineTable({
    publicId: v.string(), ownerCapabilityHash: v.string(), controllerCapabilityHash: v.string(),
    scenario: scenario, baselineConfig: sensorConfig,
    requestedConfigVersion: v.number(), activeConfigVersion: v.union(v.number(), v.null()),
    completedConfigVersion: v.union(v.number(), v.null()), latestRunId: v.optional(v.id("runs")),
    leaseInstanceId: v.optional(v.string()), leaseExpiresAt: v.number(), leaseEpoch: v.number(),
    status: v.union(v.literal("ready"), v.literal("queued"), v.literal("running")),
    lastConfigRequestAt: v.number(), lastUploadAt: v.number(), uploadCount: v.number(),
  }).index("by_publicId", ["publicId"]),
  worlds: defineTable({ sessionId: v.id("sessions"), publicId: v.string(), version: v.number(), inputHash: v.string(), value: world })
    .index("by_session_id_version", ["sessionId", "publicId", "version"])
    .index("by_session_inputHash", ["sessionId", "inputHash"]),
  hazardLibrary: defineTable({ sessionId: v.id("sessions"), publicId: v.string(), version: v.number(), requestHash: v.string(), value: libraryItem })
    .index("by_session", ["sessionId"])
    .index("by_session_id_version", ["sessionId", "publicId", "version"])
    .index("by_session_requestHash", ["sessionId", "requestHash"]),
  scenarios: defineTable({ sessionId: v.id("sessions"), publicId: v.string(), version: v.number(), value: scenario })
    .index("by_session_id_version", ["sessionId", "publicId", "version"]),
  configs: defineTable({ sessionId: v.id("sessions"), version: v.number(), value: sensorConfig, clientRequestId: v.string(), submitter: v.union(v.literal("owner"), v.literal("controller")), createdAt: v.number() })
    .index("by_session_version", ["sessionId", "version"])
    .index("by_session_requestId", ["sessionId", "clientRequestId"]),
  runs: defineTable({
    sessionId: v.id("sessions"), scenario: scenario, config: sensorConfig,
    instanceId: v.string(), leaseEpoch: v.number(), createdAt: v.number(),
    status: v.union(v.literal("running"), v.literal("completed"), v.literal("abandoned")),
    result: v.optional(completedRun), brakingDecision: v.optional(v.union(brakingDecision, v.null())),
  }).index("by_session_createdAt", ["sessionId", "createdAt"])
    .index("by_session_status", ["sessionId", "status"])
    .index("by_session_configVersion", ["sessionId", "config.version"]),
  reports: defineTable({ publicId: v.string(), runId: v.id("runs"), snapshot: reportSnapshot })
    .index("by_publicId", ["publicId"]).index("by_run", ["runId"]),
  uploadedAssets: defineTable({ sessionId: v.id("sessions"), storageId: v.id("_storage"), url: v.string(), sha256: v.string(), size: v.number(), contentType: v.string() })
    .index("by_storage", ["storageId"]).index("by_session", ["sessionId"]),
});
