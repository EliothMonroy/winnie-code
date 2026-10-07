export type ScalarName = "Int" | "Long" | "Double" | "Boolean" | "Char" | "String";
export type PrimArrayName = "IntArray" | "LongArray" | "DoubleArray" | "BooleanArray" | "CharArray";
export type NodeName = "ListNode" | "TreeNode" | "DoublyListNode";

export type KType =
  | { kind: "scalar"; name: ScalarName }
  | { kind: "primArray"; name: PrimArrayName }
  | { kind: "array"; of: KType }
  | { kind: "list"; of: KType }
  | { kind: "node"; name: NodeName };

const SCALARS: readonly string[] = ["Int", "Long", "Double", "Boolean", "Char", "String"];
const NODES: readonly string[] = ["ListNode", "TreeNode", "DoublyListNode"];

const PRIM_ARRAY_ELEMENTS: Record<PrimArrayName, ScalarName> = {
  IntArray: "Int",
  LongArray: "Long",
  DoubleArray: "Double",
  BooleanArray: "Boolean",
  CharArray: "Char",
};

export function primArrayElement(name: PrimArrayName): ScalarName {
  return PRIM_ARRAY_ELEMENTS[name];
}

/** Parses a Kotlin type such as `List<List<Int>>` or `TreeNode?`. Throws on unsupported types. */
export function parseType(text: string): KType {
  const src = text.replace(/\s+/g, "");
  let pos = 0;

  function fail(message: string): never {
    throw new Error(`Invalid type "${text}": ${message}`);
  }

  function ident(): string {
    const match = /^[A-Za-z]+/.exec(src.slice(pos));
    if (!match) fail(`expected a type name at position ${pos}`);
    pos += match[0].length;
    return match[0];
  }

  function expect(ch: string): void {
    if (src[pos] !== ch) fail(`expected "${ch}" at position ${pos}`);
    pos++;
  }

  function type(): KType {
    const name = ident();
    if (name === "List" || name === "Array") {
      expect("<");
      const of = type();
      expect(">");
      return { kind: name === "List" ? "list" : "array", of };
    }
    if (NODES.includes(name)) {
      if (src[pos] !== "?") fail(`write "${name}?" (nullable), as LeetCode does`);
      pos++;
      return { kind: "node", name: name as NodeName };
    }
    if (SCALARS.includes(name)) return { kind: "scalar", name: name as ScalarName };
    if (Object.hasOwn(PRIM_ARRAY_ELEMENTS, name)) return { kind: "primArray", name: name as PrimArrayName };
    fail(`unknown type "${name}"`);
  }

  const result = type();
  if (pos !== src.length) fail(`unexpected "${src.slice(pos)}"`);
  return result;
}

export function formatType(t: KType): string {
  switch (t.kind) {
    case "scalar":
    case "primArray":
      return t.name;
    case "node":
      return `${t.name}?`;
    case "array":
      return `Array<${formatType(t.of)}>`;
    case "list":
      return `List<${formatType(t.of)}>`;
  }
}

export function mentionsNode(t: KType, name: NodeName): boolean {
  if (t.kind === "node") return t.name === name;
  if (t.kind === "array" || t.kind === "list") return mentionsNode(t.of, name);
  return false;
}
