import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Difficulty } from "../shared/api";
import { parseType, type KType } from "./types";

export type Param = { name: string; type: KType };
export type TestCase = { input: string[]; expected: string };
export type Method = { name: string; params: Param[]; returns: KType };

export type Problem = {
  slug: string;
  title: string;
  difficulty: Difficulty;
  description: string;
  method: Method;
  tests: TestCase[];
};

export type ProblemEntry =
  | { slug: string; ok: true; problem: Problem }
  | { slug: string; ok: false; error: string };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const DIFFICULTIES: readonly string[] = ["Easy", "Medium", "Hard"];

export function isValidSlug(slug: string): boolean {
  return SLUG.test(slug);
}

function asObject(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${where} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, where: string): string {
  if (typeof value !== "string") throw new Error(`${where} must be a string`);
  return value;
}

function asIdentifier(value: unknown, where: string): string {
  const name = asString(value, where);
  if (!IDENTIFIER.test(name)) throw new Error(`${where} "${name}" is not a valid Kotlin identifier`);
  return name;
}

/** Validates parsed problem.json content. Throws an Error describing the first problem found. */
export function validateProblem(slug: string, raw: unknown, description: string): Problem {
  const obj = asObject(raw, "problem.json");

  const title = asString(obj.title, "title");
  if (!title.trim()) throw new Error("title must not be empty");

  const difficulty = obj.difficulty;
  if (typeof difficulty !== "string" || !DIFFICULTIES.includes(difficulty)) {
    throw new Error(`difficulty must be one of ${DIFFICULTIES.join(", ")}`);
  }

  const method = asObject(obj.method, "method");
  const name = asIdentifier(method.name, "method.name");
  if (!Array.isArray(method.params)) throw new Error("method.params must be an array");
  const seen = new Set<string>();
  const params: Param[] = method.params.map((rawParam, i) => {
    const param = asObject(rawParam, `method.params[${i}]`);
    const paramName = asIdentifier(param.name, `method.params[${i}].name`);
    if (seen.has(paramName)) throw new Error(`duplicate param name "${paramName}"`);
    seen.add(paramName);
    return { name: paramName, type: parseType(asString(param.type, `method.params[${i}].type`)) };
  });
  const returns = parseType(asString(method.returns, "method.returns"));

  if (!Array.isArray(obj.tests) || obj.tests.length === 0) throw new Error("tests must be a non-empty array");
  const tests: TestCase[] = obj.tests.map((rawTest, i) => {
    const test = asObject(rawTest, `tests[${i}]`);
    const input = test.input;
    if (!Array.isArray(input) || input.some((v) => typeof v !== "string")) {
      throw new Error(`tests[${i}].input must be an array of strings`);
    }
    if (input.length !== params.length) {
      throw new Error(`tests[${i}].input has ${input.length} values but the method has ${params.length} params`);
    }
    return { input: input as string[], expected: asString(test.expected, `tests[${i}].expected`) };
  });

  return { slug, title, difficulty: difficulty as Difficulty, description, method: { name, params, returns }, tests };
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/** Loads problems/<slug>. Returns null when the slug is invalid or the folder does not exist. */
export async function loadProblem(dir: string, slug: string): Promise<ProblemEntry | null> {
  if (!isValidSlug(slug)) return null;
  const folder = path.join(dir, slug);
  if (!(await isDirectory(folder))) return null;
  try {
    const jsonText = await readFile(path.join(folder, "problem.json"), "utf8").catch(() => {
      throw new Error("missing problem.json");
    });
    const description = await readFile(path.join(folder, "description.md"), "utf8").catch(() => {
      throw new Error("missing description.md");
    });
    let raw: unknown;
    try {
      raw = JSON.parse(jsonText);
    } catch (e) {
      throw new Error(`problem.json is not valid JSON: ${(e as Error).message}`);
    }
    return { slug, ok: true, problem: validateProblem(slug, raw, description) };
  } catch (e) {
    return { slug, ok: false, error: (e as Error).message };
  }
}

/** Loads every problem folder under dir, sorted by slug. Folders whose names are not valid slugs are skipped. */
export async function listProblems(dir: string): Promise<ProblemEntry[]> {
  let names: string[];
  try {
    const dirents = await readdir(dir, { withFileTypes: true });
    names = dirents.filter((d) => d.isDirectory() && isValidSlug(d.name)).map((d) => d.name);
  } catch {
    return [];
  }
  names.sort();
  const entries = await Promise.all(names.map((name) => loadProblem(dir, name)));
  return entries.filter((e): e is ProblemEntry => e !== null);
}
