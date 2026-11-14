import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["tests/setup.ts"],
    // Each test file boots its own PGlite (Postgres in WASM, a few hundred MB). Several at once crashed
    // workers on a laptop with ~2 GB free RAM, so files run one after another.
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
