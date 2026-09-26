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
