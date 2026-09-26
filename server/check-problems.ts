import { CACHE_DIR, problemsDir, SUPPORT_DIR } from "./paths";
import { listProblems } from "./problems";
import { checkProblemLiterals } from "./runner";
import { prepareToolchain, type Toolchain } from "./toolchain";

const onlySlug = process.argv[2];
const dir = problemsDir();

let toolchain: Toolchain;
try {
  toolchain = await prepareToolchain({ supportDir: SUPPORT_DIR, cacheDir: CACHE_DIR });
} catch (e) {
  console.error(`✖ ${(e as Error).message}`);
  process.exit(1);
}
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
