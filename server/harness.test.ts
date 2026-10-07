import { describe, expect, it } from "vitest";
import { decodeExpr, encodeCases, encodeExpr, generateMain } from "./harness";
import type { Problem } from "./problems";
import { parseType } from "./types";

const twoSum: Problem = {
  slug: "two-sum",
  title: "Two Sum",
  difficulty: "Easy",
  description: "",
  method: {
    name: "twoSum",
    params: [
      { name: "nums", type: parseType("IntArray") },
      { name: "target", type: parseType("Int") },
    ],
    returns: parseType("IntArray"),
  },
  tests: [{ input: ["[2,7,11,15]", "9"], expected: "[0,1]" }],
};

describe("decodeExpr", () => {
  it("decodes scalars", () => {
    expect(decodeExpr(parseType("Int"), "l")).toBe("WinnieIO.int(l)");
    expect(decodeExpr(parseType("String"), "l")).toBe("WinnieIO.str(l)");
    expect(decodeExpr(parseType("Boolean"), "l")).toBe("WinnieIO.bool(l)");
  });

  it("decodes primitive arrays", () => {
    expect(decodeExpr(parseType("IntArray"), "l")).toBe("WinnieIO.items(l).map { x1 -> WinnieIO.int(x1) }.toIntArray()");
  });

  it("uses distinct lambda names when nesting", () => {
    expect(decodeExpr(parseType("List<List<String>>"), "l")).toBe(
      "WinnieIO.items(l).map { x1 -> WinnieIO.items(x1).map { x2 -> WinnieIO.str(x2) } }",
    );
    expect(decodeExpr(parseType("Array<CharArray>"), "l")).toBe(
      "WinnieIO.items(l).map { x1 -> WinnieIO.items(x1).map { x2 -> WinnieIO.char(x2) }.toCharArray() }.toTypedArray()",
    );
  });

  it("decodes nodes", () => {
    expect(decodeExpr(parseType("ListNode?"), "l")).toBe("WinnieIO.listNode(l)");
    expect(decodeExpr(parseType("DoublyListNode?"), "l")).toBe("WinnieIO.doublyListNode(l)");
    expect(decodeExpr(parseType("Array<TreeNode?>"), "l")).toBe(
      "WinnieIO.items(l).map { x1 -> WinnieIO.treeNode(x1) }.toTypedArray()",
    );
  });
});

describe("encodeExpr", () => {
  it("encodes scalars and nodes", () => {
    expect(encodeExpr(parseType("Double"), "v")).toBe("WinnieIO.encDouble(v)");
    expect(encodeExpr(parseType("Char"), "v")).toBe("WinnieIO.encChar(v)");
    expect(encodeExpr(parseType("TreeNode?"), "v")).toBe("WinnieIO.encTreeNode(v)");
    expect(encodeExpr(parseType("DoublyListNode?"), "v")).toBe("WinnieIO.encDoublyListNode(v)");
  });

  it("encodes collections recursively", () => {
    expect(encodeExpr(parseType("IntArray"), "v")).toBe("WinnieIO.encSeq(v.map { y1 -> WinnieIO.encInt(y1) })");
    expect(encodeExpr(parseType("List<Array<String>>"), "v")).toBe(
      "WinnieIO.encSeq(v.map { y1 -> WinnieIO.encSeq(y1.map { y2 -> WinnieIO.encStr(y2) }) })",
    );
  });
});

describe("generateMain", () => {
  it("run mode decodes each param, calls the solution and encodes the result", () => {
    const src = generateMain(twoSum, "run");
    expect(src).toContain("fun main(args: Array<String>) {");
    expect(src).toContain("WinnieRunner.run(");
    expect(src).toContain(
      "normalizeExpected = { expected -> WinnieIO.encSeq(WinnieIO.items(WinnieIO.parse(expected)).map { x1 -> WinnieIO.int(x1) }.toIntArray().map { y1 -> WinnieIO.encInt(y1) }) },",
    );
    expect(src).toContain("val p0: IntArray = WinnieIO.items(WinnieIO.parse(input[0])).map { x1 -> WinnieIO.int(x1) }.toIntArray()");
    expect(src).toContain("val p1: Int = WinnieIO.int(WinnieIO.parse(input[1]))");
    expect(src).toContain("val result: IntArray = Solution().twoSum(p0, p1)");
    expect(src).toContain("WinnieIO.encSeq(result.map { y1 -> WinnieIO.encInt(y1) })");
  });

  it("check mode parses inputs without referencing Solution", () => {
    const src = generateMain(twoSum, "check");
    expect(src).toContain("val p0: IntArray =");
    expect(src).not.toContain("Solution");
  });
});

describe("encodeCases", () => {
  it("writes one line per test: base64 inputs followed by base64 expected", () => {
    const text = encodeCases([
      { input: ["[1,2]", "\"a b\""], expected: "3" },
      { input: ["[]", "\"\""], expected: "0" },
    ]);
    const lines = text.trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    const decode = (line: string) => line.split(" ").map((f) => Buffer.from(f, "base64").toString("utf8"));
    expect(decode(lines[0])).toEqual(["[1,2]", "\"a b\"", "3"]);
    expect(decode(lines[1])).toEqual(["[]", "\"\"", "0"]);
  });
});
