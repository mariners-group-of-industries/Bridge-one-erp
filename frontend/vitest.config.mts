import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the "paths" in tsconfig.json.
    alias: {
      "@bridgeone/contracts": path.resolve(import.meta.dirname, "src/contracts"),
      "@bridgeone/purchase-calculations": path.resolve(import.meta.dirname, "src/lib/calculations"),
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // "forks" gives every test file its own module cache. With "vmForks", per-file
    // vi.mock() of the same module leaked between files sharing a worker (CI).
    pool: "forks",
    testTimeout: 30_000,
    hookTimeout: 60_000,
    snapshotSerializers: [],
  },
});
