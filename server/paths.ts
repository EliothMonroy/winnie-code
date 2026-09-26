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
