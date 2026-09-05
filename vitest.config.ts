import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Standalone test config: does not reuse vite.config.ts because that file
// validates mode-specific HTML entries that are irrelevant to unit tests.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    css: false,
  },
});
