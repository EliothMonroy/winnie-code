# Winnie Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Winnie Code, a locally-run LeetCode-style judge for Kotlin: a browser editor with a Run button that compiles the user's `Solution` class with `kotlinc` and checks it against the problem's test cases.

**Architecture:** A Node + TypeScript Fastify server loads problems from `problems/<slug>/`. For each Run it generates a `Main.kt` harness, compiles it with the user's `Solution.kt` against a precompiled Kotlin support jar, runs it with `java` under a timeout, and parses the tagged per-case output. A React + Vite frontend with CodeMirror 6 provides the editor, problem description and results UI. It has a responsive split layout and light/dark themes.

**Tech Stack:** Node 26, TypeScript 5.9, Fastify 5, React 19, Vite 8, CodeMirror 6, react-markdown 10, Vitest 5, Kotlin 2.4 (`kotlinc`), JDK 21.

**Spec:** `docs/superpowers/specs/2026-09-26-winnie-code-design.md`

## Global Constraints

- Kotlin is the only supported language. There are no bundled problems: `problems/` ships empty (only `.gitkeep`).
- The app runs on localhost only. There is no auth or sandboxing. The server binds `127.0.0.1`.
- The server exits at startup with a clear message if `kotlinc` or `java` is not on `PATH`.
- Supported types: `Int`, `Long`, `Double`, `Boolean`, `Char`, `String`, `IntArray`, `LongArray`, `DoubleArray`, `BooleanArray`, `CharArray`, `Array<T>`, `List<T>` (nested), `ListNode?`, `TreeNode?`.
- Test literals use LeetCode notation. `ListNode?`/`TreeNode?` use `[]` for `null`, and trees are level-order with `null` holes.
- Answer comparison is exact string equality after both sides are normalized through the same parse and serialize step.
- Run limits: 10 s wall clock per run, `-Xmx256m`, and cases execute on a thread with a 256 MB stack. Per-case stdout, output and error are truncated to 64 KB for display.
- The user's code is written to `Solution.kt` byte-for-byte, so compiler line numbers map 1:1 to the editor.
- Dev: `npm run dev` runs the API on port 5174 and Vite on 5173 (proxying `/api`). Prod: `npm start` builds the web app and serves it from the API server on 5174.
- The desktop layout applies at `min-width: 900px`. Narrower screens use Description / Code / Results tabs.
- Theme: light / dark / system. System is the default. The choice is stored in `localStorage` key `winnie:theme` and applied as `data-theme` on `<html>` before first paint.
- `localStorage` keys: `winnie:code:<slug>`, `winnie:solved:<slug>`, `winnie:theme`, `winnie:split:<name>`. Every access is wrapped in try/catch.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Deliberate refinements of the spec** (decided while planning, based on measured behavior):

- The support jar is built with `kotlinc -include-runtime`, so it contains the Kotlin stdlib. The Homebrew `kotlinc` is a wrapper script, which makes locating `kotlin-stdlib.jar` fragile. The run classpath is therefore `out:<support jar>`.
- Test inputs are passed to the harness in a `cases.txt` file (base64, one line per case), not embedded as Kotlin string literals. This avoids Kotlin escaping and the JVM's 64 KB constant limits for big inputs.
- Deep recursion is supported by running cases on a thread created with a 256 MB stack, instead of passing `-Xss` (which doesn't reliably affect the main thread).
- The Results tab on narrow screens is selected as soon as Run is pressed (it shows a spinner), not when the response arrives.
- Drafts are saved to `localStorage` on every change (no debounce), since the writes are tiny.

## File Structure

```
package.json, tsconfig.json, vite.config.ts, vitest.config.ts, .gitignore
README.md, CLAUDE.md                     how to run; how Claude adds problems
shared/api.ts                            API types shared by server and web
problems/.gitkeep                        user problems live here (none bundled)
kotlin-support/src/Nodes.kt              ListNode, TreeNode (default package, LeetCode shape)
kotlin-support/src/WinnieLit.kt          literal AST + parser for LeetCode notation
kotlin-support/src/WinnieIO.kt           typed decoders/encoders for literals and nodes
kotlin-support/src/WinnieRunner.kt       per-case execution loop, stdout capture, tagged output
kotlin-support/test/SupportTest.kt       round-trip tests for the support library
server/types.ts                          Kotlin type-string parser (KType)
server/problems.ts                       problem loading + validation
server/template.ts                       editor template generation
server/proc.ts                           child-process runner with timeout/output cap
server/toolchain.ts                      find kotlinc/java, build + cache support jar
server/harness.ts                        Main.kt code generation + cases.txt encoding
server/diagnostics.ts                    kotlinc diagnostic parsing
server/output.ts                         harness output parsing + CaseResult building
server/runner.ts                         compile + run orchestration
server/app.ts                            Fastify routes
server/index.ts                          server entrypoint
server/check-problems.ts                 `npm run check-problems` CLI
server/test-helpers.ts                   test paths + shared toolchain
server/__fixtures__/problems/*           fixture problems for tests
server/*.test.ts                         Vitest tests
web/index.html, web/public/favicon.svg
web/src/main.tsx, App.tsx, router.tsx, api.ts, storage.ts, theme.ts, useMediaQuery.ts, styles.css, vite-env.d.ts
web/src/components/Icons.tsx, Header.tsx, ThemeToggle.tsx, DifficultyBadge.tsx
web/src/components/SplitPane.tsx, Editor.tsx, Markdown.tsx, Results.tsx
web/src/pages/ProblemList.tsx, ProblemPage.tsx
```

---

### Task 1: Project scaffold and shared API types

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.gitignore`, `problems/.gitkeep`, `shared/api.ts`

**Interfaces:**
- Produces: `shared/api.ts` types `Difficulty`, `ProblemSummary`, `ProblemDetail`, `Diagnostic`, `Verdict`, `CaseResult`, `RunResponse` (used by server and web); npm scripts `dev`, `dev:server`, `dev:web`, `build`, `start`, `test`, `typecheck`, `check-problems`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "winnie-code",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "concurrently -k -n server,web -c blue,magenta \"npm:dev:server\" \"npm:dev:web\"",
    "dev:server": "tsx watch --clear-screen=false server/index.ts",
    "dev:web": "vite",
    "build": "vite build",
    "start": "vite build && NODE_ENV=production tsx server/index.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "check-problems": "tsx server/check-problems.ts"
  },
  "dependencies": {
    "@codemirror/commands": "^6.11.1",
    "@codemirror/language": "^6.12.4",
    "@codemirror/legacy-modes": "^6.5.4",
    "@codemirror/lint": "^6.9.7",
    "@codemirror/state": "^6.7.6",
    "@codemirror/theme-one-dark": "^6.1.3",
    "@codemirror/view": "^6.43.13",
    "@fastify/static": "^10.1.5",
    "codemirror": "^6.0.2",
    "fastify": "^5.12.5",
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "react-markdown": "^10.1.0",
    "remark-gfm": "^4.0.1",
    "tsx": "^4.23.15"
  },
  "devDependencies": {
    "@types/node": "^26.6.3",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.1",
    "concurrently": "^10.0.5",
    "typescript": "^5.9.3",
    "vite": "^8.3.1",
    "vitest": "^5.0.2"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["server", "shared", "web/src", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create `vite.config.ts` and `vitest.config.ts`**

`vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "web",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:5174" },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["server/**/*.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 300_000,
    passWithNoTests: true,
  },
});
```

- [ ] **Step 4: Create `.gitignore` and `problems/.gitkeep`**

`.gitignore`:
```
node_modules/
web/dist/
.cache/
.DS_Store
*.log
```

`problems/.gitkeep`: empty file.

- [ ] **Step 5: Create `shared/api.ts`**

```ts
export type Difficulty = "Easy" | "Medium" | "Hard";

export type ProblemSummary =
  | { slug: string; ok: true; title: string; difficulty: Difficulty }
  | { slug: string; ok: false; error: string };

export type ProblemDetail = {
  slug: string;
  title: string;
  difficulty: Difficulty;
  description: string;
  template: string;
};

export type Diagnostic = {
  line: number;
  column: number;
  severity: "error" | "warning";
  message: string;
};

export type Verdict = "accepted" | "wrong_answer" | "runtime_error" | "time_limit_exceeded";

export type CaseResult = {
  index: number;
  input: { name: string; value: string }[];
  expected: string;
  verdict: Verdict;
  /** Present for accepted / wrong_answer. */
  output?: string;
  /** The user's println output for this case (truncated to 64 KB). */
  stdout: string;
  /** Exception class + message + user frames, for runtime_error (or a crash explanation). */
  error?: string;
  elapsedMs?: number;
};

export type RunResponse =
  | { status: "compile_error"; diagnostics: Diagnostic[]; raw: string }
  | { status: "ran"; passed: number; total: number; elapsedMs: number; cases: CaseResult[] }
  | { status: "internal_error"; message: string };
```

- [ ] **Step 6: Install and verify**

Run: `npm install`
Expected: completes without errors.

Run: `npm run typecheck`
Expected: exits 0 with no output.

Run: `npm test`
Expected: "No test files found", exit code 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts .gitignore problems/.gitkeep shared/api.ts
git commit -m "chore: scaffold Winnie Code project

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Kotlin type-string parser

**Files:**
- Create: `server/types.ts`
- Test: `server/types.test.ts`

**Interfaces:**
- Produces:
  - `type ScalarName = "Int" | "Long" | "Double" | "Boolean" | "Char" | "String"`
  - `type PrimArrayName = "IntArray" | "LongArray" | "DoubleArray" | "BooleanArray" | "CharArray"`
  - `type NodeName = "ListNode" | "TreeNode"`
  - `type KType = { kind: "scalar"; name: ScalarName } | { kind: "primArray"; name: PrimArrayName } | { kind: "array"; of: KType } | { kind: "list"; of: KType } | { kind: "node"; name: NodeName }`
  - `parseType(text: string): KType` (throws `Error` whose message starts with `Invalid type "<text>"`)
  - `formatType(t: KType): string`
  - `primArrayElement(name: PrimArrayName): ScalarName`
  - `mentionsNode(t: KType, name: NodeName): boolean`

- [ ] **Step 1: Write the failing test** — `server/types.test.ts`

```ts
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
    expect(parseType("Array<ListNode?>")).toEqual({
      kind: "array",
      of: { kind: "node", name: "ListNode" },
    });
  });

  it("rejects non-nullable nodes", () => {
    expect(() => parseType("ListNode")).toThrow(/ListNode\?/);
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
    for (const text of ["Int", "IntArray", "List<List<String>>", "Array<CharArray>", "ListNode?", "Array<TreeNode?>"]) {
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
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/types.test.ts`
Expected: FAIL. The module `./types` cannot be resolved.

- [ ] **Step 3: Write the implementation** — `server/types.ts`

```ts
export type ScalarName = "Int" | "Long" | "Double" | "Boolean" | "Char" | "String";
export type PrimArrayName = "IntArray" | "LongArray" | "DoubleArray" | "BooleanArray" | "CharArray";
export type NodeName = "ListNode" | "TreeNode";

export type KType =
  | { kind: "scalar"; name: ScalarName }
  | { kind: "primArray"; name: PrimArrayName }
  | { kind: "array"; of: KType }
  | { kind: "list"; of: KType }
  | { kind: "node"; name: NodeName };

const SCALARS: readonly string[] = ["Int", "Long", "Double", "Boolean", "Char", "String"];

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
    if (name === "ListNode" || name === "TreeNode") {
      if (src[pos] !== "?") fail(`write "${name}?" (nullable), as LeetCode does`);
      pos++;
      return { kind: "node", name };
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/types.test.ts && npm run typecheck`
Expected: all tests PASS; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add server/types.ts server/types.test.ts
git commit -m "feat: parse Kotlin signature types

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Problem loading, validation and test fixtures

**Files:**
- Create: `server/problems.ts`, `server/test-helpers.ts`
- Create fixtures: `server/__fixtures__/problems/{sum-array,reverse-list,invert-tree,chunk-words,average,first-chars,broken}/{problem.json,description.md}`
- Test: `server/problems.test.ts`

**Interfaces:**
- Consumes: `parseType`, `KType` from `server/types.ts`; `Difficulty` from `shared/api.ts`.
- Produces:
  - `type Param = { name: string; type: KType }`
  - `type TestCase = { input: string[]; expected: string }`
  - `type Method = { name: string; params: Param[]; returns: KType }`
  - `type Problem = { slug: string; title: string; difficulty: Difficulty; description: string; method: Method; tests: TestCase[] }`
  - `type ProblemEntry = { slug: string; ok: true; problem: Problem } | { slug: string; ok: false; error: string }`
  - `isValidSlug(slug: string): boolean`
  - `validateProblem(slug: string, raw: unknown, description: string): Problem` (throws `Error`)
  - `loadProblem(dir: string, slug: string): Promise<ProblemEntry | null>` (`null` = no such problem folder or invalid slug)
  - `listProblems(dir: string): Promise<ProblemEntry[]>` (sorted by slug)
  - `server/test-helpers.ts`: `ROOT: string`, `FIXTURE_PROBLEMS: string`

- [ ] **Step 1: Create the fixture problems**

`server/__fixtures__/problems/sum-array/problem.json`:
```json
{
  "title": "Sum Array",
  "difficulty": "Easy",
  "method": { "name": "sum", "params": [{ "name": "nums", "type": "IntArray" }], "returns": "Int" },
  "tests": [
    { "input": ["[1,2,3]"], "expected": "6" },
    { "input": ["[]"], "expected": "0" },
    { "input": ["[-5,5]"], "expected": "0" }
  ]
}
```
`server/__fixtures__/problems/sum-array/description.md`:
```markdown
Return the sum of all values in `nums`.
```

`server/__fixtures__/problems/reverse-list/problem.json`:
```json
{
  "title": "Reverse Linked List",
  "difficulty": "Easy",
  "method": { "name": "reverseList", "params": [{ "name": "head", "type": "ListNode?" }], "returns": "ListNode?" },
  "tests": [
    { "input": ["[1,2,3,4,5]"], "expected": "[5,4,3,2,1]" },
    { "input": ["[1,2]"], "expected": "[2,1]" },
    { "input": ["[]"], "expected": "[]" }
  ]
}
```
`server/__fixtures__/problems/reverse-list/description.md`:
```markdown
Reverse the singly linked list starting at `head` and return the new head.
```

`server/__fixtures__/problems/invert-tree/problem.json`:
```json
{
  "title": "Invert Binary Tree",
  "difficulty": "Easy",
  "method": { "name": "invertTree", "params": [{ "name": "root", "type": "TreeNode?" }], "returns": "TreeNode?" },
  "tests": [
    { "input": ["[4,2,7,1,3,6,9]"], "expected": "[4,7,2,9,6,3,1]" },
    { "input": ["[2,1,3]"], "expected": "[2,3,1]" },
    { "input": ["[]"], "expected": "[]" }
  ]
}
```
`server/__fixtures__/problems/invert-tree/description.md`:
```markdown
Mirror the binary tree rooted at `root` and return its root.
```

`server/__fixtures__/problems/chunk-words/problem.json`:
```json
{
  "title": "Chunk Words",
  "difficulty": "Medium",
  "method": {
    "name": "chunk",
    "params": [{ "name": "words", "type": "List<String>" }, { "name": "size", "type": "Int" }],
    "returns": "List<List<String>>"
  },
  "tests": [
    { "input": ["[\"a\",\"b\\\"q\",\"c\"]", "2"], "expected": "[[\"a\",\"b\\\"q\"],[\"c\"]]" },
    { "input": ["[]", "3"], "expected": "[]" }
  ]
}
```
`server/__fixtures__/problems/chunk-words/description.md`:
```markdown
Split `words` into consecutive chunks of `size` elements (the last chunk may be shorter).
```

`server/__fixtures__/problems/average/problem.json`:
```json
{
  "title": "Average",
  "difficulty": "Easy",
  "method": { "name": "average", "params": [{ "name": "nums", "type": "IntArray" }], "returns": "Double" },
  "tests": [
    { "input": ["[1,2]"], "expected": "1.50000" },
    { "input": ["[4]"], "expected": "4.0" }
  ]
}
```
`server/__fixtures__/problems/average/description.md`:
```markdown
Return the average of `nums`.
```

`server/__fixtures__/problems/first-chars/problem.json`:
```json
{
  "title": "First Characters",
  "difficulty": "Hard",
  "method": { "name": "firstChars", "params": [{ "name": "words", "type": "Array<String>" }], "returns": "CharArray" },
  "tests": [
    { "input": ["[\"ab\",\"cd\"]"], "expected": "[\"a\",\"c\"]" }
  ]
}
```
`server/__fixtures__/problems/first-chars/description.md`:
```markdown
Return the first character of every word.
```

`server/__fixtures__/problems/broken/problem.json`:
```json
{
  "title": "Broken",
  "difficulty": "Impossible",
  "method": { "name": "f", "params": [], "returns": "Int" },
  "tests": [{ "input": [], "expected": "1" }]
}
```
`server/__fixtures__/problems/broken/description.md`:
```markdown
This fixture is intentionally invalid.
```

- [ ] **Step 2: Create `server/test-helpers.ts`**

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FIXTURE_PROBLEMS = path.join(ROOT, "server", "__fixtures__", "problems");
```

- [ ] **Step 3: Write the failing test** — `server/problems.test.ts`

```ts
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
      "first-chars",
      "invert-tree",
      "reverse-list",
      "sum-array",
    ]);
  });

  it("returns an empty list when the directory does not exist", async () => {
    expect(await listProblems(path.join(os.tmpdir(), "winnie-does-not-exist"))).toEqual([]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run server/problems.test.ts`
Expected: FAIL. The module `./problems` cannot be resolved.

- [ ] **Step 5: Write the implementation** — `server/problems.ts`

```ts
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Difficulty } from "../shared/api";
import { parseType, type KType } from "./types";

export type Param = { name: string; type: KType };
export type TestCase = { input: string[]; expected: string };
export type Method = { name: string; params: Param[]; returns: KType };

export type Problem = {
  slug: string;
  title: string;
  difficulty: Difficulty;
  description: string;
  method: Method;
  tests: TestCase[];
};

export type ProblemEntry =
  | { slug: string; ok: true; problem: Problem }
  | { slug: string; ok: false; error: string };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const DIFFICULTIES: readonly string[] = ["Easy", "Medium", "Hard"];

export function isValidSlug(slug: string): boolean {
  return SLUG.test(slug);
}

function asObject(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${where} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, where: string): string {
  if (typeof value !== "string") throw new Error(`${where} must be a string`);
  return value;
}

function asIdentifier(value: unknown, where: string): string {
  const name = asString(value, where);
  if (!IDENTIFIER.test(name)) throw new Error(`${where} "${name}" is not a valid Kotlin identifier`);
  return name;
}

/** Validates parsed problem.json content. Throws an Error describing the first problem found. */
export function validateProblem(slug: string, raw: unknown, description: string): Problem {
  const obj = asObject(raw, "problem.json");

  const title = asString(obj.title, "title");
  if (!title.trim()) throw new Error("title must not be empty");

  const difficulty = obj.difficulty;
  if (typeof difficulty !== "string" || !DIFFICULTIES.includes(difficulty)) {
    throw new Error(`difficulty must be one of ${DIFFICULTIES.join(", ")}`);
  }

  const method = asObject(obj.method, "method");
  const name = asIdentifier(method.name, "method.name");
  if (!Array.isArray(method.params)) throw new Error("method.params must be an array");
  const seen = new Set<string>();
  const params: Param[] = method.params.map((rawParam, i) => {
    const param = asObject(rawParam, `method.params[${i}]`);
    const paramName = asIdentifier(param.name, `method.params[${i}].name`);
    if (seen.has(paramName)) throw new Error(`duplicate param name "${paramName}"`);
    seen.add(paramName);
    return { name: paramName, type: parseType(asString(param.type, `method.params[${i}].type`)) };
  });
  const returns = parseType(asString(method.returns, "method.returns"));

  if (!Array.isArray(obj.tests) || obj.tests.length === 0) throw new Error("tests must be a non-empty array");
  const tests: TestCase[] = obj.tests.map((rawTest, i) => {
    const test = asObject(rawTest, `tests[${i}]`);
    const input = test.input;
    if (!Array.isArray(input) || input.some((v) => typeof v !== "string")) {
      throw new Error(`tests[${i}].input must be an array of strings`);
    }
    if (input.length !== params.length) {
      throw new Error(`tests[${i}].input has ${input.length} values but the method has ${params.length} params`);
    }
    return { input: input as string[], expected: asString(test.expected, `tests[${i}].expected`) };
  });

  return { slug, title, difficulty: difficulty as Difficulty, description, method: { name, params, returns }, tests };
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/** Loads problems/<slug>. Returns null when the slug is invalid or the folder does not exist. */
export async function loadProblem(dir: string, slug: string): Promise<ProblemEntry | null> {
  if (!isValidSlug(slug)) return null;
  const folder = path.join(dir, slug);
  if (!(await isDirectory(folder))) return null;
  try {
    const jsonText = await readFile(path.join(folder, "problem.json"), "utf8").catch(() => {
      throw new Error("missing problem.json");
    });
    const description = await readFile(path.join(folder, "description.md"), "utf8").catch(() => {
      throw new Error("missing description.md");
    });
    let raw: unknown;
    try {
      raw = JSON.parse(jsonText);
    } catch (e) {
      throw new Error(`problem.json is not valid JSON: ${(e as Error).message}`);
    }
    return { slug, ok: true, problem: validateProblem(slug, raw, description) };
  } catch (e) {
    return { slug, ok: false, error: (e as Error).message };
  }
}

/** Loads every problem folder under dir, sorted by slug. Folders whose names are not valid slugs are skipped. */
export async function listProblems(dir: string): Promise<ProblemEntry[]> {
  let names: string[];
  try {
    const dirents = await readdir(dir, { withFileTypes: true });
    names = dirents.filter((d) => d.isDirectory() && isValidSlug(d.name)).map((d) => d.name);
  } catch {
    return [];
  }
  names.sort();
  const entries = await Promise.all(names.map((name) => loadProblem(dir, name)));
  return entries.filter((e): e is ProblemEntry => e !== null);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run server/problems.test.ts && npm run typecheck`
Expected: all tests PASS; typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add server/problems.ts server/problems.test.ts server/test-helpers.ts server/__fixtures__
git commit -m "feat: load and validate problems from disk

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Editor template generation

**Files:**
- Create: `server/template.ts`
- Test: `server/template.test.ts`

**Interfaces:**
- Consumes: `Method` from `server/problems.ts`; `formatType`, `mentionsNode`, `parseType` from `server/types.ts`.
- Produces: `generateTemplate(method: Method): string`

- [ ] **Step 1: Write the failing test** — `server/template.test.ts`

```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/template.test.ts`
Expected: FAIL. The module `./template` cannot be resolved.

- [ ] **Step 3: Write the implementation** — `server/template.ts`

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/template.test.ts && npm run typecheck`
Expected: all tests PASS; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add server/template.ts server/template.test.ts
git commit -m "feat: generate editor templates from method signatures

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: Kotlin support library, process runner and toolchain

**Files:**
- Create: `kotlin-support/src/Nodes.kt`, `kotlin-support/src/WinnieLit.kt`, `kotlin-support/src/WinnieIO.kt`, `kotlin-support/src/WinnieRunner.kt`
- Create: `kotlin-support/test/SupportTest.kt`
- Create: `server/proc.ts`, `server/toolchain.ts`
- Modify: `server/test-helpers.ts` (add `getTestToolchain`)
- Test: `server/support.test.ts`

All Kotlin support code lives in the **default package**. That way the user's `Solution.kt` (which has no package) can use `ListNode`/`TreeNode` without imports, exactly like LeetCode. Every other name is prefixed `Winnie` to avoid colliding with user code.

**Interfaces:**
- Produces (Kotlin, default package):
  - `class ListNode(var \`val\`: Int) { var next: ListNode? }`, `class TreeNode(var \`val\`: Int) { var left: TreeNode?; var right: TreeNode? }`
  - `sealed class WinnieLit` with `Num(text)`, `Str(value)`, `Bool(value)`, `Null`, `Arr(items)`; `WinnieLitParser.parse(text: String): WinnieLit`
  - `object WinnieIO`:
    - decoders `parse`, `items`, `int`, `long`, `double`, `bool`, `char`, `str`, `listNode`, `treeNode`
    - encoders `encInt`, `encLong`, `encDouble`, `encBool`, `encChar`, `encStr`, `encSeq(List<String>)`, `encListNode`, `encTreeNode`
    - helpers `quote`, `render`
  - `object WinnieRunner { fun run(args: Array<String>, normalizeExpected: (String) -> String, invoke: (List<String>) -> String) }`. `args[0]` is the cases file path and `args[1]` is the token. It prints one line per case: `token|index|ok-or-error|elapsedMs|b64(output)|b64(expected)|b64(stdout)|b64(error)`.
- Produces (TypeScript):
  - `server/proc.ts`: `type ProcResult = { exitCode: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string; timedOut: boolean; outputLimitExceeded: boolean }`; `runProcess(command: string, args: string[], opts: { cwd: string; timeoutMs: number; maxOutputBytes?: number }): Promise<ProcResult>`
  - `server/toolchain.ts`: `type Toolchain = { kotlinc: string; java: string; supportJar: string }`; `findOnPath(name: string): Promise<string | null>`; `kotlinSources(dir: string): Promise<string[]>`; `prepareToolchain(opts: { supportDir: string; cacheDir: string }): Promise<Toolchain>`
  - `server/test-helpers.ts`: `getTestToolchain(): Promise<Toolchain>` (memoized)

- [ ] **Step 1: Write the failing Kotlin test** — `kotlin-support/test/SupportTest.kt`

```kotlin
import kotlin.system.exitProcess

val failures = mutableListOf<String>()

fun check(name: String, actual: Any?, expected: Any?) {
    if (actual != expected) failures.add("$name: expected <$expected> but was <$actual>")
}

fun errorOf(block: () -> Any?): String? = runCatching(block).exceptionOrNull()?.message

fun lit(text: String): WinnieLit = WinnieIO.parse(text)

fun intList(text: String): String = WinnieIO.encSeq(WinnieIO.items(lit(text)).map { WinnieIO.encInt(WinnieIO.int(it)) })

fun tree(text: String): String = WinnieIO.encTreeNode(WinnieIO.treeNode(lit(text)))

fun main() {
    // Scalars
    check("int", WinnieIO.encInt(WinnieIO.int(lit(" 42 "))), "42")
    check("negative int", WinnieIO.encInt(WinnieIO.int(lit("-7"))), "-7")
    check("long", WinnieIO.encLong(WinnieIO.long(lit("9007199254740993"))), "9007199254740993")
    check("double normalizes", WinnieIO.encDouble(WinnieIO.double(lit("2.00000"))), "2.0")
    check("double exponent", WinnieIO.encDouble(WinnieIO.double(lit("1e-5"))), "1.0E-5")
    check("bool", WinnieIO.encBool(WinnieIO.bool(lit("true"))), "true")
    check("char", WinnieIO.encChar(WinnieIO.char(lit("\"a\""))), "\"a\"")
    check("string escapes", WinnieIO.encStr(WinnieIO.str(lit("\"a\\\"b\\\\c\\n\""))), "\"a\\\"b\\\\c\\n\"")
    check("unicode escape", WinnieIO.str(lit("\"\\u00e9\"")), "é")
    check("control char quoting", WinnieIO.quote("\u0001"), "\"\\u0001\"")

    // Arrays and lists
    check("int list", intList("[1, 2 ,3]"), "[1,2,3]")
    check("empty list", intList("[]"), "[]")
    check(
        "nested list",
        WinnieIO.encSeq(WinnieIO.items(lit("[[1,2],[],[3]]")).map { row ->
            WinnieIO.encSeq(WinnieIO.items(row).map { WinnieIO.encInt(WinnieIO.int(it)) })
        }),
        "[[1,2],[],[3]]",
    )
    check("render", WinnieIO.render(lit("[ \"x\" , null, true, 1.50 ]")), "[\"x\",null,true,1.50]")

    // Linked lists
    check("list node", WinnieIO.encListNode(WinnieIO.listNode(lit("[1,2,3]"))), "[1,2,3]")
    check("empty list node", WinnieIO.listNode(lit("[]")), null)
    check("null list node encodes as []", WinnieIO.encListNode(null), "[]")
    val cyclic = ListNode(1)
    cyclic.next = cyclic
    check("list cycle", errorOf { WinnieIO.encListNode(cyclic) }, "The returned linked list contains a cycle")

    // Trees
    for (t in listOf("[3,9,20,null,null,15,7]", "[1,null,2,3]", "[1]", "[5,4,8,11,null,13,4,7,2,null,null,null,1]")) {
        check("tree $t", tree(t), t)
    }
    check("tree trailing nulls trimmed", tree("[1,2,null,null,null]"), "[1,2]")
    check("empty tree", WinnieIO.treeNode(lit("[]")), null)
    check("null root", WinnieIO.treeNode(lit("[null]")), null)
    check("null tree encodes as []", WinnieIO.encTreeNode(null), "[]")
    check("tree structure", WinnieIO.treeNode(lit("[1,null,2]"))?.right?.`val`, 2)
    check("tree too many values", errorOf { WinnieIO.treeNode(lit("[1,null,null,2]")) }, "Invalid tree literal: too many values")

    // Errors
    check("type mismatch", errorOf { WinnieIO.int(lit("\"x\"")) }, "Expected an Int but got \"x\"")
    check("char length", errorOf { WinnieIO.char(lit("\"ab\"")) }, "Expected a one-character string but got \"ab\"")
    check("unterminated array", errorOf { lit("[1,2") } != null, true)
    check("trailing characters", errorOf { lit("1 2") } != null, true)
    check("bad token", errorOf { lit("[1,x]") } != null, true)

    if (failures.isEmpty()) {
        println("ALL PASSED")
    } else {
        failures.forEach { println("FAIL $it") }
        exitProcess(1)
    }
}
```

- [ ] **Step 2: Write `server/proc.ts`**

```ts
import { spawn } from "node:child_process";

export type ProcResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  outputLimitExceeded: boolean;
};

export type ProcOptions = { cwd: string; timeoutMs: number; maxOutputBytes?: number };

/** Runs a command, killing it (SIGKILL) on timeout or when combined output exceeds maxOutputBytes. */
export function runProcess(command: string, args: string[], opts: ProcOptions): Promise<ProcResult> {
  const maxOutputBytes = opts.maxOutputBytes ?? 32 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: opts.cwd, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let size = 0;
    let timedOut = false;
    let outputLimitExceeded = false;

    const collect = (chunks: Buffer[]) => (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxOutputBytes) {
        if (!outputLimitExceeded) {
          outputLimitExceeded = true;
          child.kill("SIGKILL");
        }
        return;
      }
      chunks.push(chunk);
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, opts.timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      resolve({
        exitCode,
        signal,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        timedOut,
        outputLimitExceeded,
      });
    });
  });
}
```

- [ ] **Step 3: Write `server/toolchain.ts`**

```ts
import { constants } from "node:fs";
import { access, mkdir, readdir, readFile, realpath, rename, rm } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { runProcess } from "./proc";

export type Toolchain = { kotlinc: string; java: string; supportJar: string };

export async function findOnPath(name: string): Promise<string | null> {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, name);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // not here, keep looking
    }
  }
  return null;
}

export async function kotlinSources(dir: string): Promise<string[]> {
  const names = (await readdir(dir)).filter((f) => f.endsWith(".kt")).sort();
  return names.map((f) => path.join(dir, f));
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Compiles kotlin-support/src into a jar that also bundles the Kotlin runtime (-include-runtime),
 * so running user code only needs `java -cp out:<jar>`. Cached by a hash of the sources + kotlinc location.
 */
async function buildSupportJar(kotlinc: string, supportDir: string, cacheDir: string): Promise<string> {
  const sources = await kotlinSources(path.join(supportDir, "src"));
  const hash = createHash("sha256");
  hash.update(await realpath(kotlinc));
  for (const file of sources) {
    hash.update(path.basename(file));
    hash.update(await readFile(file));
  }
  const jar = path.join(cacheDir, `winnie-support-${hash.digest("hex").slice(0, 16)}.jar`);
  if (await exists(jar)) return jar;

  await mkdir(cacheDir, { recursive: true });
  const tmp = path.join(cacheDir, `tmp-${randomUUID()}.jar`);
  const result = await runProcess(kotlinc, [...sources, "-include-runtime", "-d", tmp], {
    cwd: supportDir,
    timeoutMs: 300_000,
  });
  if (result.exitCode !== 0) {
    await rm(tmp, { force: true });
    throw new Error(`Failed to build the Kotlin support library:\n${result.stderr}${result.stdout}`);
  }
  await rename(tmp, jar);
  return jar;
}

export async function prepareToolchain(opts: { supportDir: string; cacheDir: string }): Promise<Toolchain> {
  const kotlinc = await findOnPath("kotlinc");
  if (!kotlinc) throw new Error("kotlinc was not found on PATH. Install Kotlin (for example `brew install kotlin`) and try again.");
  const java = await findOnPath("java");
  if (!java) throw new Error("java was not found on PATH. Install a JDK (17 or newer) and try again.");
  const supportJar = await buildSupportJar(kotlinc, opts.supportDir, opts.cacheDir);
  return { kotlinc, java, supportJar };
}
```

- [ ] **Step 4: Add `getTestToolchain` to `server/test-helpers.ts`**

Replace the file with:
```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareToolchain, type Toolchain } from "./toolchain";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FIXTURE_PROBLEMS = path.join(ROOT, "server", "__fixtures__", "problems");

let toolchain: Promise<Toolchain> | undefined;

/** Real kotlinc/java toolchain shared by the tests in one worker (support jar cached in .cache/). */
export function getTestToolchain(): Promise<Toolchain> {
  toolchain ??= prepareToolchain({
    supportDir: path.join(ROOT, "kotlin-support"),
    cacheDir: path.join(ROOT, ".cache"),
  });
  return toolchain;
}
```

- [ ] **Step 5: Write the Vitest wrapper for the Kotlin test** — `server/support.test.ts`

```ts
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runProcess } from "./proc";
import { findOnPath } from "./toolchain";
import { getTestToolchain, ROOT } from "./test-helpers";

describe("kotlin-support", () => {
  it("round-trips every supported literal type", async () => {
    const tc = await getTestToolchain();
    const dir = await mkdtemp(path.join(os.tmpdir(), "winnie-support-test-"));
    try {
      const testFile = path.join(ROOT, "kotlin-support", "test", "SupportTest.kt");
      const compile = await runProcess(tc.kotlinc, [testFile, "-cp", tc.supportJar, "-d", "out"], {
        cwd: dir,
        timeoutMs: 180_000,
      });
      expect(compile.exitCode, compile.stderr).toBe(0);
      const run = await runProcess(tc.java, ["-cp", ["out", tc.supportJar].join(path.delimiter), "SupportTestKt"], {
        cwd: dir,
        timeoutMs: 60_000,
      });
      expect(run.stdout.trim(), run.stdout + run.stderr).toBe("ALL PASSED");
      expect(run.exitCode).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("findOnPath", () => {
  it("finds kotlinc and returns null for unknown commands", async () => {
    expect(await findOnPath("kotlinc")).toMatch(/kotlinc$/);
    expect(await findOnPath("definitely-not-a-real-command-winnie")).toBeNull();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run server/support.test.ts`
Expected: FAIL. `kotlinSources` throws ENOENT because `kotlin-support/src` does not exist yet.

- [ ] **Step 7: Write `kotlin-support/src/Nodes.kt`**

```kotlin
/** Singly-linked list node, identical to LeetCode's Kotlin definition. */
class ListNode(var `val`: Int) {
    var next: ListNode? = null
}

/** Binary tree node, identical to LeetCode's Kotlin definition. */
class TreeNode(var `val`: Int) {
    var left: TreeNode? = null
    var right: TreeNode? = null
}
```

- [ ] **Step 8: Write `kotlin-support/src/WinnieLit.kt`**

```kotlin
/** A value written in LeetCode literal notation: numbers, "strings", true/false, null and [arrays]. */
sealed class WinnieLit {
    data class Num(val text: String) : WinnieLit()
    data class Str(val value: String) : WinnieLit()
    data class Bool(val value: Boolean) : WinnieLit()
    data object Null : WinnieLit()
    data class Arr(val items: List<WinnieLit>) : WinnieLit()
}

class WinnieLitParser private constructor(private val src: String) {
    private var pos = 0

    companion object {
        fun parse(text: String): WinnieLit {
            val parser = WinnieLitParser(text)
            parser.skipWhitespace()
            val value = parser.value()
            parser.skipWhitespace()
            if (parser.pos != text.length) parser.fail("unexpected trailing characters")
            return value
        }
    }

    private fun fail(message: String): Nothing =
        throw IllegalArgumentException("Invalid literal at position $pos: $message in: ${src.take(200)}")

    private fun skipWhitespace() {
        while (pos < src.length && src[pos].isWhitespace()) pos++
    }

    private fun value(): WinnieLit {
        if (pos >= src.length) fail("unexpected end of input")
        val c = src[pos]
        return when {
            c == '[' -> array()
            c == '"' -> WinnieLit.Str(string())
            c == '-' || c.isDigit() -> number()
            src.startsWith("true", pos) -> { pos += 4; WinnieLit.Bool(true) }
            src.startsWith("false", pos) -> { pos += 5; WinnieLit.Bool(false) }
            src.startsWith("null", pos) -> { pos += 4; WinnieLit.Null }
            else -> fail("unexpected character '$c'")
        }
    }

    private fun array(): WinnieLit {
        pos++ // [
        val items = ArrayList<WinnieLit>()
        skipWhitespace()
        if (pos < src.length && src[pos] == ']') {
            pos++
            return WinnieLit.Arr(items)
        }
        while (true) {
            skipWhitespace()
            items.add(value())
            skipWhitespace()
            if (pos >= src.length) fail("unterminated array")
            when (src[pos]) {
                ',' -> pos++
                ']' -> {
                    pos++
                    return WinnieLit.Arr(items)
                }
                else -> fail("expected ',' or ']'")
            }
        }
    }

    private fun string(): String {
        pos++ // opening quote
        val sb = StringBuilder()
        while (true) {
            if (pos >= src.length) fail("unterminated string")
            val c = src[pos++]
            when (c) {
                '"' -> return sb.toString()
                '\\' -> {
                    if (pos >= src.length) fail("unterminated escape")
                    when (val e = src[pos++]) {
                        '"' -> sb.append('"')
                        '\\' -> sb.append('\\')
                        '/' -> sb.append('/')
                        'b' -> sb.append('\b')
                        'f' -> sb.append('\u000C')
                        'n' -> sb.append('\n')
                        'r' -> sb.append('\r')
                        't' -> sb.append('\t')
                        'u' -> {
                            if (pos + 4 > src.length) fail("bad unicode escape")
                            val code = src.substring(pos, pos + 4).toIntOrNull(16) ?: fail("bad unicode escape")
                            sb.append(code.toChar())
                            pos += 4
                        }
                        else -> fail("bad escape '\\$e'")
                    }
                }
                else -> sb.append(c)
            }
        }
    }

    private fun number(): WinnieLit {
        val start = pos
        if (src[pos] == '-') pos++
        while (pos < src.length && (src[pos].isDigit() || src[pos] in ".eE+-")) pos++
        val text = src.substring(start, pos)
        if (text.toDoubleOrNull() == null) fail("bad number '$text'")
        return WinnieLit.Num(text)
    }
}
```

- [ ] **Step 9: Write `kotlin-support/src/WinnieIO.kt`**

```kotlin
import java.util.ArrayDeque
import java.util.Collections
import java.util.IdentityHashMap
import java.util.LinkedList

/** Converts between LeetCode literal notation and Kotlin values. Used by the generated Main.kt. */
object WinnieIO {
    fun parse(text: String): WinnieLit = WinnieLitParser.parse(text)

    // ---- decoding ----

    fun items(l: WinnieLit): List<WinnieLit> = (l as? WinnieLit.Arr)?.items ?: mismatch("an array", l)

    fun int(l: WinnieLit): Int = number(l, "an Int").toIntOrNull() ?: mismatch("an Int", l)

    fun long(l: WinnieLit): Long = number(l, "a Long").toLongOrNull() ?: mismatch("a Long", l)

    fun double(l: WinnieLit): Double = number(l, "a Double").toDouble()

    fun bool(l: WinnieLit): Boolean = (l as? WinnieLit.Bool)?.value ?: mismatch("a Boolean", l)

    fun str(l: WinnieLit): String = (l as? WinnieLit.Str)?.value ?: mismatch("a String", l)

    fun char(l: WinnieLit): Char {
        val s = (l as? WinnieLit.Str)?.value
        if (s == null || s.length != 1) mismatch("a one-character string", l)
        return s[0]
    }

    fun listNode(l: WinnieLit): ListNode? {
        val dummy = ListNode(0)
        var tail = dummy
        for (item in items(l)) {
            val node = ListNode(int(item))
            tail.next = node
            tail = node
        }
        return dummy.next
    }

    fun treeNode(l: WinnieLit): TreeNode? {
        val values = items(l)
        if (values.isEmpty() || values[0] is WinnieLit.Null) return null
        val root = TreeNode(int(values[0]))
        val queue = ArrayDeque<TreeNode>()
        queue.add(root)
        var i = 1
        while (i < values.size) {
            val parent = queue.poll() ?: throw IllegalArgumentException("Invalid tree literal: too many values")
            if (values[i] !is WinnieLit.Null) {
                val node = TreeNode(int(values[i]))
                parent.left = node
                queue.add(node)
            }
            i++
            if (i < values.size && values[i] !is WinnieLit.Null) {
                val node = TreeNode(int(values[i]))
                parent.right = node
                queue.add(node)
            }
            i++
        }
        return root
    }

    // ---- encoding (canonical LeetCode notation, no spaces) ----

    fun encInt(v: Int): String = v.toString()

    fun encLong(v: Long): String = v.toString()

    fun encDouble(v: Double): String = v.toString()

    fun encBool(v: Boolean): String = v.toString()

    fun encChar(v: Char): String = quote(v.toString())

    fun encStr(v: String): String = quote(v)

    fun encSeq(items: List<String>): String = items.joinToString(",", "[", "]")

    fun encListNode(head: ListNode?): String {
        val seen = Collections.newSetFromMap(IdentityHashMap<ListNode, Boolean>())
        val out = ArrayList<String>()
        var cur = head
        while (cur != null) {
            if (!seen.add(cur)) throw IllegalStateException("The returned linked list contains a cycle")
            out.add(cur.`val`.toString())
            cur = cur.next
        }
        return encSeq(out)
    }

    fun encTreeNode(root: TreeNode?): String {
        if (root == null) return "[]"
        val seen = Collections.newSetFromMap(IdentityHashMap<TreeNode, Boolean>())
        val out = ArrayList<String>()
        val queue = LinkedList<TreeNode?>()
        queue.add(root)
        while (queue.isNotEmpty()) {
            val node = queue.removeFirst()
            if (node == null) {
                out.add("null")
                continue
            }
            if (!seen.add(node)) throw IllegalStateException("The returned tree contains a cycle")
            out.add(node.`val`.toString())
            queue.add(node.left)
            queue.add(node.right)
        }
        while (out.last() == "null") out.removeAt(out.size - 1)
        return encSeq(out)
    }

    fun quote(s: String): String {
        val sb = StringBuilder("\"")
        for (c in s) {
            when {
                c == '"' -> sb.append("\\\"")
                c == '\\' -> sb.append("\\\\")
                c == '\n' -> sb.append("\\n")
                c == '\r' -> sb.append("\\r")
                c == '\t' -> sb.append("\\t")
                c < ' ' -> sb.append("\\u%04x".format(c.code))
                else -> sb.append(c)
            }
        }
        return sb.append('"').toString()
    }

    /** Canonical text of a literal, used in error messages. */
    fun render(l: WinnieLit): String = when (l) {
        is WinnieLit.Num -> l.text
        is WinnieLit.Str -> quote(l.value)
        is WinnieLit.Bool -> l.value.toString()
        WinnieLit.Null -> "null"
        is WinnieLit.Arr -> encSeq(l.items.map { render(it) })
    }

    private fun number(l: WinnieLit, what: String): String = (l as? WinnieLit.Num)?.text ?: mismatch(what, l)

    private fun mismatch(what: String, l: WinnieLit): Nothing =
        throw IllegalArgumentException("Expected $what but got ${render(l).take(100)}")
}
```

- [ ] **Step 10: Write `kotlin-support/src/WinnieRunner.kt`**

```kotlin
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.OutputStream
import java.io.PrintStream
import java.util.Base64
import kotlin.system.exitProcess

/**
 * Runs every test case and prints one tagged line per case on the real stdout:
 *   token|index|status|elapsedMs|b64(output)|b64(normalizedExpected)|b64(capturedStdout)|b64(error)
 * status is "ok" or "error". User println output is captured per case so it never mixes with results.
 */
object WinnieRunner {
    private const val CAPTURE_LIMIT = 64 * 1024
    private const val STACK_SIZE = 256L * 1024 * 1024

    fun run(args: Array<String>, normalizeExpected: (String) -> String, invoke: (List<String>) -> String) {
        val decoder = Base64.getDecoder()
        val cases = File(args[0]).readLines().filter { it.isNotBlank() }.map { line ->
            line.split(" ").map { String(decoder.decode(it), Charsets.UTF_8) }
        }
        val token = args[1]
        val realOut = System.out
        val realErr = System.err

        val worker = Thread(null, {
            cases.forEachIndexed { index, fields ->
                val capture = CappedStream(CAPTURE_LIMIT)
                val captureStream = PrintStream(capture, true, "UTF-8")
                var status = "ok"
                var output = ""
                var expected = ""
                var error = ""
                var elapsedMs = 0L
                try {
                    expected = normalizeExpected(fields.last())
                } catch (t: Throwable) {
                    status = "error"
                    error = "Invalid expected value in problem.json: ${t.message}"
                }
                if (status == "ok") {
                    val start = System.nanoTime()
                    try {
                        System.setOut(captureStream)
                        System.setErr(captureStream)
                        output = invoke(fields.dropLast(1))
                    } catch (t: Throwable) {
                        status = "error"
                        error = describe(t)
                    } finally {
                        System.setOut(realOut)
                        System.setErr(realErr)
                        elapsedMs = (System.nanoTime() - start) / 1_000_000
                    }
                }
                captureStream.flush()
                realOut.println(
                    listOf(token, index.toString(), status, elapsedMs.toString(), b64(output), b64(expected), b64(capture.text()), b64(error))
                        .joinToString("|"),
                )
                realOut.flush()
            }
        }, "winnie-main", STACK_SIZE)
        worker.start()
        worker.join()
        exitProcess(0)
    }

    private fun b64(s: String): String = Base64.getEncoder().encodeToString(s.toByteArray(Charsets.UTF_8))

    private fun describe(t: Throwable): String {
        val frames = t.stackTrace.filter { it.fileName == "Solution.kt" }.ifEmpty { t.stackTrace.take(5) }
        val sb = StringBuilder(t.toString())
        for (frame in frames.take(20)) sb.append("\n    at ").append(frame)
        return sb.toString()
    }
}

private class CappedStream(private val limit: Int) : OutputStream() {
    private val buffer = ByteArrayOutputStream()
    private var truncated = false

    override fun write(b: Int) {
        if (buffer.size() < limit) buffer.write(b) else truncated = true
    }

    override fun write(b: ByteArray, off: Int, len: Int) {
        val room = limit - buffer.size()
        if (len <= room) {
            buffer.write(b, off, len)
        } else {
            if (room > 0) buffer.write(b, off, room)
            truncated = true
        }
    }

    fun text(): String {
        val text = String(buffer.toByteArray(), Charsets.UTF_8)
        return if (truncated) "$text\n… output truncated (64 KB limit)" else text
    }
}
```

- [ ] **Step 11: Run tests to verify they pass**

Run: `npx vitest run server/support.test.ts && npm run typecheck`
Expected: both tests PASS. The first run takes about 10–20 s while it builds `.cache/winnie-support-*.jar`. Typecheck exits 0.

If a `check(...)` fails, the assertion message prints the `FAIL name: expected <..> but was <..>` lines. Fix the Kotlin code, not the expectation, unless the expectation contradicts LeetCode notation.

- [ ] **Step 12: Commit**

```bash
git add kotlin-support server/proc.ts server/toolchain.ts server/test-helpers.ts server/support.test.ts
git commit -m "feat: add Kotlin support library and toolchain setup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Harness code generation

**Files:**
- Create: `server/harness.ts`
- Test: `server/harness.test.ts`

**Interfaces:**
- Consumes: `Problem`, `TestCase` from `server/problems.ts`; `KType`, `ScalarName`, `formatType`, `primArrayElement` from `server/types.ts`. The Kotlin API from Task 5 (`WinnieIO.*`, `WinnieRunner.run`).
- Produces:
  - `type HarnessMode = "run" | "check"`
  - `decodeExpr(t: KType, lit: string, depth?: number): string`: a Kotlin expression turning a `WinnieLit` expression into a value of type `t`
  - `encodeExpr(t: KType, value: string, depth?: number): string`: a Kotlin expression turning a value of type `t` into canonical literal text
  - `generateMain(problem: Problem, mode: HarnessMode): string`: contents of `Main.kt`. `"check"` mode parses inputs and never references `Solution`.
  - `encodeCases(tests: TestCase[]): string`: contents of `cases.txt`

- [ ] **Step 1: Write the failing test** — `server/harness.test.ts`

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/harness.test.ts`
Expected: FAIL. The module `./harness` cannot be resolved.

- [ ] **Step 3: Write the implementation** — `server/harness.ts`

```ts
import type { Problem, TestCase } from "./problems";
import { formatType, primArrayElement, type KType, type ScalarName } from "./types";

export type HarnessMode = "run" | "check";

const IO = "WinnieIO";

const SCALAR_DECODERS: Record<ScalarName, string> = {
  Int: "int",
  Long: "long",
  Double: "double",
  Boolean: "bool",
  Char: "char",
  String: "str",
};

const SCALAR_ENCODERS: Record<ScalarName, string> = {
  Int: "encInt",
  Long: "encLong",
  Double: "encDouble",
  Boolean: "encBool",
  Char: "encChar",
  String: "encStr",
};

/** Kotlin expression converting the WinnieLit expression `lit` into a value of type `t`. */
export function decodeExpr(t: KType, lit: string, depth = 1): string {
  const x = `x${depth}`;
  switch (t.kind) {
    case "scalar":
      return `${IO}.${SCALAR_DECODERS[t.name]}(${lit})`;
    case "node":
      return t.name === "ListNode" ? `${IO}.listNode(${lit})` : `${IO}.treeNode(${lit})`;
    case "primArray": {
      const element: KType = { kind: "scalar", name: primArrayElement(t.name) };
      return `${IO}.items(${lit}).map { ${x} -> ${decodeExpr(element, x, depth + 1)} }.to${t.name}()`;
    }
    case "array":
      return `${IO}.items(${lit}).map { ${x} -> ${decodeExpr(t.of, x, depth + 1)} }.toTypedArray()`;
    case "list":
      return `${IO}.items(${lit}).map { ${x} -> ${decodeExpr(t.of, x, depth + 1)} }`;
  }
}

/** Kotlin expression converting `value` (of type `t`) into canonical LeetCode literal text. */
export function encodeExpr(t: KType, value: string, depth = 1): string {
  const y = `y${depth}`;
  switch (t.kind) {
    case "scalar":
      return `${IO}.${SCALAR_ENCODERS[t.name]}(${value})`;
    case "node":
      return t.name === "ListNode" ? `${IO}.encListNode(${value})` : `${IO}.encTreeNode(${value})`;
    case "primArray": {
      const element: KType = { kind: "scalar", name: primArrayElement(t.name) };
      return `${IO}.encSeq(${value}.map { ${y} -> ${encodeExpr(element, y, depth + 1)} })`;
    }
    case "array":
    case "list":
      return `${IO}.encSeq(${value}.map { ${y} -> ${encodeExpr(t.of, y, depth + 1)} })`;
  }
}

/** Generates Main.kt. In "check" mode it only parses the literals (used by check-problems). */
export function generateMain(problem: Problem, mode: HarnessMode): string {
  const { method } = problem;
  const returns = method.returns;
  const decodeParams = method.params.map(
    (p, i) => `            val p${i}: ${formatType(p.type)} = ${decodeExpr(p.type, `${IO}.parse(input[${i}])`)}`,
  );
  const args = method.params.map((_, i) => `p${i}`).join(", ");
  const body =
    mode === "run"
      ? [
          ...decodeParams,
          `            val result: ${formatType(returns)} = Solution().${method.name}(${args})`,
          `            ${encodeExpr(returns, "result")}`,
        ]
      : [...decodeParams, `            ""`];

  return [
    "// Generated by Winnie Code. Do not edit.",
    "",
    "fun main(args: Array<String>) {",
    "    WinnieRunner.run(",
    "        args,",
    `        normalizeExpected = { expected -> ${encodeExpr(returns, decodeExpr(returns, `${IO}.parse(expected)`))} },`,
    "        invoke = { input ->",
    ...body,
    "        },",
    "    )",
    "}",
    "",
  ].join("\n");
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

/** Contents of cases.txt: one line per test with base64 inputs followed by the base64 expected value. */
export function encodeCases(tests: TestCase[]): string {
  return tests.map((t) => [...t.input, t.expected].map(b64).join(" ")).join("\n") + "\n";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/harness.test.ts && npm run typecheck`
Expected: all tests PASS; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add server/harness.ts server/harness.test.ts
git commit -m "feat: generate the Kotlin test harness

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: Compiler diagnostics and harness output parsing

**Files:**
- Create: `server/diagnostics.ts`, `server/output.ts`
- Test: `server/diagnostics.test.ts`, `server/output.test.ts`

**Interfaces:**
- Consumes: `Diagnostic`, `CaseResult` from `shared/api.ts`; `Problem` from `server/problems.ts`.
- Produces:
  - `parseDiagnostics(raw: string, file?: string): Diagnostic[]` (default file `"Solution.kt"`)
  - `type HarnessCase = { index: number; status: "ok" | "error"; elapsedMs: number; output: string; expected: string; stdout: string; error: string }`
  - `parseHarnessOutput(stdout: string, token: string): Map<number, HarnessCase>`
  - `type Ending = { kind: "exited" } | { kind: "timeout" } | { kind: "crashed"; detail: string }`
  - `DISPLAY_LIMIT = 65536`; `truncate(s: string, limit?: number): string`
  - `buildCaseResults(problem: Problem, harness: Map<number, HarnessCase>, ending: Ending): CaseResult[]`

Real `kotlinc` 2.4 output (captured while planning) looks like this. Diagnostics go to stderr, with paths relative to the working directory, and each one is followed by the source line and a caret line:
```
Solution.kt:4:26: error: unresolved reference 'c'.
        return "x" + 1 + c + d
                         ^
```

- [ ] **Step 1: Write the failing diagnostics test** — `server/diagnostics.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { parseDiagnostics } from "./diagnostics";

const RAW = [
  "Solution.kt:4:16: error: return type mismatch: expected 'Int', actual 'String'.",
  '        return "x" + 1 + c',
  "               ^^^^^^^^^^^",
  "Solution.kt:4:26: error: unresolved reference 'c'.",
  '        return "x" + 1 + c',
  "                         ^",
  "Main.kt:9:13: error: unresolved reference 'Solution'.",
  "Solution.kt:2:9: warning: variable 'unused' is never used.",
  "Solution.kt:1:1: info: something informational",
].join("\n");

describe("parseDiagnostics", () => {
  it("extracts errors and warnings for Solution.kt only", () => {
    expect(parseDiagnostics(RAW)).toEqual([
      { line: 4, column: 16, severity: "error", message: "return type mismatch: expected 'Int', actual 'String'." },
      { line: 4, column: 26, severity: "error", message: "unresolved reference 'c'." },
      { line: 2, column: 9, severity: "warning", message: "variable 'unused' is never used." },
    ]);
  });

  it("matches files by basename even with absolute paths", () => {
    expect(parseDiagnostics("/tmp/winnie-x/Solution.kt:3:5: error: boom")).toEqual([
      { line: 3, column: 5, severity: "error", message: "boom" },
    ]);
  });

  it("can target another file", () => {
    expect(parseDiagnostics(RAW, "Main.kt")).toEqual([
      { line: 9, column: 13, severity: "error", message: "unresolved reference 'Solution'." },
    ]);
  });

  it("returns an empty list for unrelated output", () => {
    expect(parseDiagnostics("error: something without a location")).toEqual([]);
  });
});
```

- [ ] **Step 2: Write the failing output test** — `server/output.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { buildCaseResults, DISPLAY_LIMIT, parseHarnessOutput, truncate, type HarnessCase } from "./output";
import type { Problem } from "./problems";
import { parseType } from "./types";

const TOKEN = "tok123";
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

function line(index: number, status: string, fields: Partial<Record<"output" | "expected" | "stdout" | "error", string>> = {}, token = TOKEN) {
  return [token, index, status, 7, b64(fields.output ?? ""), b64(fields.expected ?? ""), b64(fields.stdout ?? ""), b64(fields.error ?? "")].join("|");
}

const problem: Problem = {
  slug: "sum",
  title: "Sum",
  difficulty: "Easy",
  description: "",
  method: { name: "sum", params: [{ name: "nums", type: parseType("IntArray") }], returns: parseType("Int") },
  tests: [
    { input: ["[1,2]"], expected: "3" },
    { input: ["[5]"], expected: "5" },
    { input: ["[]"], expected: "0" },
  ],
};

function harness(...cases: HarnessCase[]): Map<number, HarnessCase> {
  return new Map(cases.map((c) => [c.index, c]));
}

const ok = (index: number, output: string, expected: string, stdout = ""): HarnessCase => ({
  index,
  status: "ok",
  elapsedMs: 3,
  output,
  expected,
  stdout,
  error: "",
});

describe("parseHarnessOutput", () => {
  it("decodes tagged lines", () => {
    const out = [
      "some stray line",
      line(0, "ok", { output: "3", expected: "3", stdout: "hi|there\n" }),
      line(1, "error", { error: "java.lang.RuntimeException: boom" }),
    ].join("\n");
    const cases = parseHarnessOutput(out, TOKEN);
    expect(cases.get(0)).toEqual({ index: 0, status: "ok", elapsedMs: 7, output: "3", expected: "3", stdout: "hi|there\n", error: "" });
    expect(cases.get(1)?.status).toBe("error");
    expect(cases.get(1)?.error).toBe("java.lang.RuntimeException: boom");
    expect(cases.size).toBe(2);
  });

  it("ignores lines with the wrong token, bad status or wrong shape, and keeps the first line per index", () => {
    const out = [
      line(0, "ok", { output: "forged" }, "othertoken"),
      line(0, "weird"),
      `${TOKEN}|0|ok`,
      line(0, "ok", { output: "real" }),
      line(0, "ok", { output: "duplicate" }),
    ].join("\n");
    const cases = parseHarnessOutput(out, TOKEN);
    expect(cases.size).toBe(1);
    expect(cases.get(0)?.output).toBe("real");
  });
});

describe("truncate", () => {
  it("leaves short text alone and marks truncated text", () => {
    expect(truncate("abc")).toBe("abc");
    const long = "x".repeat(DISPLAY_LIMIT + 10);
    const result = truncate(long);
    expect(result.startsWith("x".repeat(DISPLAY_LIMIT))).toBe(true);
    expect(result.endsWith("… truncated (64 KB limit)")).toBe(true);
  });
});

describe("buildCaseResults", () => {
  it("marks accepted and wrong answers and carries inputs, expected and stdout", () => {
    const results = buildCaseResults(problem, harness(ok(0, "3", "3", "debug\n"), ok(1, "4", "5"), ok(2, "0", "0")), { kind: "exited" });
    expect(results[0]).toEqual({
      index: 0,
      input: [{ name: "nums", value: "[1,2]" }],
      expected: "3",
      verdict: "accepted",
      output: "3",
      stdout: "debug\n",
      elapsedMs: 3,
    });
    expect(results[1].verdict).toBe("wrong_answer");
    expect(results[1].output).toBe("4");
    expect(results[2].verdict).toBe("accepted");
  });

  it("compares against the normalized expected but displays the original", () => {
    const p: Problem = { ...problem, tests: [{ input: ["[1]"], expected: "1.00000" }] };
    const [result] = buildCaseResults(p, harness(ok(0, "1.0", "1.0")), { kind: "exited" });
    expect(result.verdict).toBe("accepted");
    expect(result.expected).toBe("1.00000");
  });

  it("reports runtime errors", () => {
    const results = buildCaseResults(
      problem,
      harness({ index: 0, status: "error", elapsedMs: 1, output: "", expected: "3", stdout: "before crash", error: "java.lang.IllegalStateException" }),
      { kind: "exited" },
    );
    expect(results[0]).toMatchObject({ verdict: "runtime_error", stdout: "before crash", error: "java.lang.IllegalStateException" });
    expect(results[0].output).toBeUndefined();
  });

  it("marks missing cases as time limit exceeded after a timeout", () => {
    const results = buildCaseResults(problem, harness(ok(0, "3", "3")), { kind: "timeout" });
    expect(results.map((r) => r.verdict)).toEqual(["accepted", "time_limit_exceeded", "time_limit_exceeded"]);
  });

  it("marks missing cases as runtime errors after a crash or early exit", () => {
    const crashed = buildCaseResults(problem, harness(ok(0, "3", "3")), { kind: "crashed", detail: "JVM died" });
    expect(crashed[1]).toMatchObject({ verdict: "runtime_error", error: "JVM died" });
    const exited = buildCaseResults(problem, harness(), { kind: "exited" });
    expect(exited[0]).toMatchObject({ verdict: "runtime_error", error: "The program exited before this case finished." });
  });

  it("compares full output before truncating it for display", () => {
    const big = "y".repeat(DISPLAY_LIMIT + 1);
    const [result] = buildCaseResults({ ...problem, tests: [problem.tests[0]] }, harness(ok(0, big, big)), { kind: "exited" });
    expect(result.verdict).toBe("accepted");
    expect(result.output!.length).toBeLessThan(big.length + 40);
    expect(result.output!.endsWith("… truncated (64 KB limit)")).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run server/diagnostics.test.ts server/output.test.ts`
Expected: FAIL. The modules `./diagnostics` and `./output` cannot be resolved.

- [ ] **Step 4: Write `server/diagnostics.ts`**

```ts
import path from "node:path";
import type { Diagnostic } from "../shared/api";

const DIAGNOSTIC_LINE = /^(.+?\.kt):(\d+):(\d+): (error|warning|info): (.*)$/;

/** Extracts kotlinc diagnostics that belong to `file` (errors and warnings only). */
export function parseDiagnostics(raw: string, file = "Solution.kt"): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const match = DIAGNOSTIC_LINE.exec(line);
    if (!match) continue;
    const [, filePath, lineNo, column, severity, message] = match;
    if (path.basename(filePath) !== file) continue;
    if (severity !== "error" && severity !== "warning") continue;
    diagnostics.push({ line: Number(lineNo), column: Number(column), severity, message });
  }
  return diagnostics;
}
```

- [ ] **Step 5: Write `server/output.ts`**

```ts
import type { CaseResult } from "../shared/api";
import type { Problem } from "./problems";

export type HarnessCase = {
  index: number;
  status: "ok" | "error";
  elapsedMs: number;
  output: string;
  expected: string;
  stdout: string;
  error: string;
};

export type Ending = { kind: "exited" } | { kind: "timeout" } | { kind: "crashed"; detail: string };

export const DISPLAY_LIMIT = 64 * 1024;

export function truncate(s: string, limit = DISPLAY_LIMIT): string {
  return s.length <= limit ? s : `${s.slice(0, limit)}\n… truncated (64 KB limit)`;
}

const unb64 = (s: string) => Buffer.from(s, "base64").toString("utf8");

/** Parses WinnieRunner's tagged lines. Lines without the exact token and shape are ignored; the first line per index wins. */
export function parseHarnessOutput(stdout: string, token: string): Map<number, HarnessCase> {
  const cases = new Map<number, HarnessCase>();
  for (const line of stdout.split("\n")) {
    const parts = line.trimEnd().split("|");
    if (parts.length !== 8 || parts[0] !== token) continue;
    const [, rawIndex, status, rawMs, output, expected, out, error] = parts;
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || (status !== "ok" && status !== "error")) continue;
    if (cases.has(index)) continue;
    cases.set(index, {
      index,
      status,
      elapsedMs: Number(rawMs),
      output: unb64(output),
      expected: unb64(expected),
      stdout: unb64(out),
      error: unb64(error),
    });
  }
  return cases;
}

/** Turns harness results into per-test verdicts. Cases the harness never reported are explained by `ending`. */
export function buildCaseResults(problem: Problem, harness: Map<number, HarnessCase>, ending: Ending): CaseResult[] {
  return problem.tests.map((test, index): CaseResult => {
    const base = {
      index,
      input: problem.method.params.map((p, i) => ({ name: p.name, value: test.input[i] })),
      expected: test.expected,
    };
    const h = harness.get(index);
    if (!h) {
      if (ending.kind === "timeout") return { ...base, verdict: "time_limit_exceeded", stdout: "" };
      const error = ending.kind === "crashed" ? ending.detail : "The program exited before this case finished.";
      return { ...base, verdict: "runtime_error", stdout: "", error };
    }
    if (h.status === "error") {
      return { ...base, verdict: "runtime_error", stdout: truncate(h.stdout), error: truncate(h.error), elapsedMs: h.elapsedMs };
    }
    return {
      ...base,
      verdict: h.output === h.expected ? "accepted" : "wrong_answer",
      output: truncate(h.output),
      stdout: truncate(h.stdout),
      elapsedMs: h.elapsedMs,
    };
  });
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run server/diagnostics.test.ts server/output.test.ts && npm run typecheck`
Expected: all tests PASS; typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add server/diagnostics.ts server/diagnostics.test.ts server/output.ts server/output.test.ts
git commit -m "feat: parse compiler diagnostics and harness output

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Run pipeline with real kotlinc integration tests

**Files:**
- Create: `server/runner.ts`
- Test: `server/runner.test.ts`

**Interfaces:**
- Consumes: `Toolchain` (Task 5), `runProcess`/`ProcResult` (Task 5), `generateMain`/`encodeCases`/`HarnessMode` (Task 6), `parseDiagnostics`, `parseHarnessOutput`, `buildCaseResults`, `Ending` (Task 7), `Problem` (Task 3), `RunResponse` (Task 1), `getTestToolchain`/`FIXTURE_PROBLEMS` (Task 5 test helpers).
- Produces:
  - `DEFAULT_RUN_TIMEOUT_MS = 10_000`
  - `runSolution(tc: Toolchain, problem: Problem, code: string, timeoutMs?: number): Promise<RunResponse>`
  - `checkProblemLiterals(tc: Toolchain, problem: Problem): Promise<string[]>`. Returns one message per bad test, formatted `tests[i]: ...`, or `[]` when every literal parses.

- [ ] **Step 1: Write the failing integration test** — `server/runner.test.ts`

```ts
import { beforeAll, describe, expect, it } from "vitest";
import type { RunResponse } from "../shared/api";
import { loadProblem, type Problem } from "./problems";
import { checkProblemLiterals, runSolution } from "./runner";
import { FIXTURE_PROBLEMS, getTestToolchain } from "./test-helpers";
import type { Toolchain } from "./toolchain";

let tc: Toolchain;
beforeAll(async () => {
  tc = await getTestToolchain();
});

async function fixture(slug: string): Promise<Problem> {
  const entry = await loadProblem(FIXTURE_PROBLEMS, slug);
  if (!entry?.ok) throw new Error(`fixture ${slug} failed to load`);
  return entry.problem;
}

function expectRan(res: RunResponse): Extract<RunResponse, { status: "ran" }> {
  if (res.status !== "ran") throw new Error(`expected status "ran" but got ${JSON.stringify(res, null, 2)}`);
  return res;
}

describe.concurrent("runSolution", () => {
  it("accepts a correct solution and captures println output per case", async () => {
    const code = [
      "class Solution {",
      "    fun sum(nums: IntArray): Int {",
      '        println("size=${nums.size}")',
      "        return nums.sum()",
      "    }",
      "}",
    ].join("\n");
    const res = expectRan(await runSolution(tc, await fixture("sum-array"), code));
    expect(res.passed).toBe(3);
    expect(res.total).toBe(3);
    expect(res.cases.map((c) => c.verdict)).toEqual(["accepted", "accepted", "accepted"]);
    expect(res.cases[0].stdout).toBe("size=3\n");
    expect(res.cases[0].input).toEqual([{ name: "nums", value: "[1,2,3]" }]);
    expect(res.elapsedMs).toBeGreaterThan(0);
  });

  it("reports wrong answers with the actual output", async () => {
    const res = expectRan(await runSolution(tc, await fixture("sum-array"), "class Solution { fun sum(nums: IntArray): Int = 42 }"));
    expect(res.passed).toBe(0);
    expect(res.cases[0]).toMatchObject({ verdict: "wrong_answer", output: "42", expected: "6" });
  });

  it("reports compile errors on the user's own line numbers", async () => {
    const code = ["class Solution {", "    fun sum(nums: IntArray): Int {", "        return nums.summ()", "    }", "}"].join("\n");
    const res = await runSolution(tc, await fixture("sum-array"), code);
    expect(res.status).toBe("compile_error");
    if (res.status !== "compile_error") return;
    expect(res.diagnostics[0]).toMatchObject({ line: 3, severity: "error" });
    expect(res.diagnostics[0].message).toContain("summ");
    expect(res.raw).toContain("Solution.kt:3:");
  });

  it("isolates runtime errors to the failing case", async () => {
    const code = [
      "class Solution {",
      "    fun sum(nums: IntArray): Int {",
      '        if (nums.isEmpty()) throw IllegalStateException("empty!")',
      "        return nums.sum()",
      "    }",
      "}",
    ].join("\n");
    const res = expectRan(await runSolution(tc, await fixture("sum-array"), code));
    expect(res.cases.map((c) => c.verdict)).toEqual(["accepted", "runtime_error", "accepted"]);
    expect(res.cases[1].error).toContain("java.lang.IllegalStateException: empty!");
    expect(res.cases[1].error).toContain("Solution.kt:3");
  });

  it("stops infinite loops with time limit exceeded", async () => {
    const code = [
      "class Solution {",
      "    fun sum(nums: IntArray): Int {",
      "        if (nums.size == 2) while (true) {}",
      "        return nums.sum()",
      "    }",
      "}",
    ].join("\n");
    const res = expectRan(await runSolution(tc, await fixture("sum-array"), code, 4_000));
    expect(res.cases.map((c) => c.verdict)).toEqual(["accepted", "accepted", "time_limit_exceeded"]);
  });

  it("supports deep recursion and reports stack overflows as runtime errors", async () => {
    const code = [
      "class Solution {",
      "    fun depth(n: Int): Int = if (n == 0) 0 else 1 + depth(n - 1)",
      "    fun forever(n: Int): Int = 1 + forever(n + 1)",
      "    fun sum(nums: IntArray): Int {",
      "        if (nums.isEmpty()) return forever(0)",
      "        return nums.sum() + depth(200_000) - 200_000",
      "    }",
      "}",
    ].join("\n");
    const res = expectRan(await runSolution(tc, await fixture("sum-array"), code));
    expect(res.cases.map((c) => c.verdict)).toEqual(["accepted", "runtime_error", "accepted"]);
    expect(res.cases[1].error).toContain("StackOverflowError");
  });

  it("handles linked lists", async () => {
    const code = [
      "class Solution {",
      "    fun reverseList(head: ListNode?): ListNode? {",
      "        var prev: ListNode? = null",
      "        var cur = head",
      "        while (cur != null) {",
      "            val next = cur.next",
      "            cur.next = prev",
      "            prev = cur",
      "            cur = next",
      "        }",
      "        return prev",
      "    }",
      "}",
    ].join("\n");
    const res = expectRan(await runSolution(tc, await fixture("reverse-list"), code));
    expect(res.passed).toBe(3);
  });

  it("handles binary trees", async () => {
    const code = [
      "class Solution {",
      "    fun invertTree(root: TreeNode?): TreeNode? {",
      "        if (root == null) return null",
      "        val left = invertTree(root.left)",
      "        root.left = invertTree(root.right)",
      "        root.right = left",
      "        return root",
      "    }",
      "}",
    ].join("\n");
    const res = expectRan(await runSolution(tc, await fixture("invert-tree"), code));
    expect(res.passed).toBe(3);
  });

  it("handles nested lists with escaped strings", async () => {
    const code = "class Solution { fun chunk(words: List<String>, size: Int): List<List<String>> = words.chunked(size) }";
    const res = expectRan(await runSolution(tc, await fixture("chunk-words"), code));
    expect(res.passed).toBe(2);
  });

  it("normalizes doubles before comparing", async () => {
    const code = "class Solution { fun average(nums: IntArray): Double = nums.average() }";
    const res = expectRan(await runSolution(tc, await fixture("average"), code));
    expect(res.passed).toBe(2);
    expect(res.cases[0]).toMatchObject({ output: "1.5", expected: "1.50000" });
  });

  it("handles Array<String> params and CharArray results", async () => {
    const code = "class Solution { fun firstChars(words: Array<String>): CharArray = words.map { it[0] }.toCharArray() }";
    const res = expectRan(await runSolution(tc, await fixture("first-chars"), code));
    expect(res.passed).toBe(1);
  });
});

describe.concurrent("checkProblemLiterals", () => {
  it("accepts valid fixtures", async () => {
    for (const slug of ["sum-array", "reverse-list", "invert-tree", "chunk-words", "average", "first-chars"]) {
      expect(await checkProblemLiterals(tc, await fixture(slug)), slug).toEqual([]);
    }
  });

  it("reports literals that do not match the declared types", async () => {
    const base = await fixture("sum-array");
    const broken: Problem = {
      ...base,
      tests: [
        { input: ["[1,2"], expected: "3" },
        { input: ["[1,2]"], expected: "\"three\"" },
        { input: ["[1,2]"], expected: "3" },
      ],
    };
    const errors = await checkProblemLiterals(tc, broken);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/^tests\[0\]: .*Invalid literal/);
    expect(errors[1]).toMatch(/^tests\[1\]: Invalid expected value in problem.json: Expected an Int/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/runner.test.ts`
Expected: FAIL. The module `./runner` cannot be resolved.

- [ ] **Step 3: Write the implementation** — `server/runner.ts`

```ts
import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { RunResponse } from "../shared/api";
import { parseDiagnostics } from "./diagnostics";
import { encodeCases, generateMain, type HarnessMode } from "./harness";
import { buildCaseResults, parseHarnessOutput, type Ending } from "./output";
import type { Problem } from "./problems";
import { runProcess, type ProcResult } from "./proc";
import type { Toolchain } from "./toolchain";

export const DEFAULT_RUN_TIMEOUT_MS = 10_000;
const COMPILE_TIMEOUT_MS = 120_000;
const CHECK_TIMEOUT_MS = 30_000;

type Execution =
  | { kind: "compile_error"; raw: string }
  | { kind: "executed"; stdout: string; ending: Ending; token: string };

function crashDetail(run: ProcResult): string {
  if (run.outputLimitExceeded) return "The program produced too much output and was stopped.";
  const tail = run.stderr.trim().split("\n").slice(-20).join("\n");
  return tail || `The program exited unexpectedly (${run.signal ?? `exit code ${run.exitCode}`}).`;
}

/** Writes Solution.kt (unless code is null), Main.kt and cases.txt to a temp dir, compiles, runs, and cleans up. */
async function compileAndExecute(
  tc: Toolchain,
  problem: Problem,
  mode: HarnessMode,
  code: string | null,
  timeoutMs: number,
): Promise<Execution> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "winnie-"));
  try {
    const sources = ["Main.kt"];
    if (code !== null) {
      await writeFile(path.join(dir, "Solution.kt"), code);
      sources.unshift("Solution.kt");
    }
    await writeFile(path.join(dir, "Main.kt"), generateMain(problem, mode));
    await writeFile(path.join(dir, "cases.txt"), encodeCases(problem.tests));

    const compile = await runProcess(tc.kotlinc, [...sources, "-cp", tc.supportJar, "-d", "out"], {
      cwd: dir,
      timeoutMs: COMPILE_TIMEOUT_MS,
    });
    if (compile.exitCode !== 0) {
      const raw = compile.timedOut
        ? "Compilation timed out."
        : `${compile.stderr}${compile.stdout}`.split(dir + path.sep).join("").trim();
      return { kind: "compile_error", raw };
    }

    const token = randomBytes(16).toString("hex");
    const classpath = ["out", tc.supportJar].join(path.delimiter);
    const run = await runProcess(tc.java, ["-Xmx256m", "-XX:+UseSerialGC", "-cp", classpath, "MainKt", "cases.txt", token], {
      cwd: dir,
      timeoutMs,
    });
    const ending: Ending = run.timedOut
      ? { kind: "timeout" }
      : run.exitCode === 0
        ? { kind: "exited" }
        : { kind: "crashed", detail: crashDetail(run) };
    return { kind: "executed", stdout: run.stdout, ending, token };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function runSolution(
  tc: Toolchain,
  problem: Problem,
  code: string,
  timeoutMs = DEFAULT_RUN_TIMEOUT_MS,
): Promise<RunResponse> {
  const started = Date.now();
  const execution = await compileAndExecute(tc, problem, "run", code, timeoutMs);
  if (execution.kind === "compile_error") {
    return { status: "compile_error", diagnostics: parseDiagnostics(execution.raw), raw: execution.raw };
  }
  const cases = buildCaseResults(problem, parseHarnessOutput(execution.stdout, execution.token), execution.ending);
  return {
    status: "ran",
    passed: cases.filter((c) => c.verdict === "accepted").length,
    total: cases.length,
    elapsedMs: Date.now() - started,
    cases,
  };
}

/** Parses every input and expected literal against the declared types without running any solution. */
export async function checkProblemLiterals(tc: Toolchain, problem: Problem): Promise<string[]> {
  const execution = await compileAndExecute(tc, problem, "check", null, CHECK_TIMEOUT_MS);
  if (execution.kind === "compile_error") return [`The check harness failed to compile:\n${execution.raw}`];
  const harness = parseHarnessOutput(execution.stdout, execution.token);
  return problem.tests.flatMap((_, i) => {
    const result = harness.get(i);
    if (!result) return [`tests[${i}]: was not checked (${execution.ending.kind})`];
    return result.status === "error" ? [`tests[${i}]: ${result.error.split("\n")[0]}`] : [];
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/runner.test.ts && npm run typecheck`
Expected: all tests PASS (roughly 20–40 s total, because every case compiles with `kotlinc`); typecheck exits 0.

If "supports deep recursion" fails with a StackOverflowError on the accepted cases, check that `WinnieRunner` really starts its worker thread with `STACK_SIZE`.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: every test file PASSES.

- [ ] **Step 6: Commit**

```bash
git add server/runner.ts server/runner.test.ts
git commit -m "feat: compile and run solutions against test cases

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: HTTP API, server entrypoint and check-problems CLI

**Files:**
- Create: `server/app.ts`, `server/paths.ts`, `server/index.ts`, `server/check-problems.ts`
- Test: `server/app.test.ts`

**Interfaces:**
- Consumes: `listProblems`, `loadProblem` (Task 3), `generateTemplate` (Task 4), `prepareToolchain`/`Toolchain` (Task 5), `runSolution`/`checkProblemLiterals` (Task 8), API types (Task 1).
- Produces:
  - `buildApp(opts: { problemsDir: string; toolchain: Toolchain; staticDir?: string; runTimeoutMs?: number }): FastifyInstance`
  - Routes:
    - `GET /api/problems` returns `{ problems: ProblemSummary[] }`
    - `GET /api/problems/:slug` returns `ProblemDetail`; 404 `{ error }` if unknown; 422 `{ error }` if invalid
    - `POST /api/run` with body `{ slug, code }` returns `RunResponse`; 400/404/422 `{ error }`
  - `server/paths.ts`: `ROOT`, `SUPPORT_DIR`, `CACHE_DIR`, `WEB_DIST`, `problemsDir(): string` (honors `WINNIE_PROBLEMS_DIR`)
  - Environment variables: `PORT` (default 5174), `NODE_ENV=production` (serve `web/dist`), `WINNIE_PROBLEMS_DIR` (default `<root>/problems`)
  - `npm run check-problems [slug]` exits 1 if any problem is invalid

- [ ] **Step 1: Write the failing test** — `server/app.test.ts`

```ts
import { afterAll, describe, expect, it } from "vitest";
import type { ProblemDetail, ProblemSummary, RunResponse } from "../shared/api";
import { buildApp } from "./app";
import { FIXTURE_PROBLEMS, getTestToolchain } from "./test-helpers";

const fakeToolchain = { kotlinc: "kotlinc", java: "java", supportJar: "/nonexistent.jar" };
const app = buildApp({ problemsDir: FIXTURE_PROBLEMS, toolchain: fakeToolchain });

afterAll(async () => {
  await app.close();
});

describe("GET /api/problems", () => {
  it("lists valid and invalid problems", async () => {
    const res = await app.inject({ method: "GET", url: "/api/problems" });
    expect(res.statusCode).toBe(200);
    const { problems } = res.json() as { problems: ProblemSummary[] };
    expect(problems.find((p) => p.slug === "sum-array")).toEqual({ slug: "sum-array", ok: true, title: "Sum Array", difficulty: "Easy" });
    expect(problems.find((p) => p.slug === "broken")).toMatchObject({ slug: "broken", ok: false, error: expect.stringContaining("difficulty") });
  });
});

describe("GET /api/problems/:slug", () => {
  it("returns the description and generated template", async () => {
    const res = await app.inject({ method: "GET", url: "/api/problems/reverse-list" });
    expect(res.statusCode).toBe(200);
    const detail = res.json() as ProblemDetail;
    expect(detail).toMatchObject({ slug: "reverse-list", title: "Reverse Linked List", difficulty: "Easy" });
    expect(detail.description).toContain("Reverse the singly linked list");
    expect(detail.template).toContain("fun reverseList(head: ListNode?): ListNode? {");
  });

  it("404s for unknown or unsafe slugs and 422s for invalid problems", async () => {
    expect((await app.inject({ method: "GET", url: "/api/problems/nope" })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/api/problems/..%2Fproblems" })).statusCode).toBe(404);
    const invalid = await app.inject({ method: "GET", url: "/api/problems/broken" });
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json().error).toContain("difficulty");
  });
});

describe("POST /api/run", () => {
  it("validates the body", async () => {
    const res = await app.inject({ method: "POST", url: "/api/run", payload: { slug: "sum-array" } });
    expect(res.statusCode).toBe(400);
  });

  it("404s for unknown problems", async () => {
    const res = await app.inject({ method: "POST", url: "/api/run", payload: { slug: "nope", code: "" } });
    expect(res.statusCode).toBe(404);
  });

  it("returns internal_error when the toolchain fails", async () => {
    const broken = buildApp({
      problemsDir: FIXTURE_PROBLEMS,
      toolchain: { kotlinc: "/definitely/missing/kotlinc", java: "java", supportJar: "x" },
    });
    const res = await broken.inject({ method: "POST", url: "/api/run", payload: { slug: "sum-array", code: "class Solution" } });
    expect(res.statusCode).toBe(200);
    expect((res.json() as RunResponse).status).toBe("internal_error");
    await broken.close();
  });

  it("runs code end to end with the real toolchain", async () => {
    const real = buildApp({ problemsDir: FIXTURE_PROBLEMS, toolchain: await getTestToolchain() });
    const res = await real.inject({
      method: "POST",
      url: "/api/run",
      payload: { slug: "sum-array", code: "class Solution { fun sum(nums: IntArray): Int = nums.sum() }" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ran", passed: 3, total: 3 });
    await real.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/app.test.ts`
Expected: FAIL. The module `./app` cannot be resolved.

- [ ] **Step 3: Write `server/app.ts`**

```ts
import { existsSync } from "node:fs";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import type { ProblemDetail, ProblemSummary, RunResponse } from "../shared/api";
import { listProblems, loadProblem } from "./problems";
import { runSolution } from "./runner";
import { generateTemplate } from "./template";
import type { Toolchain } from "./toolchain";

export type AppOptions = {
  problemsDir: string;
  toolchain: Toolchain;
  /** Built frontend to serve (production). */
  staticDir?: string;
  runTimeoutMs?: number;
};

export function buildApp(opts: AppOptions): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 1024 * 1024 });

  app.get("/api/problems", async (): Promise<{ problems: ProblemSummary[] }> => {
    const entries = await listProblems(opts.problemsDir);
    return {
      problems: entries.map((e): ProblemSummary =>
        e.ok
          ? { slug: e.slug, ok: true, title: e.problem.title, difficulty: e.problem.difficulty }
          : { slug: e.slug, ok: false, error: e.error },
      ),
    };
  });

  app.get<{ Params: { slug: string } }>("/api/problems/:slug", async (req, reply) => {
    const entry = await loadProblem(opts.problemsDir, req.params.slug);
    if (!entry) return reply.code(404).send({ error: "Problem not found" });
    if (!entry.ok) return reply.code(422).send({ error: entry.error });
    const { problem } = entry;
    const detail: ProblemDetail = {
      slug: problem.slug,
      title: problem.title,
      difficulty: problem.difficulty,
      description: problem.description,
      template: generateTemplate(problem.method),
    };
    return detail;
  });

  app.post<{ Body: { slug?: unknown; code?: unknown } | null }>("/api/run", async (req, reply) => {
    const slug = req.body?.slug;
    const code = req.body?.code;
    if (typeof slug !== "string" || typeof code !== "string") {
      return reply.code(400).send({ error: "Body must be { slug: string, code: string }" });
    }
    const entry = await loadProblem(opts.problemsDir, slug);
    if (!entry) return reply.code(404).send({ error: "Problem not found" });
    if (!entry.ok) return reply.code(422).send({ error: entry.error });
    try {
      return await runSolution(opts.toolchain, entry.problem, code, opts.runTimeoutMs);
    } catch (e) {
      console.error(e);
      const response: RunResponse = { status: "internal_error", message: (e as Error).message };
      return response;
    }
  });

  if (opts.staticDir && existsSync(opts.staticDir)) {
    app.register(fastifyStatic, { root: opts.staticDir });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && !req.url.startsWith("/api/")) return reply.sendFile("index.html");
      return reply.code(404).send({ error: "Not found" });
    });
  }

  return app;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/app.test.ts && npm run typecheck`
Expected: all tests PASS; typecheck exits 0.

- [ ] **Step 5: Write `server/paths.ts` and `server/index.ts`**

`server/paths.ts`:
```ts
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SUPPORT_DIR = path.join(ROOT, "kotlin-support");
export const CACHE_DIR = path.join(ROOT, ".cache");
export const WEB_DIST = path.join(ROOT, "web", "dist");

/** problems/ in the repo, unless WINNIE_PROBLEMS_DIR points elsewhere (used for manual testing with fixtures). */
export function problemsDir(): string {
  const override = process.env.WINNIE_PROBLEMS_DIR;
  return override ? path.resolve(override) : path.join(ROOT, "problems");
}
```

`server/index.ts`:
```ts
import { buildApp } from "./app";
import { CACHE_DIR, problemsDir, SUPPORT_DIR, WEB_DIST } from "./paths";
import { prepareToolchain, type Toolchain } from "./toolchain";

const port = Number(process.env.PORT ?? 5174);
const production = process.env.NODE_ENV === "production";

let toolchain: Toolchain;
try {
  console.log("Preparing the Kotlin toolchain (the first start compiles the support library)…");
  toolchain = await prepareToolchain({ supportDir: SUPPORT_DIR, cacheDir: CACHE_DIR });
} catch (e) {
  console.error(`\n✖ ${(e as Error).message}\n`);
  process.exit(1);
}

const app = buildApp({
  problemsDir: problemsDir(),
  toolchain,
  staticDir: production ? WEB_DIST : undefined,
});
await app.listen({ port, host: "127.0.0.1" });

console.log(`Problems directory: ${problemsDir()}`);
console.log(production ? `Winnie Code is running at http://localhost:${port}` : `API listening on :${port}. Open http://localhost:5173`);
```

- [ ] **Step 6: Write `server/check-problems.ts`**

```ts
import { CACHE_DIR, problemsDir, SUPPORT_DIR } from "./paths";
import { listProblems } from "./problems";
import { checkProblemLiterals } from "./runner";
import { prepareToolchain } from "./toolchain";

const onlySlug = process.argv[2];
const dir = problemsDir();

const toolchain = await prepareToolchain({ supportDir: SUPPORT_DIR, cacheDir: CACHE_DIR });
const entries = (await listProblems(dir)).filter((e) => !onlySlug || e.slug === onlySlug);

if (entries.length === 0) {
  console.log(onlySlug ? `No problem named "${onlySlug}" in ${dir}` : `No problems found in ${dir}`);
  process.exit(onlySlug ? 1 : 0);
}

let failed = false;
for (const entry of entries) {
  if (!entry.ok) {
    failed = true;
    console.log(`✖ ${entry.slug}: ${entry.error}`);
    continue;
  }
  const errors = await checkProblemLiterals(toolchain, entry.problem);
  if (errors.length > 0) {
    failed = true;
    console.log(`✖ ${entry.slug}`);
    for (const error of errors) console.log(`    ${error}`);
  } else {
    console.log(`✓ ${entry.slug} (${entry.problem.tests.length} tests)`);
  }
}
process.exit(failed ? 1 : 0);
```

- [ ] **Step 7: Verify the CLI and server manually**

Run: `WINNIE_PROBLEMS_DIR=server/__fixtures__/problems npm run check-problems`
Expected: `✓` lines for the six valid fixtures, `✖ broken: difficulty must be one of Easy, Medium, Hard`, and exit code 1.

Run: `npm run check-problems`
Expected: `No problems found in …/problems`, exit code 0.

Run (in the background): `WINNIE_PROBLEMS_DIR=server/__fixtures__/problems npm run dev:server`. Then run `curl -s localhost:5174/api/problems`.
Expected: JSON listing the seven fixture problems. Stop the server afterwards.

Run: `PATH=/usr/bin:/bin "$(which node)" --import tsx server/index.ts`. Node is called by absolute path, so `kotlinc` (which Homebrew installs next to `node`) is not on `PATH`.
Expected: prints `✖ kotlinc was not found on PATH…` and exits 1.

- [ ] **Step 8: Commit**

```bash
git add server/app.ts server/app.test.ts server/paths.ts server/index.ts server/check-problems.ts
git commit -m "feat: add HTTP API, server entrypoint and check-problems CLI

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 10: Web foundation: theme, header and problem list

**Files:**
- Create: `web/index.html`, `web/public/favicon.svg`, `web/src/vite-env.d.ts`, `web/src/main.tsx`, `web/src/App.tsx`
- Create: `web/src/router.tsx`, `web/src/api.ts`, `web/src/storage.ts`, `web/src/theme.ts`, `web/src/styles.css`
- Create: `web/src/components/Icons.tsx`, `web/src/components/ThemeToggle.tsx`, `web/src/components/Header.tsx`, `web/src/components/DifficultyBadge.tsx`
- Create: `web/src/pages/ProblemList.tsx`

**Interfaces:**
- Consumes: API types from `shared/api.ts`; the routes from Task 9.
- Produces:
  - `router.tsx`: `navigate(to: string): void`, `usePathname(): string`, `Link` (`{ to } & anchor props`)
  - `api.ts`: `api.problems(): Promise<ProblemSummary[]>`, `api.problem(slug): Promise<ProblemDetail>`, `api.run(slug, code): Promise<RunResponse>` (non-2xx → throws `Error(body.error)`)
  - `storage.ts`: `storageKeys.{theme, code(slug), solved(slug), split(name)}`, `readStorage(key)`, `writeStorage(key, value | null)`, `isSolved(slug)`
  - `theme.ts`: `type ThemePreference = "light" | "dark" | "system"`, `setThemePreference(p)`, `useThemePreference()`, `useIsDark()`
  - Components: `Header({ center?, actions? })`, `ThemeToggle`, `DifficultyBadge({ difficulty })`, icons `SunIcon`, `MoonIcon`, `MonitorIcon`, `PlayIcon`, `ResetIcon`, `CheckIcon`, `XIcon`, `LogoMark`
  - CSS classes used by Task 11: `.page`, `.page-fixed`, `.btn`, `.btn-primary`, `.btn-ghost`, `.kbd-hint`, `.spinner`, `.badge`, `.muted`, `.error-text`, `.list-page`

The web app has no automated tests (per the spec). Each web task is verified with `npm run typecheck`, `npm run build` and the browser.

- [ ] **Step 1: Create `web/index.html`**

The inline script applies a stored theme before first paint, so the page never flashes the wrong theme.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Winnie Code: a local Kotlin judge for LeetCode-style interview practice." />
    <title>Winnie Code</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
      rel="stylesheet"
    />
    <script>
      try {
        var t = localStorage.getItem("winnie:theme");
        if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
      } catch (e) {}
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `web/public/favicon.svg` and `web/src/vite-env.d.ts`**

`web/public/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#d97706"/>
  <path d="M14 20l8 24 10-18 10 18 8-24" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

`web/src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

- [ ] **Step 3: Create `web/src/storage.ts`**

```ts
export const storageKeys = {
  theme: "winnie:theme",
  code: (slug: string) => `winnie:code:${slug}`,
  solved: (slug: string) => `winnie:solved:${slug}`,
  split: (name: string) => `winnie:split:${name}`,
};

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Writes a value; null removes the key. Silently ignores unavailable storage. */
export function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode, blocked site data): the app still works without persistence
  }
}

export function isSolved(slug: string): boolean {
  return readStorage(storageKeys.solved(slug)) === "1";
}
```

- [ ] **Step 4: Create `web/src/theme.ts`**

```ts
import { useSyncExternalStore } from "react";
import { readStorage, storageKeys, writeStorage } from "./storage";

export type ThemePreference = "light" | "dark" | "system";

const media = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();
let preference: ThemePreference = initialPreference();

function initialPreference(): ThemePreference {
  const stored = readStorage(storageKeys.theme);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function notify(): void {
  for (const listener of listeners) listener();
}

media.addEventListener("change", notify);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setThemePreference(next: ThemePreference): void {
  preference = next;
  writeStorage(storageKeys.theme, next === "system" ? null : next);
  const root = document.documentElement;
  if (next === "system") delete root.dataset.theme;
  else root.dataset.theme = next;
  notify();
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, () => preference);
}

/** Whether the effective theme is dark (explicit choice, or the OS setting when on "system"). */
export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, () => preference === "dark" || (preference === "system" && media.matches));
}
```

- [ ] **Step 5: Create `web/src/router.tsx` and `web/src/api.ts`**

`web/src/router.tsx`:
```tsx
import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from "react";

export function navigate(to: string): void {
  if (to === window.location.pathname) return;
  window.history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

export function usePathname(): string {
  const [pathname, setPathname] = useState(window.location.pathname);
  useEffect(() => {
    const onChange = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);
  return pathname;
}

type LinkProps = { to: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

/** Client-side link; modified clicks (new tab etc.) fall through to the browser. */
export function Link({ to, onClick, ...rest }: LinkProps) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  }
  return <a href={to} onClick={handleClick} {...rest} />;
}
```

`web/src/api.ts`:
```ts
import type { ProblemDetail, ProblemSummary, RunResponse } from "../../shared/api";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      body !== null && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

export const api = {
  problems: () => request<{ problems: ProblemSummary[] }>("/api/problems").then((r) => r.problems),
  problem: (slug: string) => request<ProblemDetail>(`/api/problems/${encodeURIComponent(slug)}`),
  run: (slug: string, code: string) =>
    request<RunResponse>("/api/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, code }),
    }),
};
```

- [ ] **Step 6: Create the components**

`web/src/components/Icons.tsx`:
```tsx
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const SunIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </Icon>
);

export const MoonIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </Icon>
);

export const MonitorIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </Icon>
);

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" />
  </Icon>
);

export const ResetIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 3v6h6" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 6L9 17l-5-5" />
  </Icon>
);

export const XIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 6L6 18M6 6l12 12" />
  </Icon>
);

export function LogoMark(props: IconProps) {
  return (
    <svg viewBox="0 0 64 64" width={28} height={28} aria-hidden="true" {...props}>
      <rect width="64" height="64" rx="14" fill="var(--accent)" />
      <path
        d="M14 20l8 24 10-18 10 18 8-24"
        fill="none"
        stroke="var(--accent-contrast)"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

`web/src/components/ThemeToggle.tsx`:
```tsx
import type { ComponentType, SVGProps } from "react";
import { setThemePreference, useThemePreference, type ThemePreference } from "../theme";
import { MonitorIcon, MoonIcon, SunIcon } from "./Icons";

const OPTIONS: { value: ThemePreference; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { value: "light", label: "Light theme", Icon: SunIcon },
  { value: "system", label: "Match system theme", Icon: MonitorIcon },
  { value: "dark", label: "Dark theme", Icon: MoonIcon },
];

export function ThemeToggle() {
  const preference = useThemePreference();
  return (
    <div className="theme-toggle" role="group" aria-label="Theme">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          className="theme-option"
          aria-pressed={preference === value}
          aria-label={label}
          title={label}
          onClick={() => setThemePreference(value)}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}
```

`web/src/components/Header.tsx`:
```tsx
import type { ReactNode } from "react";
import { Link } from "../router";
import { LogoMark } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ center, actions }: { center?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="header">
      <Link to="/" className="brand" aria-label="Winnie Code: all problems">
        <LogoMark />
        <span className="brand-text">
          Winnie <span className="brand-accent">Code</span>
        </span>
      </Link>
      <div className="header-center">{center}</div>
      <div className="header-actions">
        {actions}
        <ThemeToggle />
      </div>
    </header>
  );
}
```

`web/src/components/DifficultyBadge.tsx`:
```tsx
import type { Difficulty } from "../../../shared/api";

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <span className={`badge badge-${difficulty.toLowerCase()}`}>{difficulty}</span>;
}
```

- [ ] **Step 7: Create `web/src/pages/ProblemList.tsx`**

```tsx
import { useEffect, useState } from "react";
import type { ProblemSummary } from "../../../shared/api";
import { api } from "../api";
import { DifficultyBadge } from "../components/DifficultyBadge";
import { Header } from "../components/Header";
import { CheckIcon, LogoMark } from "../components/Icons";
import { Link } from "../router";
import { isSolved } from "../storage";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; problems: ProblemSummary[] };

type ValidProblem = Extract<ProblemSummary, { ok: true }>;
type InvalidProblem = Extract<ProblemSummary, { ok: false }>;

export function ProblemList() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    document.title = "Winnie Code";
    api.problems().then(
      (problems) => setState({ status: "ready", problems }),
      (e: Error) => setState({ status: "error", message: e.message }),
    );
  }, []);

  const valid = state.status === "ready" ? state.problems.filter((p): p is ValidProblem => p.ok) : [];
  const invalid = state.status === "ready" ? state.problems.filter((p): p is InvalidProblem => !p.ok) : [];
  valid.sort((a, b) => a.title.localeCompare(b.title));
  const solvedCount = valid.filter((p) => isSolved(p.slug)).length;

  return (
    <div className="page">
      <Header />
      <main className="list-page">
        <div className="list-heading">
          <h1>Problems</h1>
          {valid.length > 0 && (
            <span className="muted">
              {solvedCount} / {valid.length} solved
            </span>
          )}
        </div>

        {state.status === "loading" && <p className="muted">Loading problems…</p>}
        {state.status === "error" && <p className="error-text">Could not load problems: {state.message}</p>}
        {state.status === "ready" && state.problems.length === 0 && <EmptyState />}

        {state.status === "ready" && state.problems.length > 0 && (
          <ul className="problem-list">
            {valid.map((p) => {
              const solved = isSolved(p.slug);
              return (
                <li key={p.slug}>
                  <Link to={`/p/${p.slug}`} className="problem-row">
                    <span className={`solved-mark${solved ? " is-solved" : ""}`} aria-label={solved ? "Solved" : "Not solved yet"}>
                      {solved && <CheckIcon width={12} height={12} strokeWidth={3} />}
                    </span>
                    <span className="problem-title">{p.title}</span>
                    <DifficultyBadge difficulty={p.difficulty} />
                  </Link>
                </li>
              );
            })}
            {invalid.map((p) => (
              <li key={p.slug}>
                <div className="problem-row problem-row-invalid">
                  <span className="solved-mark invalid" aria-label="Invalid problem">
                    !
                  </span>
                  <div className="problem-body">
                    <span className="problem-title">{p.slug}</span>
                    <span className="problem-error">{p.error}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <LogoMark width={48} height={48} />
      <h2>No problems yet</h2>
      <p>
        Paste a LeetCode-style problem into your Claude Code session and ask Claude to add it to Winnie Code. It will show
        up here.
      </p>
    </div>
  );
}
```

- [ ] **Step 8: Create `web/src/App.tsx` and `web/src/main.tsx`**

`web/src/App.tsx` (Task 11 adds the problem route):
```tsx
import { ProblemList } from "./pages/ProblemList";

export function App() {
  return <ProblemList />;
}
```

`web/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 9: Create `web/src/styles.css`**

```css
/* ---------- Tokens ---------- */
:root {
  color-scheme: light;
  --bg: #f7f5f0;
  --surface: #ffffff;
  --surface-2: #f2efe8;
  --surface-hover: #f8f6f1;
  --border: #e4e0d6;
  --border-strong: #d2cdc1;
  --text: #1f1d1a;
  --text-muted: #6b665d;
  --text-faint: #a39d91;
  --accent: #d97706;
  --accent-hover: #b45309;
  --accent-contrast: #ffffff;
  --accent-soft: #fdf1dc;
  --success: #15803d;
  --success-soft: #e6f4ea;
  --danger: #dc2626;
  --danger-soft: #fdecec;
  --warning: #b45309;
  --easy: #15803d;
  --medium: #b45309;
  --hard: #dc2626;
  --editor-bg: #ffffff;
  --editor-active-line: #faf7f0;
  --editor-selection: #fce7c2;
  --code-bg: #f4f1ea;
  --focus-ring: 0 0 0 3px rgba(217, 119, 6, 0.35);
  --shadow: 0 1px 2px rgba(31, 29, 26, 0.06), 0 1px 1px rgba(31, 29, 26, 0.04);
  --radius: 10px;
  --radius-sm: 6px;
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #121110;
    --surface: #1b1a18;
    --surface-2: #242320;
    --surface-hover: #22211e;
    --border: #302e2a;
    --border-strong: #423f38;
    --text: #ecebe7;
    --text-muted: #a8a399;
    --text-faint: #6f6a61;
    --accent: #f59e0b;
    --accent-hover: #fbbf24;
    --accent-contrast: #1c1303;
    --accent-soft: #3a2a0d;
    --success: #4ade80;
    --success-soft: #133021;
    --danger: #f87171;
    --danger-soft: #3b1818;
    --warning: #fbbf24;
    --easy: #4ade80;
    --medium: #fbbf24;
    --hard: #f87171;
    --editor-bg: #1b1a18;
    --editor-active-line: #22211e;
    --editor-selection: #4a3a1c;
    --code-bg: #242320;
    --focus-ring: 0 0 0 3px rgba(245, 158, 11, 0.4);
    --shadow: none;
  }
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #121110;
  --surface: #1b1a18;
  --surface-2: #242320;
  --surface-hover: #22211e;
  --border: #302e2a;
  --border-strong: #423f38;
  --text: #ecebe7;
  --text-muted: #a8a399;
  --text-faint: #6f6a61;
  --accent: #f59e0b;
  --accent-hover: #fbbf24;
  --accent-contrast: #1c1303;
  --accent-soft: #3a2a0d;
  --success: #4ade80;
  --success-soft: #133021;
  --danger: #f87171;
  --danger-soft: #3b1818;
  --warning: #fbbf24;
  --easy: #4ade80;
  --medium: #fbbf24;
  --hard: #f87171;
  --editor-bg: #1b1a18;
  --editor-active-line: #22211e;
  --editor-selection: #4a3a1c;
  --code-bg: #242320;
  --focus-ring: 0 0 0 3px rgba(245, 158, 11, 0.4);
  --shadow: none;
}

/* ---------- Base ---------- */
*,
*::before,
*::after {
  box-sizing: border-box;
}
[hidden] {
  display: none !important;
}
html,
body {
  margin: 0;
  height: 100%;
}
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
#root {
  height: 100%;
}
a {
  color: inherit;
}
button,
select {
  font: inherit;
  color: inherit;
}
:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.muted {
  color: var(--text-muted);
}
.error-text {
  color: var(--danger);
}

/* ---------- Page shell + header ---------- */
.page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}
.page-fixed {
  height: 100dvh;
  min-height: 0;
}
.header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex: none;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: -0.01em;
  white-space: nowrap;
  border-radius: var(--radius-sm);
}
.brand-accent {
  color: var(--accent);
}
.header-center {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

/* ---------- Buttons ---------- */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  font-weight: 500;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.btn:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
}
.btn:disabled {
  opacity: 0.65;
  cursor: default;
}
.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-contrast);
  font-weight: 600;
}
.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}
.btn-ghost {
  height: 28px;
  padding: 0 8px;
  border-color: transparent;
  background: transparent;
  color: var(--text-muted);
}
.btn-ghost:hover {
  background: var(--surface);
  border-color: var(--border);
  color: var(--text);
}
.kbd-hint {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.75;
}

/* ---------- Theme toggle ---------- */
.theme-toggle {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-2);
}
.theme-option {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
.theme-option:hover {
  color: var(--text);
}
.theme-option[aria-pressed="true"] {
  background: var(--surface);
  color: var(--accent);
  box-shadow: var(--shadow);
}

/* ---------- Badges + spinner ---------- */
.badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: var(--surface-2);
  flex: none;
}
.badge-easy {
  color: var(--easy);
}
.badge-medium {
  color: var(--medium);
}
.badge-hard {
  color: var(--hard);
}
.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: spin 0.7s linear infinite;
  flex: none;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ---------- Problem list ---------- */
.list-page {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 32px 16px 64px;
}
.list-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.list-heading h1 {
  margin: 0;
  font-size: 24px;
  letter-spacing: -0.02em;
}
.problem-list {
  list-style: none;
  margin: 0;
  padding: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow);
}
.problem-list li + li {
  border-top: 1px solid var(--border);
}
.problem-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  text-decoration: none;
}
a.problem-row:hover {
  background: var(--surface-hover);
}
.problem-title {
  flex: 1;
  min-width: 0;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.solved-mark {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid var(--border-strong);
  color: var(--success);
  flex: none;
}
.solved-mark.is-solved {
  border-color: var(--success);
  background: var(--success-soft);
}
.solved-mark.invalid {
  border-color: var(--danger);
  color: var(--danger);
  font-size: 12px;
  font-weight: 700;
}
.problem-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.problem-error {
  color: var(--danger);
  font-size: 13px;
  overflow-wrap: anywhere;
}
.empty-state {
  padding: 48px 24px;
  text-align: center;
  background: var(--surface);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius);
}
.empty-state h2 {
  margin: 16px 0 8px;
  font-size: 18px;
}
.empty-state p {
  max-width: 420px;
  margin: 0 auto;
  color: var(--text-muted);
}

@media (max-width: 600px) {
  .header {
    gap: 8px;
    padding: 0 12px;
  }
  .brand-text {
    display: none;
  }
}
```

- [ ] **Step 10: Verify types, build and the list page in the browser**

Run: `npm run typecheck && npm run build`
Expected: both exit 0; `web/dist/index.html` exists.

Run in the background: `WINNIE_PROBLEMS_DIR=server/__fixtures__/problems npm run dev`, then open `http://localhost:5173` in the browser pane.

Expected:
- The header shows the logo, "Winnie Code" and a three-way theme toggle.
- The list shows six problems sorted by title with difficulty badges, and the `broken` row shows its validation error in red.
- Clicking each theme button switches colors immediately. After a reload, the chosen theme is applied without a flash. "System" follows the OS setting.
- At 375 px width, the brand text hides and there is no horizontal scroll.

Then restart with `npm run dev` (the real, empty `problems/`) and check that the empty state appears. Stop the dev servers.

- [ ] **Step 11: Commit**

```bash
git add web
git commit -m "feat: add web shell, theming and problem list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Problem page: editor, description, results and responsive layout

**Files:**
- Create: `web/src/useMediaQuery.ts`, `web/src/components/SplitPane.tsx`, `web/src/components/Editor.tsx`, `web/src/components/Markdown.tsx`, `web/src/components/Results.tsx`, `web/src/pages/ProblemPage.tsx`
- Modify: `web/src/App.tsx` (add the `/p/:slug` route), `web/src/styles.css` (append problem page styles)

**Interfaces:**
- Consumes: everything from Task 10; `Diagnostic`, `ProblemDetail`, `ProblemSummary`, `RunResponse`, `CaseResult`, `Verdict` from `shared/api.ts`.
- Produces:
  - `useMediaQuery(query: string): boolean`
  - `SplitPane({ direction: "horizontal" | "vertical", storageKey, initial, min?, children: [ReactNode, ReactNode] })`
  - `Editor({ initialValue, dark, diagnostics, onChange, onRun, ref })`, where `ref` exposes `EditorHandle = { setValue(code: string): void }`
  - `Markdown({ source })`, `Results({ result, running })`, `ProblemPage({ slug })`

- [ ] **Step 1: Create `web/src/useMediaQuery.ts`**

```ts
import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}
```

- [ ] **Step 2: Create `web/src/components/SplitPane.tsx`**

```tsx
import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { readStorage, storageKeys, writeStorage } from "../storage";

type Props = {
  direction: "horizontal" | "vertical";
  /** Name used for the persisted size (localStorage winnie:split:<name>). */
  storageKey: string;
  /** Initial size of the first pane, in percent. */
  initial: number;
  /** Minimum size of either pane, in percent. */
  min?: number;
  children: [ReactNode, ReactNode];
};

export function SplitPane({ direction, storageKey, initial, min = 15, children }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const horizontal = direction === "horizontal";
  const clamp = (value: number) => Math.min(100 - min, Math.max(min, value));
  const [size, setSize] = useState(() => {
    const stored = Number(readStorage(storageKeys.split(storageKey)));
    return stored > 0 ? clamp(stored) : initial;
  });

  function update(value: number) {
    const next = clamp(value);
    setSize(next);
    writeStorage(storageKeys.split(storageKey), next.toFixed(1));
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!container.current) return;
    e.preventDefault();
    const divider = e.currentTarget;
    const rect = container.current.getBoundingClientRect();
    divider.setPointerCapture(e.pointerId);
    document.body.classList.add("resizing");
    const onMove = (ev: PointerEvent) =>
      update(horizontal ? ((ev.clientX - rect.left) / rect.width) * 100 : ((ev.clientY - rect.top) / rect.height) * 100);
    const onUp = () => {
      divider.removeEventListener("pointermove", onMove);
      divider.removeEventListener("pointerup", onUp);
      divider.removeEventListener("pointercancel", onUp);
      document.body.classList.remove("resizing");
    };
    divider.addEventListener("pointermove", onMove);
    divider.addEventListener("pointerup", onUp);
    divider.addEventListener("pointercancel", onUp);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const decrease = horizontal ? "ArrowLeft" : "ArrowUp";
    const increase = horizontal ? "ArrowRight" : "ArrowDown";
    if (e.key === decrease || e.key === increase) {
      e.preventDefault();
      update(size + (e.key === increase ? 2 : -2));
    }
  }

  return (
    <div ref={container} className={`split split-${direction}`}>
      <div className="split-pane" style={{ flexBasis: `${size}%` }}>
        {children[0]}
      </div>
      <div
        className="split-divider"
        role="separator"
        tabIndex={0}
        aria-orientation={horizontal ? "vertical" : "horizontal"}
        aria-valuenow={Math.round(size)}
        aria-valuemin={min}
        aria-valuemax={100 - min}
        aria-label="Resize panels"
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
      />
      <div className="split-pane split-pane-rest">{children[1]}</div>
    </div>
  );
}
```

- [ ] **Step 3: Create `web/src/components/Editor.tsx`**

CodeMirror 6 with the legacy `clike` Kotlin mode. Colors come from CSS variables, so the editor follows the app theme. Only the syntax colors switch between the default light highlight style and One Dark's. `Mod-Enter` is bound at the highest precedence so it runs the code instead of inserting a blank line.

```tsx
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { basicSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit, StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import { kotlin } from "@codemirror/legacy-modes/mode/clike";
import { lintGutter, setDiagnostics, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
import { Compartment, EditorState, Prec, type Extension, type Text } from "@codemirror/state";
import { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
import { EditorView, keymap } from "@codemirror/view";
import type { Diagnostic } from "../../../shared/api";

export type EditorHandle = { setValue(code: string): void };

type Props = {
  /** Only read on mount. Remount (key) the editor to load different content. */
  initialValue: string;
  dark: boolean;
  diagnostics: Diagnostic[];
  onChange(code: string): void;
  onRun(): void;
  ref?: Ref<EditorHandle>;
};

const baseTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "13.5px", backgroundColor: "var(--editor-bg)", color: "var(--text)" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" },
  ".cm-content": { caretColor: "var(--accent)", padding: "10px 0" },
  ".cm-gutters": { backgroundColor: "var(--editor-bg)", color: "var(--text-faint)", border: "none" },
  ".cm-activeLine": { backgroundColor: "var(--editor-active-line)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--editor-active-line)", color: "var(--text-muted)" },
  "&.cm-focused .cm-cursor": { borderLeftColor: "var(--accent)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--editor-selection)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-tooltip": { backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" },
});

function themeExtension(dark: boolean): Extension {
  return dark ? [EditorView.darkTheme.of(true), syntaxHighlighting(oneDarkHighlightStyle)] : [];
}

function toCmDiagnostic(doc: Text, d: Diagnostic): CmDiagnostic {
  const line = doc.line(Math.min(Math.max(d.line, 1), doc.lines));
  const from = Math.min(line.from + Math.max(d.column - 1, 0), line.to);
  const word = /^[\w$]+/.exec(doc.sliceString(from, line.to));
  const to = word ? from + word[0].length : Math.min(from + 1, line.to);
  return { from, to, severity: d.severity, message: d.message };
}

export function Editor({ initialValue, dark, diagnostics, onChange, onRun, ref }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const theme = useRef(new Compartment());
  const callbacks = useRef({ onChange, onRun });
  callbacks.current = { onChange, onRun };

  useEffect(() => {
    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: initialValue,
        extensions: [
          Prec.highest(
            keymap.of([
              {
                key: "Mod-Enter",
                run: () => {
                  callbacks.current.onRun();
                  return true;
                },
              },
            ]),
          ),
          basicSetup,
          keymap.of([indentWithTab]),
          indentUnit.of("    "),
          EditorState.tabSize.of(4),
          StreamLanguage.define(kotlin),
          lintGutter(),
          baseTheme,
          theme.current.of(themeExtension(dark)),
          EditorView.contentAttributes.of({ "aria-label": "Kotlin code editor" }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // The editor is created once per mount; initialValue/dark changes are handled below or by remounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    view.current?.dispatch({ effects: theme.current.reconfigure(themeExtension(dark)) });
  }, [dark]);

  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    editor.dispatch(setDiagnostics(editor.state, diagnostics.map((d) => toCmDiagnostic(editor.state.doc, d))));
  }, [diagnostics]);

  useImperativeHandle(
    ref,
    () => ({
      setValue(code: string) {
        const editor = view.current;
        if (editor) editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: code } });
      },
    }),
    [],
  );

  return <div className="editor" ref={host} />;
}
```

- [ ] **Step 4: Create `web/src/components/Markdown.tsx`**

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ source }: { source: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 5: Create `web/src/components/Results.tsx`**

```tsx
import { useEffect, useState, type ReactNode } from "react";
import type { CaseResult, RunResponse, Verdict } from "../../../shared/api";
import { CheckIcon, XIcon } from "./Icons";

const VERDICT_LABELS: Record<Verdict, string> = {
  accepted: "Accepted",
  wrong_answer: "Wrong Answer",
  runtime_error: "Runtime Error",
  time_limit_exceeded: "Time Limit Exceeded",
};

export function Results({ result, running }: { result: RunResponse | null; running: boolean }) {
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (result?.status === "ran") {
      const firstFailing = result.cases.findIndex((c) => c.verdict !== "accepted");
      setSelected(firstFailing === -1 ? 0 : firstFailing);
    }
  }, [result]);

  if (running) {
    return (
      <div className="results-empty">
        <span className="spinner" aria-hidden="true" /> Compiling and running…
      </div>
    );
  }

  if (!result) {
    return (
      <div className="results-empty">
        <p>
          Press <strong>Run</strong> to compile your code and check it against the test cases.
        </p>
      </div>
    );
  }

  if (result.status === "internal_error") {
    return (
      <div className="results">
        <div className="banner banner-error">
          <h3>Something went wrong</h3>
        </div>
        <pre className="code-block code-block-error">{result.message}</pre>
      </div>
    );
  }

  if (result.status === "compile_error") {
    return (
      <div className="results">
        <div className="banner banner-error">
          <h3>Compilation Error</h3>
        </div>
        {result.diagnostics.length > 0 ? (
          <ul className="diagnostics">
            {result.diagnostics.map((d, i) => (
              <li key={i} className={`diag diag-${d.severity}`}>
                <span className="diag-pos">
                  Line {d.line}:{d.column}
                </span>
                {d.message}
              </li>
            ))}
          </ul>
        ) : (
          <pre className="code-block code-block-error">{result.raw || "The compiler failed without any output."}</pre>
        )}
      </div>
    );
  }

  const allPassed = result.passed === result.total;
  const current = result.cases[selected] ?? result.cases[0];
  return (
    <div className="results">
      <div className={`summary ${allPassed ? "summary-pass" : "summary-fail"}`}>
        <span className="summary-title">{allPassed ? "All tests passed" : `${result.total - result.passed} failing`}</span>
        <span className="summary-meta">
          {result.passed} / {result.total} passed · {(result.elapsedMs / 1000).toFixed(1)} s
        </span>
      </div>
      <div className="case-tabs" role="tablist" aria-label="Test cases">
        {result.cases.map((c, i) => (
          <button
            key={c.index}
            type="button"
            role="tab"
            aria-selected={i === selected}
            className={`case-tab ${c.verdict === "accepted" ? "pass" : "fail"}`}
            onClick={() => setSelected(i)}
          >
            {c.verdict === "accepted" ? <CheckIcon width={14} height={14} /> : <XIcon width={14} height={14} />}
            <span className="case-tab-label">Case {i + 1}</span>
          </button>
        ))}
      </div>
      {current && <CaseDetails result={current} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      {children}
    </div>
  );
}

function CaseDetails({ result }: { result: CaseResult }) {
  return (
    <div className="case-details" role="tabpanel">
      <div className={`verdict verdict-${result.verdict}`}>
        {VERDICT_LABELS[result.verdict]}
        {result.elapsedMs !== undefined && <span className="summary-meta"> · {result.elapsedMs} ms</span>}
      </div>
      <Field label="Input">
        {result.input.map((param) => (
          <div key={param.name} className="input-param">
            <span className="input-name">{param.name} =</span>
            <pre className="code-block">{param.value}</pre>
          </div>
        ))}
      </Field>
      {result.output !== undefined && (
        <Field label="Your output">
          <pre className={`code-block${result.verdict === "wrong_answer" ? " code-block-error" : ""}`}>{result.output}</pre>
        </Field>
      )}
      <Field label="Expected">
        <pre className="code-block">{result.expected}</pre>
      </Field>
      {result.verdict === "time_limit_exceeded" && (
        <Field label="Error">
          <pre className="code-block code-block-error">Your code did not finish within the 10 s time limit.</pre>
        </Field>
      )}
      {result.error && (
        <Field label="Error">
          <pre className="code-block code-block-error">{result.error}</pre>
        </Field>
      )}
      {result.stdout && (
        <Field label="Stdout">
          <pre className="code-block">{result.stdout}</pre>
        </Field>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Create `web/src/pages/ProblemPage.tsx`**

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import type { Diagnostic, ProblemDetail, ProblemSummary, RunResponse } from "../../../shared/api";
import { api } from "../api";
import { DifficultyBadge } from "../components/DifficultyBadge";
import { Editor, type EditorHandle } from "../components/Editor";
import { Header } from "../components/Header";
import { PlayIcon, ResetIcon } from "../components/Icons";
import { Markdown } from "../components/Markdown";
import { Results } from "../components/Results";
import { SplitPane } from "../components/SplitPane";
import { Link, navigate } from "../router";
import { readStorage, storageKeys, writeStorage } from "../storage";
import { useIsDark } from "../theme";
import { useMediaQuery } from "../useMediaQuery";

type Tab = "description" | "code" | "results";
type ValidProblem = Extract<ProblemSummary, { ok: true }>;

const TAB_LABELS: Record<Tab, string> = { description: "Description", code: "Code", results: "Results" };
const NO_DIAGNOSTICS: Diagnostic[] = [];
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);

export function ProblemPage({ slug }: { slug: string }) {
  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [problems, setProblems] = useState<ValidProblem[]>([]);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>(NO_DIAGNOSTICS);
  const [tab, setTab] = useState<Tab>("description");
  const wide = useMediaQuery("(min-width: 900px)");
  const dark = useIsDark();
  const editorRef = useRef<EditorHandle>(null);
  const codeRef = useRef("");
  const runningRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    api.problem(slug).then(
      (p) => {
        if (cancelled) return;
        codeRef.current = readStorage(storageKeys.code(slug)) ?? p.template;
        setProblem(p);
        document.title = `${p.title} · Winnie Code`;
      },
      (e: Error) => {
        if (!cancelled) setLoadError(e.message);
      },
    );
    api.problems().then(
      (list) => {
        if (!cancelled) setProblems(list.filter((p): p is ValidProblem => p.ok));
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleChange = useCallback(
    (code: string) => {
      codeRef.current = code;
      writeStorage(storageKeys.code(slug), code === problem?.template ? null : code);
      setDiagnostics((prev) => (prev.length === 0 ? prev : NO_DIAGNOSTICS));
    },
    [slug, problem],
  );

  const run = useCallback(async () => {
    if (runningRef.current || !problem) return;
    runningRef.current = true;
    setRunning(true);
    setTab("results");
    let response: RunResponse;
    try {
      response = await api.run(slug, codeRef.current);
    } catch (e) {
      response = { status: "internal_error", message: (e as Error).message };
    }
    setResult(response);
    setDiagnostics(response.status === "compile_error" ? response.diagnostics : NO_DIAGNOSTICS);
    if (response.status === "ran") {
      writeStorage(storageKeys.solved(slug), response.passed === response.total ? "1" : null);
    }
    runningRef.current = false;
    setRunning(false);
  }, [problem, slug]);

  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  // ⌘/Ctrl+Enter anywhere on the page. Inside the editor, CodeMirror handles it first and marks it defaultPrevented.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.defaultPrevented) {
        e.preventDefault();
        void runRef.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function resetCode() {
    if (!problem) return;
    if (!window.confirm("Reset your code to the starting template? Your current code will be lost.")) return;
    editorRef.current?.setValue(problem.template);
  }

  if (loadError) {
    return (
      <div className="page">
        <Header />
        <main className="list-page">
          <p className="error-text">Could not load this problem: {loadError}</p>
          <p>
            <Link to="/">← Back to all problems</Link>
          </p>
        </main>
      </div>
    );
  }

  const switcher = (
    <select
      className="problem-select"
      aria-label="Switch problem"
      value={slug}
      onChange={(e) => navigate(`/p/${e.target.value}`)}
    >
      {!problems.some((p) => p.slug === slug) && <option value={slug}>{problem?.title ?? slug}</option>}
      {problems.map((p) => (
        <option key={p.slug} value={p.slug}>
          {p.title}
        </option>
      ))}
    </select>
  );

  const runButton = (
    <button
      type="button"
      className="btn btn-primary"
      onClick={() => void run()}
      disabled={!problem || running}
      title={`Run (${IS_MAC ? "⌘" : "Ctrl"} + Enter)`}
    >
      {running ? <span className="spinner" aria-hidden="true" /> : <PlayIcon />}
      <span>Run</span>
      <span className="kbd-hint run-hint">{IS_MAC ? "⌘↵" : "Ctrl↵"}</span>
    </button>
  );

  if (!problem) {
    return (
      <div className="page page-fixed">
        <Header center={switcher} actions={runButton} />
        <div className="results-empty">
          <span className="spinner" aria-hidden="true" /> Loading problem…
        </div>
      </div>
    );
  }

  const descriptionPanel = (
    <section className="panel" aria-label="Problem description">
      <div className="panel-body">
        <article className="description">
          <header className="description-header">
            <h1>{problem.title}</h1>
            <DifficultyBadge difficulty={problem.difficulty} />
          </header>
          <Markdown source={problem.description} />
        </article>
      </div>
    </section>
  );

  const editorPanel = (
    <section className="panel" aria-label="Code">
      <div className="panel-toolbar">
        <span>Kotlin</span>
        <button type="button" className="btn btn-ghost" onClick={resetCode} title="Reset to the starting template">
          <ResetIcon width={14} height={14} /> Reset
        </button>
      </div>
      <Editor
        ref={editorRef}
        initialValue={codeRef.current}
        dark={dark}
        diagnostics={diagnostics}
        onChange={handleChange}
        onRun={() => void runRef.current()}
      />
    </section>
  );

  const resultsPanel = (
    <section className="panel" aria-label="Results">
      <div className="panel-toolbar">
        <span>Results</span>
      </div>
      <div className="panel-body">
        <Results result={result} running={running} />
      </div>
    </section>
  );

  const resultDot =
    result === null ? null : result.status === "ran" && result.passed === result.total ? "pass" : "fail";

  return (
    <div className="page page-fixed">
      <Header center={switcher} actions={runButton} />
      {wide ? (
        <main className="workspace">
          <SplitPane direction="horizontal" storageKey="main" initial={42} min={20}>
            {descriptionPanel}
            <SplitPane direction="vertical" storageKey="right" initial={62} min={15}>
              {editorPanel}
              {resultsPanel}
            </SplitPane>
          </SplitPane>
        </main>
      ) : (
        <main className="mobile-workspace">
          <div className="tabs" role="tablist" aria-label="Problem sections">
            {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
              <button key={t} type="button" role="tab" className="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                {TAB_LABELS[t]}
                {t === "results" && running && <span className="spinner" aria-hidden="true" />}
                {t === "results" && !running && resultDot && <span className={`tab-dot ${resultDot}`} aria-hidden="true" />}
              </button>
            ))}
          </div>
          <div className="mobile-panels">
            <div className="mobile-panel" hidden={tab !== "description"}>
              {descriptionPanel}
            </div>
            <div className="mobile-panel" hidden={tab !== "code"}>
              {editorPanel}
            </div>
            <div className="mobile-panel" hidden={tab !== "results"}>
              {resultsPanel}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Route `/p/:slug` in `web/src/App.tsx`**

Replace the file with:
```tsx
import { ProblemList } from "./pages/ProblemList";
import { ProblemPage } from "./pages/ProblemPage";
import { usePathname } from "./router";

export function App() {
  const pathname = usePathname();
  const match = /^\/p\/([a-z0-9-]+)\/?$/.exec(pathname);
  if (match) return <ProblemPage key={match[1]} slug={match[1]} />;
  return <ProblemList />;
}
```

- [ ] **Step 8: Append the problem page styles to `web/src/styles.css`**

```css
/* ---------- Problem switcher ---------- */
.problem-select {
  width: 100%;
  max-width: 320px;
  height: 34px;
  padding: 0 32px 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--surface-2);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a857b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 14px;
  font-weight: 500;
  text-overflow: ellipsis;
  cursor: pointer;
  appearance: none;
}

/* ---------- Workspace + panels ---------- */
.workspace {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 8px;
}
.panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 38px;
  padding: 0 6px 0 14px;
  flex: none;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
}
.panel-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

/* ---------- Split panes ---------- */
.split {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
}
.split-horizontal {
  flex-direction: row;
}
.split-vertical {
  flex-direction: column;
}
.split-pane {
  flex: none;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.split-pane-rest {
  flex: 1 1 0;
}
.split-divider {
  position: relative;
  flex: none;
  touch-action: none;
}
.split-horizontal > .split-divider {
  width: 8px;
  cursor: col-resize;
}
.split-vertical > .split-divider {
  height: 8px;
  cursor: row-resize;
}
.split-divider::after {
  content: "";
  position: absolute;
  border-radius: 2px;
  background: transparent;
  transition: background 0.15s;
}
.split-horizontal > .split-divider::after {
  inset: 30% 3px;
}
.split-vertical > .split-divider::after {
  inset: 3px 30%;
}
.split-divider:hover::after,
.split-divider:focus-visible::after {
  background: var(--accent);
}
.split-divider:focus-visible {
  box-shadow: none;
}
body.resizing {
  user-select: none;
}

/* ---------- Editor ---------- */
.editor {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.editor .cm-editor {
  height: 100%;
}

/* ---------- Description ---------- */
.description {
  padding: 20px 24px 32px;
}
.description-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 16px;
}
.description-header h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.25;
  letter-spacing: -0.02em;
}
.markdown {
  line-height: 1.65;
  overflow-wrap: anywhere;
}
.markdown > :first-child {
  margin-top: 0;
}
.markdown h1,
.markdown h2,
.markdown h3 {
  margin: 24px 0 8px;
  line-height: 1.3;
}
.markdown h2 {
  font-size: 17px;
}
.markdown h3 {
  font-size: 15px;
}
.markdown p,
.markdown ul,
.markdown ol {
  margin: 0 0 12px;
}
.markdown li + li {
  margin-top: 4px;
}
.markdown strong {
  font-weight: 600;
}
.markdown code {
  padding: 0.15em 0.4em;
  border-radius: 4px;
  background: var(--code-bg);
  font-family: var(--font-mono);
  font-size: 0.88em;
}
.markdown pre {
  margin: 0 0 16px;
  padding: 12px 14px;
  overflow-x: auto;
  border-radius: var(--radius-sm);
  background: var(--code-bg);
}
.markdown pre code {
  padding: 0;
  background: none;
  font-size: 13px;
}
.markdown table {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  margin: 0 0 16px;
  border-collapse: collapse;
}
.markdown th,
.markdown td {
  padding: 6px 10px;
  border: 1px solid var(--border);
}
.markdown blockquote {
  margin: 0 0 12px;
  padding: 4px 14px;
  border-left: 3px solid var(--accent);
  color: var(--text-muted);
}
.markdown img {
  max-width: 100%;
}

/* ---------- Results ---------- */
.results {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 18px 24px;
}
.results-empty {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  color: var(--text-muted);
  text-align: center;
}
.banner {
  padding: 12px 14px;
  border-radius: var(--radius-sm);
}
.banner h3 {
  margin: 0;
  font-size: 15px;
}
.banner-error {
  background: var(--danger-soft);
  color: var(--danger);
}
.summary {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
}
.summary-title {
  font-size: 18px;
  font-weight: 700;
}
.summary-pass .summary-title {
  color: var(--success);
}
.summary-fail .summary-title {
  color: var(--danger);
}
.summary-meta {
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 400;
}
.case-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.case-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.case-tab.pass {
  color: var(--success);
}
.case-tab.fail {
  color: var(--danger);
}
.case-tab[aria-selected="true"] {
  background: var(--surface-2);
  border-color: var(--border-strong);
}
.case-tab-label {
  color: var(--text);
}
.case-details {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.verdict {
  font-size: 15px;
  font-weight: 700;
}
.verdict-accepted {
  color: var(--success);
}
.verdict-wrong_answer,
.verdict-runtime_error,
.verdict-time_limit_exceeded {
  color: var(--danger);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.input-param {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.input-name {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
}
.code-block {
  margin: 0;
  padding: 10px 12px;
  overflow-x: auto;
  border-radius: var(--radius-sm);
  background: var(--code-bg);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}
.code-block-error {
  background: var(--danger-soft);
  color: var(--danger);
}
.diagnostics {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.diag {
  padding: 10px 12px;
  border-left: 3px solid var(--danger);
  border-radius: var(--radius-sm);
  background: var(--code-bg);
  font-family: var(--font-mono);
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-word;
}
.diag-warning {
  border-left-color: var(--warning);
}
.diag-pos {
  margin-right: 8px;
  color: var(--danger);
  font-weight: 600;
}
.diag-warning .diag-pos {
  color: var(--warning);
}

/* ---------- Narrow layout (tabs) ---------- */
.mobile-workspace {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.tabs {
  display: flex;
  gap: 4px;
  padding: 8px 8px 0;
  flex: none;
}
.tab {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  border: 1px solid var(--border);
  border-bottom: none;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  background: var(--surface-2);
  color: var(--text-muted);
  font-weight: 600;
  cursor: pointer;
}
.tab[aria-selected="true"] {
  background: var(--surface);
  color: var(--text);
}
.tab-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.tab-dot.pass {
  background: var(--success);
}
.tab-dot.fail {
  background: var(--danger);
}
.mobile-panels {
  flex: 1;
  min-height: 0;
  display: flex;
  padding: 0 8px 8px;
}
.mobile-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.mobile-panel > .panel {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

@media (max-width: 600px) {
  .problem-select {
    max-width: none;
  }
  .run-hint {
    display: none;
  }
  .description {
    padding: 16px 16px 24px;
  }
}
```

- [ ] **Step 9: Verify types and build**

Run: `npm run typecheck && npm run build`
Expected: both exit 0.

- [ ] **Step 10: Verify in the browser (desktop)**

Run in the background: `WINNIE_PROBLEMS_DIR=server/__fixtures__/problems npm run dev`. Open `http://localhost:5173/p/sum-array` in the browser pane at desktop width.

Check each item:
1. The description is on the left, the editor top-right and the results bottom-right. Both dividers drag, and their sizes survive a reload.
2. The editor shows the template `class Solution { fun sum(nums: IntArray): Int { … } }` with Kotlin highlighting.
3. Type `return nums.summ()` in the body and press Run. A "Compilation Error" banner appears, "Line 3:…" lists `unresolved reference 'summ'`, and line 3 is underlined in the editor. The underline disappears after the next edit.
4. Fix it to `return nums.sum()` and press ⌘/Ctrl+Enter inside the editor. Exactly one run happens (the server log shows one request) and "All tests passed · 3 / 3" appears. Going back to `/` shows a ✓ next to Sum Array.
5. Change it to `return 42`. Case tabs are marked ✗, the first failing case is selected, and Your output `42` vs Expected `6` is shown.
6. Add `println("hi")` and run. The Stdout section shows `hi`.
7. Add `while (true) {}` and run. About 10 s later, all cases show "Time Limit Exceeded".
8. Reload the page. The code draft is restored. Reset → confirm restores the template.
9. Switch problems with the header dropdown (e.g. to Invert Binary Tree). The URL changes, the template includes the TreeNode comment, and browser Back returns to the previous problem.
10. Toggle dark mode. The editor background, gutters, selection and syntax colors switch, with no unreadable text in any panel.

- [ ] **Step 11: Verify in the browser (narrow / mobile)**

Resize the browser pane to the mobile preset (375×812) and reload `http://localhost:5173/p/reverse-list`.

Check each item:
1. The Description / Code / Results tabs show, and the Description tab is active.
2. The Code tab shows the editor filling the space, and typing works.
3. Pressing Run switches to Results with a spinner, then shows results. The Results tab gets a green or red dot.
4. There is no horizontal page scroll in any tab, in both light and dark themes.

Reset the pane to the desktop preset and stop the dev servers.

- [ ] **Step 12: Commit**

```bash
git add web
git commit -m "feat: add problem page with editor, results and responsive layout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Problem-authoring workflow, docs and final verification

**Files:**
- Create: `server/try-solution.ts`, `README.md`, `CLAUDE.md`
- Modify: `package.json` (add the `try` script)

**Interfaces:**
- Consumes: `problemsDir`, `SUPPORT_DIR`, `CACHE_DIR` (Task 9 `server/paths.ts`), `loadProblem` (Task 3), `prepareToolchain` (Task 5), `runSolution` (Task 8).
- Produces: `npm run try -- <slug> <path/to/Solution.kt>`, which prints per-case verdicts and exits 0 only if every case passes. Claude uses it to verify expected values with a reference solution when adding a problem.

- [ ] **Step 1: Write `server/try-solution.ts`**

```ts
import { readFile } from "node:fs/promises";
import { CACHE_DIR, problemsDir, SUPPORT_DIR } from "./paths";
import { loadProblem } from "./problems";
import { runSolution } from "./runner";
import { prepareToolchain } from "./toolchain";

const [slug, file] = process.argv.slice(2);
if (!slug || !file) {
  console.error("Usage: npm run try -- <slug> <path/to/Solution.kt>");
  process.exit(2);
}

const entry = await loadProblem(problemsDir(), slug);
if (!entry) {
  console.error(`No problem named "${slug}" in ${problemsDir()}`);
  process.exit(1);
}
if (!entry.ok) {
  console.error(`✖ ${slug}: ${entry.error}`);
  process.exit(1);
}

const toolchain = await prepareToolchain({ supportDir: SUPPORT_DIR, cacheDir: CACHE_DIR });
const result = await runSolution(toolchain, entry.problem, await readFile(file, "utf8"));

if (result.status === "compile_error") {
  console.log(result.raw);
  process.exit(1);
}
if (result.status === "internal_error") {
  console.log(result.message);
  process.exit(1);
}

const indent = (text: string) => text.replace(/^/gm, "      ");
for (const c of result.cases) {
  console.log(`${c.verdict === "accepted" ? "✓" : "✖"} case ${c.index + 1}: ${c.verdict}`);
  if (c.verdict === "accepted") continue;
  console.log(`    input:    ${c.input.map((p) => `${p.name} = ${p.value}`).join(", ")}`);
  console.log(`    expected: ${c.expected}`);
  if (c.output !== undefined) console.log(`    output:   ${c.output}`);
  if (c.error) console.log(indent(c.error));
}
console.log(`${result.passed}/${result.total} passed in ${(result.elapsedMs / 1000).toFixed(1)} s`);
process.exit(result.passed === result.total ? 0 : 1);
```

- [ ] **Step 2: Add the `try` script to `package.json`**

In `"scripts"`, after `"check-problems"`, add:
```json
    "try": "tsx server/try-solution.ts"
```
(Remember the comma after the `check-problems` line.)

- [ ] **Step 3: Verify the CLI**

Create a scratch file outside the repo (e.g. `$TMPDIR/Sum.kt`) containing `class Solution { fun sum(nums: IntArray): Int = nums.sum() }`.

Run: `WINNIE_PROBLEMS_DIR=server/__fixtures__/problems npm run try -- sum-array $TMPDIR/Sum.kt`
Expected: three `✓` lines, `3/3 passed`, exit 0.

Change the body to `= 1` and re-run.
Expected: `✖` lines showing input, expected and output; exit 1.

- [ ] **Step 4: Write `CLAUDE.md`**

````markdown
# Winnie Code

Local LeetCode-style judge for Kotlin. The user pastes problems into a Claude session. Claude adds them to `problems/`, and the user solves them in the browser.

## Commands

- `npm run dev`: API on :5174 + Vite on http://localhost:5173
- `npm start`: build and serve everything on http://localhost:5174
- `npm test`: all tests (unit + real kotlinc integration)
- `npm run typecheck`
- `npm run check-problems [slug]`: validate problem files and parse every test literal with the Kotlin harness
- `npm run try -- <slug> <file.kt>`: run a solution file against a problem from the terminal
- `WINNIE_PROBLEMS_DIR=server/__fixtures__/problems npm run dev`: run the app against the test fixtures

## Adding a problem (when the user pastes one)

1. **Slug**: kebab-case, preferably LeetCode's URL slug (e.g. `two-sum`). Folder: `problems/<slug>/`.
2. **`description.md`**: the statement in Markdown. Include:
   - the description (inline code for identifiers);
   - each example as `**Example 1:**` followed by a fenced block with `Input: …`, `Output: …` and an optional `Explanation: …`;
   - `**Constraints:**` as a bullet list.

   Do not include the code template.
3. **`problem.json`**:
   ```json
   {
     "title": "Two Sum",
     "difficulty": "Easy",
     "method": {
       "name": "twoSum",
       "params": [{ "name": "nums", "type": "IntArray" }, { "name": "target", "type": "Int" }],
       "returns": "IntArray"
     },
     "tests": [{ "input": ["[2,7,11,15]", "9"], "expected": "[0,1]" }]
   }
   ```
   - Use LeetCode's Kotlin signature (method name, param names and types).
   - Supported types:
     - scalars: `Int`, `Long`, `Double`, `Boolean`, `Char`, `String`;
     - primitive arrays: `IntArray`, `LongArray`, `DoubleArray`, `BooleanArray`, `CharArray`;
     - `Array<T>` and `List<T>` (nestable);
     - `ListNode?` and `TreeNode?` (always nullable; they can also appear inside arrays and lists).
   - Literals use LeetCode notation:
     - strings and chars are double-quoted (`"a"`), and inside JSON the quotes are escaped;
     - trees are level-order with `null` holes, e.g. `[3,9,20,null,null,15,7]`;
     - an empty list or tree is `[]`.
   - Tests: every example from the statement plus 3–6 extra edge cases (minimum sizes, negatives, duplicates, boundaries from the constraints).
   - Comparison is exact after normalization. If a problem accepts several valid answers (any order, any valid index pair, etc.), choose test inputs whose answer is unique, or tell the user it cannot be judged exactly. Design problems (e.g. `LRUCache`) are not supported yet.
4. **Verify**:
   - Run `npm run check-problems <slug>`; it must print `✓`.
   - Write a correct reference solution to a scratch file **outside the repo**, and run `npm run try -- <slug> <file>`. Every case must pass. If one fails, fix the expected value (or the solution) until you're confident the tests are right.
   - Never commit reference solutions. The user wants to solve the problem themselves.
5. Commit only `problems/<slug>/`, then tell the user it's ready at `http://localhost:5173/p/<slug>`.

## Architecture

- `server/`: Fastify API (`app.ts`), problem loading (`problems.ts`), type parsing (`types.ts`), harness generation (`harness.ts`), compile/run orchestration (`runner.ts`).
- `kotlin-support/`: Kotlin harness library, compiled once into `.cache/winnie-support-*.jar` (it includes the Kotlin runtime). Default package, so `ListNode`/`TreeNode` need no import.
- `web/`: React + Vite + CodeMirror 6 frontend. `shared/api.ts` holds the API types.
- Spec: `docs/superpowers/specs/2026-09-26-winnie-code-design.md`
````

- [ ] **Step 5: Write `README.md`**

````markdown
# Winnie Code

A local online judge for practicing LeetCode-style interview problems in **Kotlin**.

- Solve problems in a browser editor with Kotlin highlighting and a ready-made `class Solution` template
- **Run** (or ⌘/Ctrl + Enter) compiles with `kotlinc` and checks every test case
- Compilation errors are listed with line numbers and underlined in the editor
- Per-case results: input, expected, your output, `println` output, runtime errors and timeouts
- Light and dark themes, and a responsive layout (split panes on desktop, tabs on mobile)
- `ListNode` / `TreeNode` problems use LeetCode's notation (`[1,2,null,3]`)

There are no bundled problems. Paste a problem into a Claude Code session in this repo and ask Claude to add it; see `CLAUDE.md` for the exact format.

## Requirements

- Node.js 20+
- Kotlin compiler (`kotlinc`) on `PATH`, e.g. `brew install kotlin`
- A JDK 17+ (`java` on `PATH`)

## Usage

```bash
npm install
npm run dev
```

Open http://localhost:5173. The first start takes a few extra seconds while it compiles the Kotlin support library, which is then cached in `.cache/`.

To serve an optimized build on http://localhost:5174 instead:

```bash
npm start
```

## Adding problems

Each problem is a folder in `problems/<slug>/` with a `description.md` and a `problem.json` (signature + test cases). Validate them with:

```bash
npm run check-problems
```

## Development

```bash
npm test
npm run typecheck
```

Limits per run: 10 s wall clock, 256 MB heap, and a 256 MB stack for deep recursion.
````

- [ ] **Step 6: Full verification**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests PASS, typecheck exits 0, build succeeds.

Run: `npm run check-problems`
Expected: `No problems found in …/problems` (the repo ships with no problems).

Run in the background: `WINNIE_PROBLEMS_DIR=server/__fixtures__/problems npm start`. Open `http://localhost:5174/p/average` in the browser pane, submit `class Solution { fun average(nums: IntArray): Double = nums.average() }`, and confirm "All tests passed". Reload `http://localhost:5174/p/average` directly to confirm the SPA fallback serves the page. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add server/try-solution.ts package.json README.md CLAUDE.md
git commit -m "docs: add README, problem-authoring guide and try CLI

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
