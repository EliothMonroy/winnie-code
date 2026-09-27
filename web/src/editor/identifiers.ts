/**
 * Pure, framework-free scanner that collects the names a Kotlin solution declares:
 * function names, function parameters, val/var declarations (including destructuring),
 * for-loop variables (including destructuring), and lambda parameters (excluding the
 * implicit `it`).
 *
 * Scope-unaware by design: the whole document is scanned every time, and a name
 * declared anywhere is a candidate everywhere. Keywords are excluded and the result
 * is deduplicated by name.
 */

export type IdentifierKind = "variable" | "function";

export type Identifier = { name: string; kind: IdentifierKind };

const KEYWORDS = new Set([
  // hard keywords
  "as",
  "break",
  "class",
  "continue",
  "do",
  "else",
  "false",
  "for",
  "fun",
  "if",
  "in",
  "interface",
  "is",
  "null",
  "object",
  "package",
  "return",
  "super",
  "this",
  "throw",
  "true",
  "try",
  "typealias",
  "typeof",
  "val",
  "var",
  "when",
  "while",
  // soft / modifier keywords commonly seen in solutions
  "by",
  "catch",
  "constructor",
  "delegate",
  "dynamic",
  "field",
  "file",
  "finally",
  "get",
  "import",
  "init",
  "param",
  "property",
  "receiver",
  "set",
  "setparam",
  "where",
  "actual",
  "abstract",
  "annotation",
  "companion",
  "const",
  "crossinline",
  "data",
  "enum",
  "expect",
  "external",
  "final",
  "infix",
  "inline",
  "inner",
  "internal",
  "lateinit",
  "noinline",
  "open",
  "operator",
  "out",
  "override",
  "private",
  "protected",
  "public",
  "reified",
  "sealed",
  "suspend",
  "tailrec",
  "vararg",
  "it",
  "until",
  "downTo",
  "step",
]);

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Replaces the content of string/char literals and comments with spaces, keeping line breaks. */
function stripStringsAndComments(code: string): string {
  let out = "";
  let i = 0;
  const n = code.length;

  const maskUntil = (predicate: () => boolean) => {
    while (i < n && !predicate()) {
      out += code[i] === "\n" ? "\n" : " ";
      i++;
    }
  };

  while (i < n) {
    const c = code[i];
    const c2 = code[i + 1];

    if (c === "/" && c2 === "/") {
      while (i < n && code[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }

    if (c === "/" && c2 === "*") {
      out += "  ";
      i += 2;
      maskUntil(() => code[i] === "*" && code[i + 1] === "/");
      if (i < n) {
        out += "  ";
        i += 2;
      }
      continue;
    }

    if (c === '"' && c2 === '"' && code[i + 2] === '"') {
      out += "   ";
      i += 3;
      maskUntil(() => code[i] === '"' && code[i + 1] === '"' && code[i + 2] === '"');
      if (i < n) {
        out += "   ";
        i += 3;
      }
      continue;
    }

    if (c === '"') {
      out += " ";
      i++;
      while (i < n && code[i] !== '"') {
        if (code[i] === "\\") {
          out += "  ";
          i += 2;
          continue;
        }
        out += code[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < n) {
        out += " ";
        i++;
      }
      continue;
    }

    if (c === "'") {
      out += " ";
      i++;
      while (i < n && code[i] !== "'") {
        if (code[i] === "\\") {
          out += "  ";
          i += 2;
          continue;
        }
        out += " ";
        i++;
      }
      if (i < n) {
        out += " ";
        i++;
      }
      continue;
    }

    out += c;
    i++;
  }

  return out;
}

/** Finds the index of the `)` matching the `(` at `openIndex`. */
function findMatchingParen(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Splits on top-level commas, respecting nested (), [], {} and <>. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[" || ch === "{" || ch === "<") depth++;
    else if (ch === ")" || ch === "]" || ch === "}" || ch === ">") depth--;
    if (ch === "," && depth <= 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/** Extracts the leading declared name from a parameter/destructuring entry, e.g. "vararg nums: Int" -> "nums". */
function extractLeadingName(part: string): string | null {
  const text = part.trim().replace(/^(vararg|crossinline|noinline|val|var)\s+/, "");
  const match = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(text);
  return match ? match[1] : null;
}

export function collectIdentifiers(code: string): Identifier[] {
  const clean = stripStringsAndComments(code);
  const results = new Map<string, IdentifierKind>();

  const add = (name: string | null, kind: IdentifierKind) => {
    if (!name || name === "_" || name === "it" || KEYWORDS.has(name) || !IDENTIFIER.test(name)) return;
    if (results.get(name) === "function") return;
    results.set(name, kind);
  };

  // Function declarations and their parameter lists.
  const funRe = /\bfun\s+(?:<[^>]*>\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = funRe.exec(clean))) {
    add(m[1], "function");
    const openIdx = m.index + m[0].length - 1;
    const closeIdx = findMatchingParen(clean, openIdx);
    if (closeIdx === -1) continue;
    const paramsText = clean.slice(openIdx + 1, closeIdx);
    for (const part of splitTopLevel(paramsText)) {
      add(extractLeadingName(part), "variable");
    }
  }

  // Simple val/var declarations.
  const simpleRe = /\b(?:val|var)\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  while ((m = simpleRe.exec(clean))) add(m[1], "variable");

  // Destructuring val/var declarations: val (a, b) = ...
  const destructureRe = /\b(?:val|var)\s*\(([^()]*)\)/g;
  while ((m = destructureRe.exec(clean))) {
    for (const part of splitTopLevel(m[1])) add(extractLeadingName(part), "variable");
  }

  // for (x in ...)
  const forSimpleRe = /\bfor\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s+in\b/g;
  while ((m = forSimpleRe.exec(clean))) add(m[1], "variable");

  // for ((i, v) in ...)
  const forDestructureRe = /\bfor\s*\(\s*\(([^()]*)\)\s+in\b/g;
  while ((m = forDestructureRe.exec(clean))) {
    for (const part of splitTopLevel(m[1])) add(extractLeadingName(part), "variable");
  }

  // Lambda parameter lists: { a, b -> ... } and { (k, v) -> ... }
  const lambdaRe = /\{\s*([^{}]*?)->/g;
  while ((m = lambdaRe.exec(clean))) {
    const paramsText = m[1];
    if (!/^[\s,()A-Za-z0-9_:<>?.[\]]*$/.test(paramsText)) continue;
    for (const part of splitTopLevel(paramsText)) {
      if (part.startsWith("(") && part.endsWith(")")) {
        for (const inner of splitTopLevel(part.slice(1, -1))) add(extractLeadingName(inner), "variable");
      } else {
        add(extractLeadingName(part), "variable");
      }
    }
  }

  return [...results.entries()].map(([name, kind]) => ({ name, kind }));
}
