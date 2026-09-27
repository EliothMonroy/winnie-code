import { describe, expect, it } from "vitest";
import { collectIdentifiers } from "./identifiers";

function names(code: string): string[] {
  return collectIdentifiers(code)
    .map((i) => i.name)
    .sort();
}

describe("collectIdentifiers", () => {
  it("collects function parameters and the function name", () => {
    const code = "fun findMax(nums: IntArray, k: Int): Int {\n    return 0\n}";
    const ids = collectIdentifiers(code);
    expect(ids).toEqual(
      expect.arrayContaining([
        { name: "findMax", kind: "function" },
        { name: "nums", kind: "variable" },
        { name: "k", kind: "variable" },
      ]),
    );
  });

  it("collects val and var declarations", () => {
    const code = "val total = 0\nvar count = 1";
    expect(names(code)).toEqual(["count", "total"]);
  });

  it("collects destructuring val declarations", () => {
    const code = "val (a, b) = Pair(1, 2)";
    expect(names(code)).toEqual(["a", "b"]);
  });

  it("collects simple for-loop variables", () => {
    const code = "for (x in list) { println(x) }";
    expect(names(code)).toContain("x");
  });

  it("collects destructuring for-loop variables", () => {
    const code = "for ((i, v) in list.withIndex()) { println(i) }";
    const ids = names(code);
    expect(ids).toContain("i");
    expect(ids).toContain("v");
  });

  it("collects a for-loop variable over a range", () => {
    const code = "for (i in 0 until n) { println(i) }";
    expect(names(code)).toContain("i");
  });

  it("collects lambda parameters", () => {
    const code = "val sum = list.fold(0) { a, b -> a + b }";
    const ids = names(code);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
  });

  it("collects destructuring lambda parameters", () => {
    const code = "map.forEach { (k, v) -> println(k) }";
    const ids = names(code);
    expect(ids).toContain("k");
    expect(ids).toContain("v");
  });

  it("does not suggest the implicit it", () => {
    const code = "list.map { it * 2 }";
    expect(names(code)).not.toContain("it");
  });

  it("tags function names as function", () => {
    const code = "fun dfs(node: TreeNode?) {\n    dfs(node)\n}";
    const ids = collectIdentifiers(code);
    expect(ids.find((i) => i.name === "dfs")).toEqual({ name: "dfs", kind: "function" });
  });

  it("ignores names that only appear inside string literals", () => {
    const code = 'val message = "fun fake(x: Int) { val hidden = 1 }"';
    const ids = names(code);
    expect(ids).toContain("message");
    expect(ids).not.toContain("fake");
    expect(ids).not.toContain("x");
    expect(ids).not.toContain("hidden");
  });

  it("ignores names that only appear inside triple-quoted string literals", () => {
    const code = 'val text = """\n    val hidden = 1\n    fun fake(y: Int) {}\n"""';
    const ids = names(code);
    expect(ids).toContain("text");
    expect(ids).not.toContain("hidden");
    expect(ids).not.toContain("fake");
    expect(ids).not.toContain("y");
  });

  it("ignores names that only appear inside line comments", () => {
    const code = "val real = 1 // var ignored = 2";
    const ids = names(code);
    expect(ids).toContain("real");
    expect(ids).not.toContain("ignored");
  });

  it("ignores names that only appear inside block comments", () => {
    const code = "val real = 1 /* val ignored2 = 2\n fun hidden(z: Int) {} */";
    const ids = names(code);
    expect(ids).toContain("real");
    expect(ids).not.toContain("ignored2");
    expect(ids).not.toContain("hidden");
    expect(ids).not.toContain("z");
  });

  it("excludes Kotlin keywords", () => {
    const code = "fun run() {\n    for (i in 0 until 10) {\n        if (i > 5) return\n    }\n}";
    const ids = names(code);
    for (const kw of ["fun", "for", "in", "if", "return", "until"]) {
      expect(ids).not.toContain(kw);
    }
  });

  it("deduplicates repeated declarations", () => {
    const code = "val x = 1\nfun use() {\n    val x = 2\n    println(x)\n}";
    const ids = collectIdentifiers(code).filter((i) => i.name === "x");
    expect(ids).toHaveLength(1);
  });
});
