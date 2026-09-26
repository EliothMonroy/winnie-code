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
