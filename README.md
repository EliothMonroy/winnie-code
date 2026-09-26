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

- Node.js 22.12+
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
