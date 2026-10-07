# Winnie Code — Design

**Date:** 2026-09-26
**Status:** Approved in brainstorming, pending spec review

## Purpose

Winnie Code is a personal, locally-run online judge for practicing LeetCode-style
interview problems in Kotlin. The user pastes a problem into a Claude session; Claude
adds it to the repository as files; the user solves it in a browser editor and presses
**Run** to check it against test cases.

## Scope

In scope:

- Kotlin only.
- No bundled problems — problems are added one at a time by Claude on request.
- Code editor with a base template generated from the problem's method signature.
- **Run** button that compiles and runs the code against the problem's test cases.
- Compilation errors displayed after Run.
- Light and dark themes.
- Responsive layout (desktop and phone).
- Problem shapes: function problems (`class Solution { fun ... }`) and problems using
  `ListNode` / `TreeNode`.

Out of scope (explicitly deferred):

- Public hosting, accounts, sandboxing, rate limiting. The app runs only on localhost.
- Design problems (operation sequences such as `LRUCache`).
- Flexible answer checking (any-order results, floating-point tolerance).
- Hidden test cases / separate Submit action.
- Languages other than Kotlin.

## Architecture

Three parts plus problem data, in one repository:

```
server/          Node + TypeScript (Fastify): serves the API and the built frontend,
                 loads problems, generates the harness, compiles and runs code
web/             React + Vite + TypeScript, CodeMirror 6 editor
kotlin-support/  Kotlin harness library: literal parsers, serializers, ListNode, TreeNode
problems/        One folder per problem (problem.json + description.md)
docs/            Specs and plans
```

`npm run dev` starts the server and the Vite dev server together. The server requires
`kotlinc` and `java` on `PATH`. If either is missing, the server exits at startup with a
clear message.

Measured baseline: a cold `kotlinc` compile plus run of a trivial program takes about
1.8 s on the user's machine (kotlinc-jvm 2.4.20). This is fast enough to shell out on
every Run, so no compile daemon or in-process compiler is used.

## Problem format

Each problem is a folder `problems/<slug>/`, where `<slug>` is kebab-case (for example
`two-sum`). It contains:

- `description.md` — the problem statement (description, examples, constraints),
  rendered as Markdown in the UI.
- `problem.json`:

```json
{
  "title": "Two Sum",
  "difficulty": "Easy",
  "method": {
    "name": "twoSum",
    "params": [
      { "name": "nums",   "type": "IntArray" },
      { "name": "target", "type": "Int" }
    ],
    "returns": "IntArray"
  },
  "tests": [
    { "input": ["[2,7,11,15]", "9"], "expected": "[0,1]" },
    { "input": ["[3,2,4]", "6"],     "expected": "[1,2]" }
  ]
}
```

Field rules:

- `difficulty` is one of `Easy`, `Medium`, `Hard`.
- `tests[].input` has exactly one string per param, in param order. Each string is a
  value in LeetCode literal notation.
- `tests[].expected` is a single string in LeetCode literal notation.
- The server validates every `problem.json` when it loads it. An invalid problem is
  skipped, and the error is logged and shown in the problem list rather than crashing
  the server.

### Supported types

Scalars: `Int`, `Long`, `Double`, `Boolean`, `Char`, `String`.

Arrays: `IntArray`, `LongArray`, `DoubleArray`, `BooleanArray`, `CharArray`,
`Array<String>`, `Array<IntArray>`, `Array<CharArray>`.

Lists: `List<T>` for any supported `T`, nested to any depth (for example
`List<List<Int>>`).

Structures: `ListNode?` and `TreeNode?`.

Literal notation follows LeetCode:

- Numbers are written as-is.
- Strings are double-quoted JSON strings.
- `Char` is a one-character quoted string, e.g. `"a"`.
- Booleans are `true` / `false`.
- Arrays and lists are `[...]`.
- `ListNode?` is `[1,2,3]`, and `[]` means `null`.
- `TreeNode?` is level-order with `null` holes, e.g. `[3,9,20,null,null,15,7]`, and `[]`
  means `null`.

`ListNode` and `TreeNode` are defined in `kotlin-support` using LeetCode's shape, except that the value field is named `value` instead of the Kotlin keyword `val` (changed 2026-10-04):

```kotlin
class ListNode(var value: Int) { var next: ListNode? = null }
class TreeNode(var value: Int) { var left: TreeNode? = null; var right: TreeNode? = null }
```

`DoublyListNode?` was added on 2026-10-07 for doubly linked list problems:

```kotlin
class DoublyListNode(var value: Int) { var prev: DoublyListNode? = null; var next: DoublyListNode? = null }
```

It uses the same literal notation as `ListNode?`. Inputs are built with `prev` and `next` both wired. A returned list is serialized by walking `next`, and its `prev` pointers are verified on the way (head's `prev` is `null`, every other node's `prev` is the node before it); a violation fails the case as a runtime error with a "Broken doubly linked list" message.

### Adding a problem (workflow)

The user pastes a problem into a Claude session. Claude then:

1. Chooses a slug and the Kotlin method signature, matching LeetCode's Kotlin signature
   when known.
2. Writes `description.md`.
3. Writes `problem.json` containing the problem's examples plus extra edge cases.
4. Runs `npm run check-problems`. This validates every `problem.json` structurally in
   TypeScript. It then compiles and runs a parse-only harness, generated with the same
   code generator but without calling `Solution`, which parses every input and expected
   literal against its declared type through `kotlin-support` and reports any literal
   that fails.

The server re-reads the `problems/` directory on each list request, so new problems
appear without a restart.

## Template generation

The editor's starting code is generated from `method`:

```kotlin
class Solution {
    fun twoSum(nums: IntArray, target: Int): IntArray {
        
    }
}
```

If any param or return type uses `ListNode` or `TreeNode`, the template is preceded by
LeetCode's comment block describing that class (for example `* Definition for
singly-linked list. ...`). This tells the user that the class is already provided.

## Run pipeline

`POST /api/run` with body `{ "slug": string, "code": string }`.

1. Load and validate `problems/<slug>/problem.json`. An unknown slug returns 404.
2. Create a unique temp directory.
3. Write `Solution.kt` containing the user's code byte-for-byte, so compiler line
   numbers map 1:1 to the editor.
4. Write a generated `Main.kt`, which:
   - embeds each test's input literals as Kotlin string literals (escaped);
   - for each case: parses the inputs with `kotlin-support` parsers for the declared
     types; redirects `System.out` to a buffer; calls `Solution().<method>(...)` on a
     fresh `Solution` instance; restores `System.out`; serializes the return value to
     canonical literal notation; catches any `Throwable`, including `StackOverflowError`
     and `OutOfMemoryError`, and records it;
   - prints each case's outcome as a tagged block on the real stdout, delimited by a
     per-run random token so user output cannot forge it. The block holds the index,
     status, output, captured stdout, error and elapsed ms.
5. Compile:
   `kotlinc Solution.kt Main.kt -cp winnie-support.jar -d out`
6. If compilation fails, return `compile_error` with diagnostics (see below).
7. Run:
   `java -Xmx256m -Xss64m -cp out:winnie-support.jar:<kotlin-stdlib.jar> MainKt`
   with a 10 s wall-clock timeout. The process is killed on timeout.
8. Parse the tagged blocks. The harness also parses each case's `expected` literal with
   the return type and serializes it back (for example `2.00000` becomes `2.0`), then
   reports it in the same block. The server compares that normalized expected value
   with the serialized output using exact string equality. The UI shows `expected`
   exactly as written in `problem.json`.
9. Delete the temp directory (always, including on error).

`winnie-support.jar` is built once at server start from `kotlin-support/` sources and
cached under a cache directory, keyed by a hash of those sources. The Kotlin stdlib jar
path is located from the `kotlinc` installation (its `lib/kotlin-stdlib.jar`).

Concurrent runs are safe because each run uses its own temp directory.

### Response shape

```ts
type RunResponse =
  | { status: "compile_error"; diagnostics: Diagnostic[]; raw: string }
  | { status: "ran"; passed: number; total: number; elapsedMs: number; cases: CaseResult[] }
  | { status: "internal_error"; message: string };

type Diagnostic = { line: number; column: number; severity: "error" | "warning"; message: string };

type CaseResult = {
  index: number;
  input: { name: string; value: string }[];
  expected: string;
  verdict: "accepted" | "wrong_answer" | "runtime_error" | "time_limit_exceeded";
  output?: string;      // present for accepted / wrong_answer
  stdout: string;       // user's println output for this case (truncated to 64 KB)
  error?: string;       // exception class + message + user frames, for runtime_error
  elapsedMs?: number;
};
```

## Error handling

| Situation | Behavior |
|---|---|
| Compile error | `compile_error`; diagnostics come from `kotlinc` output, keeping only entries for `Solution.kt`. `raw` holds the full compiler output as a fallback. Warnings are included but do not block the run. |
| Exception in a case | That case is `runtime_error` with the exception class, message, and stack frames filtered to `Solution.kt`. Other cases still run. |
| Timeout (10 s) | Process killed. Cases already reported keep their verdicts, and the rest are `time_limit_exceeded`. |
| Process dies without a timeout (e.g. JVM crash) | Reported cases keep their verdicts. The rest are `runtime_error` with the process's stderr tail. |
| Huge output | Per-case stdout and output are truncated to 64 KB, with a truncation marker. |
| `kotlinc` / `java` missing | Server exits at startup with an explanatory message. |
| Unexpected server failure | `internal_error` with a message, shown in the results panel. |

## UI

### Routes

- `/` — problem list: title, difficulty badge, and a ✓ if the last Run passed every case
  (stored in `localStorage`). The empty state tells the user to paste a problem into
  Claude to add one. Invalid problems appear with their validation error.
- `/p/<slug>` — problem page.

### Problem page layout

- **Header:** the Winnie Code wordmark (links to `/`), a problem-switcher dropdown, a
  theme toggle (light / dark / system), and a **Run** button. `⌘/Ctrl + Enter` also
  triggers Run. Run is disabled with a spinner while a run is in flight.
- **Desktop (width ≥ 900px):** description on the left, a draggable vertical divider,
  and on the right the editor on top, then a draggable horizontal divider, then the
  results panel. Each region scrolls independently. Divider positions are remembered
  in `localStorage`.
- **Narrow (width < 900px):** tabs for **Description · Code · Results**. Pressing Run
  switches to Results when the response arrives.

### Editor

- CodeMirror 6 with Kotlin syntax highlighting (the `@codemirror/legacy-modes` clike
  Kotlin mode), line numbers, bracket matching, auto-indent, and a theme that follows
  light/dark.
- Initial content is the generated template.
- Code autosaves per problem to `localStorage` (debounced). **Reset to template**
  restores the template after a confirmation.
- Compile-error diagnostics are shown as underlines and gutter markers on the reported
  lines. They clear when the code is edited.

### Results panel

- Before the first Run: a hint to press Run.
- `compile_error`: a red "Compilation Error" banner and each diagnostic formatted as
  `Line L:C — message`.
- `ran`: a summary ("3 / 4 passed · 1.9 s", green if all pass, red otherwise), then one
  tab per case marked ✓ / ✗. The selected case shows the input params (name = value),
  expected output, your output, stdout (if any), and error (if any), plus a verdict
  label (Accepted, Wrong Answer, Runtime Error, Time Limit Exceeded). The first failing
  case is selected automatically.
- `internal_error`: an error banner with the message.

### Theming

- All colors are CSS custom properties on `:root`, redefined for dark mode.
- The theme defaults to the OS preference (`prefers-color-scheme`). An explicit choice
  is stored in `localStorage` and applied through a `data-theme` attribute on `<html>`
  before first paint, so the theme never flashes.

## Testing

- **Server unit tests (Vitest):**
  - problem loading and validation (valid, missing fields, param/input count mismatch,
    unknown type);
  - type-string parsing (`List<List<Int>>`, `Array<IntArray>`, `TreeNode?`);
  - template generation;
  - `Main.kt` generation, including string escaping of inputs;
  - `kotlinc` diagnostic parsing;
  - tagged-output parsing, including forged delimiters in user stdout and partial
    output after a kill.
- **Kotlin support-library tests:** a Kotlin test entry point, run through `kotlinc` +
  `java` by `npm test`, that checks parse → serialize round-trips for every supported
  type, including tree `null` holes, trailing nulls, empty list/tree, and string
  escaping.
- **Integration tests (real kotlinc):** a fixture problem run with a correct solution
  (all accepted), a wrong solution (wrong answer), a compile error (diagnostics with the
  correct line), a thrown exception (runtime error with other cases still passing), and
  an infinite loop (time limit exceeded).
- **Manual verification:** drive the app in a browser at desktop and mobile widths in
  both themes. Add a problem, run a correct solution, a wrong one and a non-compiling
  one.
