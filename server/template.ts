import type { Method } from "./problems";
import { formatType, mentionsNode } from "./types";

/** Kotlin hard keywords: identifiers that must be backtick-quoted to be used as names. */
const HARD_KEYWORDS = new Set([
  "as", "break", "class", "continue", "do", "else", "false", "for", "fun", "if", "in", "interface", "is", "null",
  "object", "package", "return", "super", "this", "throw", "true", "try", "typealias", "typeof", "val", "var",
  "when", "while",
]);

/** Wraps a name in backticks if it is a Kotlin hard keyword (e.g. a `val` param), otherwise returns it unchanged. */
function quoteIfKeyword(name: string): string {
  return HARD_KEYWORDS.has(name) ? `\`${name}\`` : name;
}

/** Formats a method signature LeetCode-style, e.g. `fun removeElement(nums: IntArray, \`val\`: Int): Int`. */
export function formatSignature(method: Method): string {
  const params = method.params.map((p) => `${quoteIfKeyword(p.name)}: ${formatType(p.type)}`).join(", ");
  return `fun ${quoteIfKeyword(method.name)}(${params}): ${formatType(method.returns)}`;
}

const LIST_NODE_DOC = [
  "/**",
  " * Example:",
  " * var li = ListNode(5)",
  " * var v = li.value",
  " * Definition for singly-linked list.",
  " * class ListNode(var value: Int) {",
  " *     var next: ListNode? = null",
  " * }",
  " */",
].join("\n");

const TREE_NODE_DOC = [
  "/**",
  " * Example:",
  " * var ti = TreeNode(5)",
  " * var v = ti.value",
  " * Definition for a binary tree node.",
  " * class TreeNode(var value: Int) {",
  " *     var left: TreeNode? = null",
  " *     var right: TreeNode? = null",
  " * }",
  " */",
].join("\n");

/** Builds the starting code shown in the editor, LeetCode-style. */
export function generateTemplate(method: Method): string {
  const types = [...method.params.map((p) => p.type), method.returns];
  const docs: string[] = [];
  if (types.some((t) => mentionsNode(t, "ListNode"))) docs.push(LIST_NODE_DOC);
  if (types.some((t) => mentionsNode(t, "TreeNode"))) docs.push(TREE_NODE_DOC);

  const body = [
    "class Solution {",
    `    ${formatSignature(method)} {`,
    "        ",
    "    }",
    "}",
    "",
  ].join("\n");

  return docs.length > 0 ? `${docs.join("\n")}\n${body}` : body;
}
