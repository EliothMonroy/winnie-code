import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runProcess } from "./proc";
import { findOnPath } from "./toolchain";
import { getTestToolchain, ROOT } from "./test-helpers";

describe("kotlin-support", () => {
  it("round-trips every supported literal type", async () => {
    const tc = await getTestToolchain();
    const dir = await mkdtemp(path.join(os.tmpdir(), "winnie-support-test-"));
    try {
      const testFile = path.join(ROOT, "kotlin-support", "test", "SupportTest.kt");
      const compile = await runProcess(tc.kotlinc, [testFile, "-cp", tc.supportJar, "-d", "out"], {
        cwd: dir,
        timeoutMs: 180_000,
      });
      expect(compile.exitCode, compile.stderr).toBe(0);
      const run = await runProcess(tc.java, ["-cp", ["out", tc.supportJar].join(path.delimiter), "SupportTestKt"], {
        cwd: dir,
        timeoutMs: 60_000,
      });
      expect(run.stdout.trim(), run.stdout + run.stderr).toBe("ALL PASSED");
      expect(run.exitCode).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("findOnPath", () => {
  it("finds kotlinc and returns null for unknown commands", async () => {
    expect(await findOnPath("kotlinc")).toMatch(/kotlinc$/);
    expect(await findOnPath("definitely-not-a-real-command-winnie")).toBeNull();
  });
});
