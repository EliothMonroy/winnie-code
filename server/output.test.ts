import { describe, expect, it } from "vitest";
import { buildCaseResults, DISPLAY_LIMIT, parseHarnessOutput, truncate, type HarnessCase } from "./output";
import type { Problem } from "./problems";
import { parseType } from "./types";

const TOKEN = "tok123";
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

function line(index: number, status: string, fields: Partial<Record<"output" | "expected" | "stdout" | "error", string>> = {}, token = TOKEN) {
  return [token, index, status, 7, b64(fields.output ?? ""), b64(fields.expected ?? ""), b64(fields.stdout ?? ""), b64(fields.error ?? "")].join("|");
}

const problem: Problem = {
  slug: "sum",
  title: "Sum",
  difficulty: "Easy",
  description: "",
  method: { name: "sum", params: [{ name: "nums", type: parseType("IntArray") }], returns: parseType("Int") },
  tests: [
    { input: ["[1,2]"], expected: "3" },
    { input: ["[5]"], expected: "5" },
    { input: ["[]"], expected: "0" },
  ],
};

function harness(...cases: HarnessCase[]): Map<number, HarnessCase> {
  return new Map(cases.map((c) => [c.index, c]));
}

const ok = (index: number, output: string, expected: string, stdout = ""): HarnessCase => ({
  index,
  status: "ok",
  elapsedMs: 3,
  output,
  expected,
  stdout,
  error: "",
});

describe("parseHarnessOutput", () => {
  it("decodes tagged lines", () => {
    const out = [
      "some stray line",
      line(0, "ok", { output: "3", expected: "3", stdout: "hi|there\n" }),
      line(1, "error", { error: "java.lang.RuntimeException: boom" }),
    ].join("\n");
    const cases = parseHarnessOutput(out, TOKEN);
    expect(cases.get(0)).toEqual({ index: 0, status: "ok", elapsedMs: 7, output: "3", expected: "3", stdout: "hi|there\n", error: "" });
    expect(cases.get(1)?.status).toBe("error");
    expect(cases.get(1)?.error).toBe("java.lang.RuntimeException: boom");
    expect(cases.size).toBe(2);
  });

  it("ignores lines with the wrong token, bad status or wrong shape, and keeps the first line per index", () => {
    const out = [
      line(0, "ok", { output: "forged" }, "othertoken"),
      line(0, "weird"),
      `${TOKEN}|0|ok`,
      line(0, "ok", { output: "real" }),
      line(0, "ok", { output: "duplicate" }),
    ].join("\n");
    const cases = parseHarnessOutput(out, TOKEN);
    expect(cases.size).toBe(1);
    expect(cases.get(0)?.output).toBe("real");
  });
});

describe("truncate", () => {
  it("leaves short text alone and marks truncated text", () => {
    expect(truncate("abc")).toBe("abc");
    const long = "x".repeat(DISPLAY_LIMIT + 10);
    const result = truncate(long);
    expect(result.startsWith("x".repeat(DISPLAY_LIMIT))).toBe(true);
    expect(result.endsWith("… truncated (64 KB limit)")).toBe(true);
  });
});

describe("buildCaseResults", () => {
  it("marks accepted and wrong answers and carries inputs, expected and stdout", () => {
    const results = buildCaseResults(problem, harness(ok(0, "3", "3", "debug\n"), ok(1, "4", "5"), ok(2, "0", "0")), { kind: "exited" });
    expect(results[0]).toEqual({
      index: 0,
      input: [{ name: "nums", value: "[1,2]" }],
      expected: "3",
      verdict: "accepted",
      output: "3",
      stdout: "debug\n",
      elapsedMs: 3,
    });
    expect(results[1].verdict).toBe("wrong_answer");
    expect(results[1].output).toBe("4");
    expect(results[2].verdict).toBe("accepted");
  });

  it("compares against the normalized expected but displays the original", () => {
    const p: Problem = { ...problem, tests: [{ input: ["[1]"], expected: "1.00000" }] };
    const [result] = buildCaseResults(p, harness(ok(0, "1.0", "1.0")), { kind: "exited" });
    expect(result.verdict).toBe("accepted");
    expect(result.expected).toBe("1.00000");
  });

  it("reports runtime errors", () => {
    const results = buildCaseResults(
      problem,
      harness({ index: 0, status: "error", elapsedMs: 1, output: "", expected: "3", stdout: "before crash", error: "java.lang.IllegalStateException" }),
      { kind: "exited" },
    );
    expect(results[0]).toMatchObject({ verdict: "runtime_error", stdout: "before crash", error: "java.lang.IllegalStateException" });
    expect(results[0].output).toBeUndefined();
  });

  it("marks missing cases as time limit exceeded after a timeout", () => {
    const results = buildCaseResults(problem, harness(ok(0, "3", "3")), { kind: "timeout" });
    expect(results.map((r) => r.verdict)).toEqual(["accepted", "time_limit_exceeded", "time_limit_exceeded"]);
  });

  it("marks missing cases as runtime errors after a crash or early exit", () => {
    const crashed = buildCaseResults(problem, harness(ok(0, "3", "3")), { kind: "crashed", detail: "JVM died" });
    expect(crashed[1]).toMatchObject({ verdict: "runtime_error", error: "JVM died" });
    const exited = buildCaseResults(problem, harness(), { kind: "exited" });
    expect(exited[0]).toMatchObject({ verdict: "runtime_error", error: "The program exited before this case finished." });
  });

  it("compares full output before truncating it for display", () => {
    const big = "y".repeat(DISPLAY_LIMIT + 1);
    const [result] = buildCaseResults({ ...problem, tests: [problem.tests[0]] }, harness(ok(0, big, big)), { kind: "exited" });
    expect(result.verdict).toBe("accepted");
    expect(result.output!.length).toBeLessThan(big.length + 40);
    expect(result.output!.endsWith("… truncated (64 KB limit)")).toBe(true);
  });
});
