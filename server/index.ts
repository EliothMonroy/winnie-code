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
