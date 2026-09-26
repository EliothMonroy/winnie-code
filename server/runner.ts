import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { RunResponse } from "../shared/api";
import { parseDiagnostics } from "./diagnostics";
import { encodeCases, generateMain, type HarnessMode } from "./harness";
import { buildCaseResults, parseHarnessOutput, type Ending } from "./output";
import type { Problem } from "./problems";
import { runProcess, type ProcResult } from "./proc";
import { formatSignature } from "./template";
import type { Toolchain } from "./toolchain";

export const DEFAULT_RUN_TIMEOUT_MS = 10_000;
const COMPILE_TIMEOUT_MS = 120_000;
const CHECK_TIMEOUT_MS = 30_000;

type Execution =
  | { kind: "compile_error"; raw: string }
  | { kind: "executed"; stdout: string; ending: Ending; token: string };

function crashDetail(run: ProcResult): string {
  if (run.outputLimitExceeded) return "The program produced too much output and was stopped.";
  const tail = run.stderr.trim().split("\n").slice(-20).join("\n");
  return tail || `The program exited unexpectedly (${run.signal ?? `exit code ${run.exitCode}`}).`;
}

/** Writes Solution.kt (unless code is null), Main.kt and cases.txt to a temp dir, compiles, runs, and cleans up. */
async function compileAndExecute(
  tc: Toolchain,
  problem: Problem,
  mode: HarnessMode,
  code: string | null,
  timeoutMs: number,
): Promise<Execution> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "winnie-"));
  try {
    const sources = ["Main.kt"];
    if (code !== null) {
      await writeFile(path.join(dir, "Solution.kt"), code);
      sources.unshift("Solution.kt");
    }
    await writeFile(path.join(dir, "Main.kt"), generateMain(problem, mode));
    await writeFile(path.join(dir, "cases.txt"), encodeCases(problem.tests));

    const compile = await runProcess(tc.kotlinc, [...sources, "-cp", tc.supportJar, "-d", "out"], {
      cwd: dir,
      timeoutMs: COMPILE_TIMEOUT_MS,
    });
    if (compile.exitCode !== 0) {
      const raw = compile.timedOut
        ? "Compilation timed out."
        : `${compile.stderr}${compile.stdout}`.split(dir + path.sep).join("").trim();
      return { kind: "compile_error", raw };
    }

    const token = randomBytes(16).toString("hex");
    const classpath = ["out", tc.supportJar].join(path.delimiter);
    const run = await runProcess(tc.java, ["-Xmx256m", "-XX:+UseSerialGC", "-cp", classpath, "MainKt", "cases.txt", token], {
      cwd: dir,
      timeoutMs,
    });
    const ending: Ending = run.timedOut
      ? { kind: "timeout" }
      : run.exitCode === 0
        ? { kind: "exited" }
        : { kind: "crashed", detail: crashDetail(run) };
    return { kind: "executed", stdout: run.stdout, ending, token };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function runSolution(
  tc: Toolchain,
  problem: Problem,
  code: string,
  timeoutMs = DEFAULT_RUN_TIMEOUT_MS,
): Promise<RunResponse> {
  const started = Date.now();
  const execution = await compileAndExecute(tc, problem, "run", code, timeoutMs);
  if (execution.kind === "compile_error") {
    const diagnostics = parseDiagnostics(execution.raw);
    let raw = execution.raw;
    if (diagnostics.length === 0 && parseDiagnostics(execution.raw, "Main.kt").length > 0) {
      raw = `Your Solution class must keep the method signature: ${formatSignature(problem.method)}\n${raw}`;
    }
    return { status: "compile_error", diagnostics, raw };
  }
  const cases = buildCaseResults(problem, parseHarnessOutput(execution.stdout, execution.token), execution.ending);
  return {
    status: "ran",
    passed: cases.filter((c) => c.verdict === "accepted").length,
    total: cases.length,
    elapsedMs: Date.now() - started,
    cases,
  };
}

/** Parses every input and expected literal against the declared types without running any solution. */
export async function checkProblemLiterals(tc: Toolchain, problem: Problem): Promise<string[]> {
  const execution = await compileAndExecute(tc, problem, "check", null, CHECK_TIMEOUT_MS);
  if (execution.kind === "compile_error") return [`The check harness failed to compile:\n${execution.raw}`];
  const harness = parseHarnessOutput(execution.stdout, execution.token);
  return problem.tests.flatMap((_, i) => {
    const result = harness.get(i);
    if (!result) return [`tests[${i}]: was not checked (${execution.ending.kind})`];
    return result.status === "error" ? [`tests[${i}]: ${result.error.split("\n")[0]}`] : [];
  });
}
