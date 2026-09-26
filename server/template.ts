import type { Method } from "./problems";
import { formatType, mentionsNode } from "./types";

const LIST_NODE_DOC = [
  "/**",
  " * Example:",
  " * var li = ListNode(5)",
  " * var v = li.`val`",
  " * Definition for singly-linked list.",
  " * class ListNode(var `val`: Int) {",
  " *     var next: ListNode? = null",
  " * }",
  " */",
].join("\n");

const TREE_NODE_DOC = [
  "/**",
  " * Example:",
  " * var ti = TreeNode(5)",
  " * var v = ti.`val`",
  " * Definition for a binary tree node.",
  " * class TreeNode(var `val`: Int) {",
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

  const params = method.params.map((p) => `${p.name}: ${formatType(p.type)}`).join(", ");
  const body = [
    "class Solution {",
    `    fun ${method.name}(${params}): ${formatType(method.returns)} {`,
    "        ",
    "    }",
    "}",
    "",
  ].join("\n");

  return docs.length > 0 ? `${docs.join("\n")}\n${body}` : body;
}
