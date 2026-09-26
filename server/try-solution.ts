import { readFile } from "node:fs/promises";
import { CACHE_DIR, problemsDir, SUPPORT_DIR } from "./paths";
import { loadProblem } from "./problems";
import { runSolution } from "./runner";
import { prepareToolchain, type Toolchain } from "./toolchain";

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

let toolchain: Toolchain;
try {
  toolchain = await prepareToolchain({ supportDir: SUPPORT_DIR, cacheDir: CACHE_DIR });
} catch (e) {
  console.error(`✖ ${(e as Error).message}`);
  process.exit(1);
}

let code: string;
try {
  code = await readFile(file, "utf8");
} catch (e) {
  console.error(`✖ ${(e as Error).message}`);
  process.exit(1);
}

const result = await runSolution(toolchain, entry.problem, code);

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
