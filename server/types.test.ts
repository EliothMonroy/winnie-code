import { describe, expect, it } from "vitest";
import { formatType, mentionsNode, parseType, primArrayElement } from "./types";

describe("parseType", () => {
  it("parses scalars", () => {
    expect(parseType("Int")).toEqual({ kind: "scalar", name: "Int" });
    expect(parseType("String")).toEqual({ kind: "scalar", name: "String" });
  });

  it("parses primitive arrays", () => {
    expect(parseType("IntArray")).toEqual({ kind: "primArray", name: "IntArray" });
    expect(parseType("CharArray")).toEqual({ kind: "primArray", name: "CharArray" });
  });

  it("parses nested generics and ignores whitespace", () => {
    expect(parseType("List< List<Int> >")).toEqual({
      kind: "list",
      of: { kind: "list", of: { kind: "scalar", name: "Int" } },
    });
    expect(parseType("Array<IntArray>")).toEqual({
      kind: "array",
      of: { kind: "primArray", name: "IntArray" },
    });
  });

  it("parses nullable nodes, including inside collections", () => {
    expect(parseType("TreeNode?")).toEqual({ kind: "node", name: "TreeNode" });
    expect(parseType("DoublyListNode?")).toEqual({ kind: "node", name: "DoublyListNode" });
    expect(parseType("Array<ListNode?>")).toEqual({
      kind: "array",
      of: { kind: "node", name: "ListNode" },
    });
  });

  it("parses hash maps, including nested value types", () => {
    expect(parseType("HashMap<Int, Int>")).toEqual({
      kind: "map",
      key: { kind: "scalar", name: "Int" },
      value: { kind: "scalar", name: "Int" },
    });
    expect(parseType("HashMap<String,List<Int>>")).toEqual({
      kind: "map",
      key: { kind: "scalar", name: "String" },
      value: { kind: "list", of: { kind: "scalar", name: "Int" } },
    });
  });

  it("rejects hash maps with unsupported keys or a missing value type", () => {
    expect(() => parseType("HashMap<Double, Int>")).toThrow(/HashMap keys must be Int, Long, String, Char or Boolean/);
    expect(() => parseType("HashMap<IntArray, Int>")).toThrow(/HashMap keys must be/);
    expect(() => parseType("HashMap<ListNode?, Int>")).toThrow(/HashMap keys must be/);
    expect(() => parseType("HashMap<Int>")).toThrow(/expected ","/);
    expect(() => parseType("Map<Int, Int>")).toThrow(/unknown type "Map"/);
  });

  it("rejects non-nullable nodes", () => {
    expect(() => parseType("ListNode")).toThrow(/ListNode\?/);
    expect(() => parseType("DoublyListNode")).toThrow(/DoublyListNode\?/);
  });

  it("rejects unknown types and junk", () => {
    expect(() => parseType("Map<Int,Int>")).toThrow(/Invalid type "Map<Int,Int>"/);
    expect(() => parseType("toString")).toThrow(/unknown type/);
    expect(() => parseType("List<Int")).toThrow(/expected ">"/);
    expect(() => parseType("Int?")).toThrow(/unexpected/);
    expect(() => parseType("")).toThrow(/expected a type name/);
  });
});

describe("formatType", () => {
  it("round-trips through parseType", () => {
    for (const text of ["Int", "IntArray", "List<List<String>>", "Array<CharArray>", "ListNode?", "Array<TreeNode?>", "DoublyListNode?", "HashMap<Int, Int>", "HashMap<String, List<Int>>"]) {
      expect(formatType(parseType(text))).toBe(text);
    }
  });
});

describe("helpers", () => {
  it("maps primitive arrays to their element type", () => {
    expect(primArrayElement("IntArray")).toBe("Int");
    expect(primArrayElement("BooleanArray")).toBe("Boolean");
    expect(primArrayElement("CharArray")).toBe("Char");
  });

  it("detects node usage at any depth", () => {
    expect(mentionsNode(parseType("List<Array<ListNode?>>"), "ListNode")).toBe(true);
    expect(mentionsNode(parseType("List<Array<ListNode?>>"), "TreeNode")).toBe(false);
    expect(mentionsNode(parseType("Int"), "TreeNode")).toBe(false);
    expect(mentionsNode(parseType("DoublyListNode?"), "DoublyListNode")).toBe(true);
    expect(mentionsNode(parseType("DoublyListNode?"), "ListNode")).toBe(false);
    expect(mentionsNode(parseType("ListNode?"), "DoublyListNode")).toBe(false);
    expect(mentionsNode(parseType("HashMap<Int, ListNode?>"), "ListNode")).toBe(true);
    expect(mentionsNode(parseType("HashMap<Int, Int>"), "ListNode")).toBe(false);
  });
});
