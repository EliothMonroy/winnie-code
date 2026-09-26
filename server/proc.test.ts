import os from "node:os";
import { describe, expect, it } from "vitest";
import { runProcess } from "./proc";

describe("runProcess", () => {
  it("kills the whole process group on timeout, reaching grandchild processes", async () => {
    // A bash script that backgrounds a grandchild (sleep) and waits on it - killing just the
    // bash pid (kotlinc's own trick, since it's a bash wrapper around java) leaves it orphaned.
    const res = await runProcess("bash", ["-c", "sleep 30 & wait"], { cwd: os.tmpdir(), timeoutMs: 500 });
    expect(res.timedOut).toBe(true);
  }, 5_000);

  it("kills the whole process group when the output limit is exceeded", async () => {
    const res = await runProcess("node", ["-e", "process.stdout.write('x'.repeat(2000))"], {
      cwd: os.tmpdir(),
      timeoutMs: 5_000,
      maxOutputBytes: 100,
    });
    expect(res.outputLimitExceeded).toBe(true);
  });
});
