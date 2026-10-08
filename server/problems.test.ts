import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isValidSlug, listProblems, loadProblem, validateProblem } from "./problems";
import { FIXTURE_PROBLEMS } from "./test-helpers";

const valid = {
  title: "Two Sum",
  difficulty: "Easy",
  method: {
    name: "twoSum",
    params: [
      { name: "nums", type: "IntArray" },
      { name: "target", type: "Int" },
    ],
    returns: "IntArray",
  },
  tests: [{ input: ["[2,7,11,15]", "9"], expected: "[0,1]" }],
};

function withChanges(change: (p: any) => void): unknown {
  const copy = structuredClone(valid);
  change(copy);
  return copy;
}

describe("isValidSlug", () => {
  it("accepts kebab-case and rejects anything else", () => {
    expect(isValidSlug("two-sum")).toBe(true);
    expect(isValidSlug("3sum")).toBe(true);
    expect(isValidSlug("Two-Sum")).toBe(false);
    expect(isValidSlug("../etc")).toBe(false);
    expect(isValidSlug("a--b")).toBe(false);
    expect(isValidSlug("")).toBe(false);
  });
});

describe("validateProblem", () => {
  it("returns a typed problem", () => {
    const p = validateProblem("two-sum", valid, "desc");
    expect(p.slug).toBe("two-sum");
    expect(p.description).toBe("desc");
    expect(p.method.params[0]).toEqual({ name: "nums", type: { kind: "primArray", name: "IntArray" } });
    expect(p.method.returns).toEqual({ kind: "primArray", name: "IntArray" });
    expect(p.tests).toEqual(valid.tests);
  });

  it.each([
    ["not an object", [], /problem.json must be an object/],
    ["missing title", withChanges((p) => delete p.title), /title must be a string/],
    ["blank title", withChanges((p) => (p.title = "  ")), /title must not be empty/],
    ["bad difficulty", withChanges((p) => (p.difficulty = "Insane")), /difficulty must be one of Easy, Medium, Hard/],
    ["bad method name", withChanges((p) => (p.method.name = "two sum")), /not a valid Kotlin identifier/],
    ["duplicate params", withChanges((p) => (p.method.params[1].name = "nums")), /duplicate param name "nums"/],
    ["unknown type", withChanges((p) => (p.method.params[0].type = "Set<Int>")), /Invalid type "Set<Int>"/],
    ["no tests", withChanges((p) => (p.tests = [])), /tests must be a non-empty array/],
    ["input count mismatch", withChanges((p) => (p.tests[0].input = ["[1]"])), /tests\[0\].input has 1 values but the method has 2 params/],
    ["non-string input", withChanges((p) => (p.tests[0].input = [[1], "9"])), /tests\[0\].input must be an array of strings/],
    ["missing expected", withChanges((p) => delete p.tests[0].expected), /tests\[0\].expected must be a string/],
    ["empty input literal", withChanges((p) => (p.tests[0].input[0] = "")), /tests\[0\]\.input\[0\] must not be empty/],
    ["whitespace-only input literal", withChanges((p) => (p.tests[0].input[1] = "  ")), /tests\[0\]\.input\[1\] must not be empty/],
    ["empty expected literal", withChanges((p) => (p.tests[0].expected = "")), /tests\[0\]\.expected must not be empty/],
    ["whitespace-only expected literal", withChanges((p) => (p.tests[0].expected = "   ")), /tests\[0\]\.expected must not be empty/],
  ])("rejects %s", (_name, raw, message) => {
    expect(() => validateProblem("two-sum", raw, "")).toThrow(message);
  });
});

describe("loadProblem / listProblems", () => {
  let tmp: string | undefined;
  afterEach(async () => {
    if (tmp) await rm(tmp, { recursive: true, force: true });
    tmp = undefined;
  });

  it("loads a valid fixture", async () => {
    const entry = await loadProblem(FIXTURE_PROBLEMS, "sum-array");
    expect(entry?.ok).toBe(true);
    if (entry?.ok) {
      expect(entry.problem.title).toBe("Sum Array");
      expect(entry.problem.description).toContain("Return the sum");
    }
  });

  it("reports invalid problems as error entries", async () => {
    const entry = await loadProblem(FIXTURE_PROBLEMS, "broken");
    expect(entry).toEqual({ slug: "broken", ok: false, error: expect.stringMatching(/difficulty must be one of/) });
  });

  it("returns null for unknown or unsafe slugs", async () => {
    expect(await loadProblem(FIXTURE_PROBLEMS, "nope")).toBeNull();
    expect(await loadProblem(FIXTURE_PROBLEMS, "../problems")).toBeNull();
  });

  it("reports missing files and invalid JSON", async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), "winnie-problems-"));
    await mkdir(path.join(tmp, "no-json"));
    await mkdir(path.join(tmp, "bad-json"));
    await writeFile(path.join(tmp, "bad-json", "problem.json"), "{ nope");
    await writeFile(path.join(tmp, "bad-json", "description.md"), "x");
    await mkdir(path.join(tmp, "no-md"));
    await writeFile(path.join(tmp, "no-md", "problem.json"), JSON.stringify(valid));
    expect(await loadProblem(tmp, "no-json")).toMatchObject({ ok: false, error: "missing problem.json" });
    expect(await loadProblem(tmp, "bad-json")).toMatchObject({ ok: false, error: expect.stringMatching(/not valid JSON/) });
    expect(await loadProblem(tmp, "no-md")).toMatchObject({ ok: false, error: "missing description.md" });
  });

  it("lists every problem folder sorted by slug, skipping non-slug entries", async () => {
    const entries = await listProblems(FIXTURE_PROBLEMS);
    expect(entries.map((e) => e.slug)).toEqual([
      "average",
      "broken",
      "chunk-words",
      "count-values",
      "first-chars",
      "invert-tree",
      "map-lookup",
      "reverse-doubly-list",
      "reverse-list",
      "sum-array",
    ]);
  });

  it("returns an empty list when the directory does not exist", async () => {
    expect(await listProblems(path.join(os.tmpdir(), "winnie-does-not-exist"))).toEqual([]);
  });
});
