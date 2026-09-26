import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["server/**/*.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 300_000,
    passWithNoTests: true,
  },
});
