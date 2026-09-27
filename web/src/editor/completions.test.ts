import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { userCompletionSource } from "./completions";

function contextAt(doc: string, pos: number, explicit = false): CompletionContext {
  const state = EditorState.create({ doc });
  return new CompletionContext(state, pos, explicit);
}

describe("userCompletionSource", () => {
  it("suggests matching user names for a prefix", () => {
    const doc = "fun findMax(nums: IntArray, k: Int): Int {\n    return n\n}";
    const pos = doc.indexOf("return n") + "return n".length;
    const result = userCompletionSource(contextAt(doc, pos));
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain("nums");
    expect(labels).not.toContain("k");
    expect(labels).not.toContain("findMax");
  });

  it("returns nothing when what's typed exactly equals the only match", () => {
    const doc = "val total = 0\nfun use() {\n    total\n}";
    const pos = doc.lastIndexOf("total") + "total".length;
    const result = userCompletionSource(contextAt(doc, pos));
    expect(result).toBeNull();
  });

  it("returns nothing for a document without declarations", () => {
    const doc = "prin";
    const result = userCompletionSource(contextAt(doc, doc.length));
    expect(result).toBeNull();
  });

  it("does not include legacy word-list junk, only declared names", () => {
    const doc = "val security = 1\nfun use() {\n    sec\n}";
    const pos = doc.indexOf("sec") + "sec".length;
    const result = userCompletionSource(contextAt(doc, pos));
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toEqual(["security"]);
  });
});
