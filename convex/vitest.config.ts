import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "convex-test": fileURLToPath(new URL("../services/provider/node_modules/convex-test/dist/index.js", import.meta.url)) } },
  test: { include: ["convex/tests/*.check.ts"], environment: "edge-runtime", maxWorkers: 1 },
});
