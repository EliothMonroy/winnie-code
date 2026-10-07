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
     - `ListNode?`, `DoublyListNode?` and `TreeNode?` (always nullable; they can also appear inside arrays and lists). Their value field is `value`, not LeetCode's `` `val` ``, so reference solutions must use `node.value`.
     - `DoublyListNode` has `prev` and `next`. Inputs arrive with both wired. Returned lists are read by walking `next`, and every `prev` is checked: a wrong `prev` fails the case with a "Broken doubly linked list" runtime error.
   - Literals use LeetCode notation:
     - strings and chars are double-quoted (`"a"`), and inside JSON the quotes are escaped;
     - trees are level-order with `null` holes, e.g. `[3,9,20,null,null,15,7]`;
     - an empty list or tree is `[]`;
     - a doubly linked list uses the same notation as a singly linked one: `[1,2,3]` means `1 <-> 2 <-> 3`.
   - Tests: every example from the statement plus 3–6 extra edge cases (minimum sizes, negatives, duplicates, boundaries from the constraints).
   - Comparison is exact after normalization. If a problem accepts several valid answers (any order, any valid index pair, etc.), choose test inputs whose answer is unique, or tell the user it cannot be judged exactly. Design problems (e.g. `LRUCache`) are not supported yet. Problems whose LeetCode signature returns `Unit` / modifies the input in place (e.g. Rotate Image, Sort Colors, Move Zeroes) are also not supported yet - tell the user rather than inventing a non-LeetCode signature that returns a value.
4. **Verify**:
   - Run `npm run check-problems <slug>`; it must print `✓`.
   - Write a correct reference solution to a scratch file **outside the repo**, and run `npm run try -- <slug> <file>`. Every case must pass. If one fails, fix the expected value (or the solution) until you're confident the tests are right.
   - Never commit reference solutions. The user wants to solve the problem themselves.
5. Commit only `problems/<slug>/`, then tell the user it's ready at `http://localhost:5173/p/<slug>`.

## Architecture

- `server/`: Fastify API (`app.ts`), problem loading (`problems.ts`), type parsing (`types.ts`), harness generation (`harness.ts`), compile/run orchestration (`runner.ts`).
- `kotlin-support/`: Kotlin harness library, compiled once into `.cache/winnie-support-*.jar` (it includes the Kotlin runtime). Default package, so `ListNode`/`DoublyListNode`/`TreeNode` need no import.
- `web/`: React + Vite + CodeMirror 6 frontend. `shared/api.ts` holds the API types.
- Spec: `docs/superpowers/specs/2026-09-26-winnie-code-design.md`
