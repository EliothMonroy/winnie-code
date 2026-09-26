import { describe, expect, it } from "vitest";
import { generateTemplate } from "./template";
import { parseType } from "./types";
import type { Method } from "./problems";

function method(name: string, params: [string, string][], returns: string): Method {
  return { name, params: params.map(([n, t]) => ({ name: n, type: parseType(t) })), returns: parseType(returns) };
}

describe("generateTemplate", () => {
  it("generates a Solution class with an empty method body", () => {
    expect(generateTemplate(method("twoSum", [["nums", "IntArray"], ["target", "Int"]], "IntArray"))).toBe(
      [
        "class Solution {",
        "    fun twoSum(nums: IntArray, target: Int): IntArray {",
        "        ",
        "    }",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("prefixes the ListNode definition comment when ListNode is used", () => {
    const text = generateTemplate(method("reverseList", [["head", "ListNode?"]], "ListNode?"));
    expect(text.startsWith("/**\n * Example:\n * var li = ListNode(5)")).toBe(true);
    expect(text).toContain(" * class ListNode(var `val`: Int) {");
    expect(text).not.toContain("TreeNode");
    expect(text).toContain("fun reverseList(head: ListNode?): ListNode? {");
  });

  it("includes both definitions when both node types appear, even nested", () => {
    const text = generateTemplate(method("f", [["lists", "Array<ListNode?>"]], "List<TreeNode?>"));
    expect(text).toContain(" * Definition for singly-linked list.");
    expect(text).toContain(" * Definition for a binary tree node.");
    expect(text.indexOf("ListNode(5)")).toBeLessThan(text.indexOf("TreeNode(5)"));
  });

  it("includes only the tree doc block for a TreeNode-only signature", () => {
    const text = generateTemplate(method("invertTree", [["root", "TreeNode?"]], "TreeNode?"));
    expect(text).toContain(" * Definition for a binary tree node.");
    expect(text).not.toContain("singly-linked list");
    expect(text).not.toContain("ListNode(5)");
  });

  it("backtick-quotes a param named `val`, a Kotlin hard keyword", () => {
    const text = generateTemplate(method("removeElement", [["nums", "IntArray"], ["val", "Int"]], "Int"));
    expect(text).toContain("fun removeElement(nums: IntArray, `val`: Int): Int {");
  });

  it("leaves a normal param name unchanged", () => {
    const text = generateTemplate(method("twoSum", [["nums", "IntArray"], ["target", "Int"]], "IntArray"));
    expect(text).toContain("fun twoSum(nums: IntArray, target: Int): IntArray {");
  });
});
