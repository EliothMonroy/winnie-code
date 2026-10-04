import { beforeAll, describe, expect, it } from "vitest";
import type { RunResponse } from "../shared/api";
import { loadProblem, type Problem } from "./problems";
import { checkProblemLiterals, runSolution } from "./runner";
import { FIXTURE_PROBLEMS, getTestToolchain } from "./test-helpers";
import type { Toolchain } from "./toolchain";
import { parseType } from "./types";

let tc: Toolchain;
beforeAll(async () => {
  tc = await getTestToolchain();
});

async function fixture(slug: string): Promise<Problem> {
  const entry = await loadProblem(FIXTURE_PROBLEMS, slug);
  if (!entry?.ok) throw new Error(`fixture ${slug} failed to load`);
  return entry.problem;
}

function expectRan(res: RunResponse): Extract<RunResponse, { status: "ran" }> {
  if (res.status !== "ran") throw new Error(`expected status "ran" but got ${JSON.stringify(res, null, 2)}`);
  return res;
}

describe.concurrent("runSolution", () => {
  it("accepts a correct solution and captures println output per case", async () => {
    const code = [
      "class Solution {",
      "    fun sum(nums: IntArray): Int {",
      '        println("size=${nums.size}")',
      "        return nums.sum()",
      "    }",
      "}",
    ].join("\n");
    const res = expectRan(await runSolution(tc, await fixture("sum-array"), code));
    expect(res.passed).toBe(3);
    expect(res.total).toBe(3);
    expect(res.cases.map((c) => c.verdict)).toEqual(["accepted", "accepted", "accepted"]);
    expect(res.cases[0].stdout).toBe("size=3\n");
    expect(res.cases[0].input).toEqual([{ name: "nums", value: "[1,2,3]" }]);
    expect(res.elapsedMs).toBeGreaterThan(0);
    // Every case's per-case time must be a real, finite number (never NaN/negative), and cases after
    // the first (which pays for JVM class loading) should be able to report sub-millisecond times with
    // fractional precision rather than truncating to a misleading "0".
    for (const c of res.cases) {
      expect(Number.isFinite(c.elapsedMs)).toBe(true);
      expect(c.elapsedMs).toBeGreaterThanOrEqual(0);
    }
    expect(res.cases.some((c) => c.elapsedMs !== undefined && !Number.isInteger(c.elapsedMs))).toBe(true);
  });

  it("reports wrong answers with the actual output", async () => {
    const res = expectRan(await runSolution(tc, await fixture("sum-array"), "class Solution { fun sum(nums: IntArray): Int = 42 }"));
    expect(res.passed).toBe(0);
    expect(res.cases[0]).toMatchObject({ verdict: "wrong_answer", output: "42", expected: "6" });
  });

  it("reports compile errors on the user's own line numbers", async () => {
    const code = ["class Solution {", "    fun sum(nums: IntArray): Int {", "        return nums.summ()", "    }", "}"].join("\n");
    const res = await runSolution(tc, await fixture("sum-array"), code);
    expect(res.status).toBe("compile_error");
    if (res.status !== "compile_error") return;
    expect(res.diagnostics[0]).toMatchObject({ line: 3, severity: "error" });
    expect(res.diagnostics[0].message).toContain("summ");
    expect(res.raw).toContain("Solution.kt:3:");
  });

  it("isolates runtime errors to the failing case", async () => {
    const code = [
      "class Solution {",
      "    fun sum(nums: IntArray): Int {",
      '        if (nums.isEmpty()) throw IllegalStateException("empty!")',
      "        return nums.sum()",
      "    }",
      "}",
    ].join("\n");
    const res = expectRan(await runSolution(tc, await fixture("sum-array"), code));
    expect(res.cases.map((c) => c.verdict)).toEqual(["accepted", "runtime_error", "accepted"]);
    expect(res.cases[1].error).toContain("java.lang.IllegalStateException: empty!");
    expect(res.cases[1].error).toContain("Solution.kt:3");
  });

  it("stops infinite loops with time limit exceeded", async () => {
    const code = [
      "class Solution {",
      "    fun sum(nums: IntArray): Int {",
      "        if (nums.size == 2) while (true) {}",
      "        return nums.sum()",
      "    }",
      "}",
    ].join("\n");
    const res = expectRan(await runSolution(tc, await fixture("sum-array"), code, 4_000));
    expect(res.cases.map((c) => c.verdict)).toEqual(["accepted", "accepted", "time_limit_exceeded"]);
  });

  it("supports deep recursion and reports stack overflows as runtime errors", async () => {
    const code = [
      "class Solution {",
      "    fun depth(n: Int): Int = if (n == 0) 0 else 1 + depth(n - 1)",
      "    fun forever(n: Int): Int = 1 + forever(n + 1)",
      "    fun sum(nums: IntArray): Int {",
      "        if (nums.isEmpty()) return forever(0)",
      "        return nums.sum() + depth(200_000) - 200_000",
      "    }",
      "}",
    ].join("\n");
    const res = expectRan(await runSolution(tc, await fixture("sum-array"), code));
    expect(res.cases.map((c) => c.verdict)).toEqual(["accepted", "runtime_error", "accepted"]);
    expect(res.cases[1].error).toContain("StackOverflowError");
  });

  it("handles linked lists", async () => {
    const code = [
      "class Solution {",
      "    fun reverseList(head: ListNode?): ListNode? {",
      "        var prev: ListNode? = null",
      "        var cur = head",
      "        while (cur != null) {",
      "            val next = cur.next",
      "            cur.next = prev",
      "            prev = cur",
      "            cur = next",
      "        }",
      "        return prev",
      "    }",
      "}",
    ].join("\n");
    const res = expectRan(await runSolution(tc, await fixture("reverse-list"), code));
    expect(res.passed).toBe(3);
  });

  it("handles binary trees", async () => {
    const code = [
      "class Solution {",
      "    fun invertTree(root: TreeNode?): TreeNode? {",
      "        if (root == null) return null",
      "        val left = invertTree(root.left)",
      "        root.left = invertTree(root.right)",
      "        root.right = left",
      "        return root",
      "    }",
      "}",
    ].join("\n");
    const res = expectRan(await runSolution(tc, await fixture("invert-tree"), code));
    expect(res.passed).toBe(3);
  });

  it("exposes node values as `.value` on ListNode and TreeNode", async () => {
    const listCode = [
      "class Solution {",
      "    fun reverseList(head: ListNode?): ListNode? {",
      "        var result: ListNode? = null",
      "        var cur = head",
      "        while (cur != null) {",
      "            val node = ListNode(cur.value)",
      "            node.next = result",
      "            result = node",
      "            cur = cur.next",
      "        }",
      "        return result",
      "    }",
      "}",
    ].join("\n");
    expect(expectRan(await runSolution(tc, await fixture("reverse-list"), listCode)).passed).toBe(3);

    const treeCode = [
      "class Solution {",
      "    fun invertTree(root: TreeNode?): TreeNode? {",
      "        if (root == null) return null",
      "        val copy = TreeNode(root.value)",
      "        copy.left = invertTree(root.right)",
      "        copy.right = invertTree(root.left)",
      "        return copy",
      "    }",
      "}",
    ].join("\n");
    expect(expectRan(await runSolution(tc, await fixture("invert-tree"), treeCode)).passed).toBe(3);
  });

  it("handles nested lists with escaped strings", async () => {
    const code = "class Solution { fun chunk(words: List<String>, size: Int): List<List<String>> = words.chunked(size) }";
    const res = expectRan(await runSolution(tc, await fixture("chunk-words"), code));
    expect(res.passed).toBe(2);
  });

  it("normalizes doubles before comparing", async () => {
    const code = "class Solution { fun average(nums: IntArray): Double = nums.average() }";
    const res = expectRan(await runSolution(tc, await fixture("average"), code));
    expect(res.passed).toBe(2);
    expect(res.cases[0]).toMatchObject({ output: "1.5", expected: "1.50000" });
  });

  it("handles Array<String> params and CharArray results", async () => {
    const code = "class Solution { fun firstChars(words: Array<String>): CharArray = words.map { it[0] }.toCharArray() }";
    const res = expectRan(await runSolution(tc, await fixture("first-chars"), code));
    expect(res.passed).toBe(1);
  });

  it("compiles and runs a solution whose param is a Kotlin hard keyword (val), matching the generated template's style", async () => {
    const problem: Problem = {
      slug: "count-value",
      title: "Count Value",
      difficulty: "Easy",
      description: "",
      method: {
        name: "countValue",
        params: [
          { name: "nums", type: parseType("IntArray") },
          { name: "val", type: parseType("Int") },
        ],
        returns: parseType("Int"),
      },
      tests: [{ input: ["[1,2,2]", "2"], expected: "2" }],
    };
    const code = "class Solution { fun countValue(nums: IntArray, `val`: Int): Int = nums.count { it == `val` } }";
    const res = expectRan(await runSolution(tc, problem, code));
    expect(res.passed).toBe(1);
    expect(res.total).toBe(1);
  });

  it("prepends a friendly hint when the Solution signature does not match the problem's method", async () => {
    const code = "class Solution { fun total(nums: IntArray): Int = nums.sum() }";
    const res = await runSolution(tc, await fixture("sum-array"), code);
    expect(res.status).toBe("compile_error");
    if (res.status !== "compile_error") return;
    expect(res.diagnostics).toEqual([]);
    expect(res.raw.startsWith("Your Solution class must keep the method signature: fun sum(nums: IntArray): Int")).toBe(true);
  });
});

describe.concurrent("checkProblemLiterals", () => {
  it("accepts valid fixtures", async () => {
    for (const slug of ["sum-array", "reverse-list", "invert-tree", "chunk-words", "average", "first-chars"]) {
      expect(await checkProblemLiterals(tc, await fixture(slug)), slug).toEqual([]);
    }
  });

  it("reports literals that do not match the declared types", async () => {
    const base = await fixture("sum-array");
    const broken: Problem = {
      ...base,
      tests: [
        { input: ["[1,2"], expected: "3" },
        { input: ["[1,2]"], expected: "\"three\"" },
        { input: ["[1,2]"], expected: "3" },
      ],
    };
    const errors = await checkProblemLiterals(tc, broken);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/^tests\[0\]: .*Invalid literal/);
    expect(errors[1]).toMatch(/^tests\[1\]: Invalid expected value in problem.json: Expected an Int/);
  });
});
