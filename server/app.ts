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
