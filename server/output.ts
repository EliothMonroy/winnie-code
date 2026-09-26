import type { CaseResult } from "../shared/api";
import type { Problem } from "./problems";

export type HarnessCase = {
  index: number;
  status: "ok" | "error";
  elapsedMs: number;
  output: string;
  expected: string;
  stdout: string;
  error: string;
};

export type Ending = { kind: "exited" } | { kind: "timeout" } | { kind: "crashed"; detail: string };

export const DISPLAY_LIMIT = 64 * 1024;

export function truncate(s: string, limit = DISPLAY_LIMIT): string {
  return s.length <= limit ? s : `${s.slice(0, limit)}\n… truncated (64 KB limit)`;
}

const unb64 = (s: string) => Buffer.from(s, "base64").toString("utf8");

/** Parses WinnieRunner's tagged lines. Lines without the exact token and shape are ignored; the first line per index wins. */
export function parseHarnessOutput(stdout: string, token: string): Map<number, HarnessCase> {
  const cases = new Map<number, HarnessCase>();
  for (const line of stdout.split("\n")) {
    const parts = line.trimEnd().split("|");
    if (parts.length !== 8 || parts[0] !== token) continue;
    const [, rawIndex, status, rawMs, output, expected, out, error] = parts;
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || (status !== "ok" && status !== "error")) continue;
    if (cases.has(index)) continue;
    cases.set(index, {
      index,
      status,
      elapsedMs: Number(rawMs),
      output: unb64(output),
      expected: unb64(expected),
      stdout: unb64(out),
      error: unb64(error),
    });
  }
  return cases;
}

/** Turns harness results into per-test verdicts. Cases the harness never reported are explained by `ending`. */
export function buildCaseResults(problem: Problem, harness: Map<number, HarnessCase>, ending: Ending): CaseResult[] {
  return problem.tests.map((test, index): CaseResult => {
    const base = {
      index,
      input: problem.method.params.map((p, i) => ({ name: p.name, value: test.input[i] })),
      expected: test.expected,
    };
    const h = harness.get(index);
    if (!h) {
      if (ending.kind === "timeout") return { ...base, verdict: "time_limit_exceeded", stdout: "" };
      const error = ending.kind === "crashed" ? ending.detail : "The program exited before this case finished.";
      return { ...base, verdict: "runtime_error", stdout: "", error };
    }
    if (h.status === "error") {
      return { ...base, verdict: "runtime_error", stdout: truncate(h.stdout), error: truncate(h.error), elapsedMs: h.elapsedMs };
    }
    return {
      ...base,
      verdict: h.output === h.expected ? "accepted" : "wrong_answer",
      output: truncate(h.output),
      stdout: truncate(h.stdout),
      elapsedMs: h.elapsedMs,
    };
  });
}
