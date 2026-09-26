import { afterAll, describe, expect, it } from "vitest";
import type { ProblemDetail, ProblemSummary, RunResponse } from "../shared/api";
import { buildApp } from "./app";
import { FIXTURE_PROBLEMS, getTestToolchain } from "./test-helpers";

const fakeToolchain = { kotlinc: "kotlinc", java: "java", supportJar: "/nonexistent.jar" };
const app = buildApp({ problemsDir: FIXTURE_PROBLEMS, toolchain: fakeToolchain });

afterAll(async () => {
  await app.close();
});

describe("Host header guard", () => {
  it("rejects a non-local Host header", async () => {
    const res = await app.inject({ method: "GET", url: "/api/problems", headers: { host: "evil.example:5174" } });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "Forbidden host" });
  });

  it("allows localhost, 127.0.0.1 and ::1", async () => {
    for (const host of ["localhost:5174", "127.0.0.1:5174", "[::1]:5174"]) {
      const res = await app.inject({ method: "GET", url: "/api/problems", headers: { host } });
      expect(res.statusCode, host).toBe(200);
    }
  });
});

describe("GET /api/problems", () => {
  it("lists valid and invalid problems", async () => {
    const res = await app.inject({ method: "GET", url: "/api/problems" });
    expect(res.statusCode).toBe(200);
    const { problems } = res.json() as { problems: ProblemSummary[] };
    expect(problems.find((p) => p.slug === "sum-array")).toEqual({ slug: "sum-array", ok: true, title: "Sum Array", difficulty: "Easy" });
    expect(problems.find((p) => p.slug === "broken")).toMatchObject({ slug: "broken", ok: false, error: expect.stringContaining("difficulty") });
  });
});

describe("GET /api/problems/:slug", () => {
  it("returns the description and generated template", async () => {
    const res = await app.inject({ method: "GET", url: "/api/problems/reverse-list" });
    expect(res.statusCode).toBe(200);
    const detail = res.json() as ProblemDetail;
    expect(detail).toMatchObject({ slug: "reverse-list", title: "Reverse Linked List", difficulty: "Easy" });
    expect(detail.description).toContain("Reverse the singly linked list");
    expect(detail.template).toContain("fun reverseList(head: ListNode?): ListNode? {");
  });

  it("404s for unknown or unsafe slugs and 422s for invalid problems", async () => {
    expect((await app.inject({ method: "GET", url: "/api/problems/nope" })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/api/problems/..%2Fproblems" })).statusCode).toBe(404);
    const invalid = await app.inject({ method: "GET", url: "/api/problems/broken" });
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json().error).toContain("difficulty");
  });
});

describe("POST /api/run", () => {
  it("validates the body", async () => {
    const res = await app.inject({ method: "POST", url: "/api/run", payload: { slug: "sum-array" } });
    expect(res.statusCode).toBe(400);
  });

  it("404s for unknown problems", async () => {
    const res = await app.inject({ method: "POST", url: "/api/run", payload: { slug: "nope", code: "" } });
    expect(res.statusCode).toBe(404);
  });

  it("returns internal_error when the toolchain fails", async () => {
    const broken = buildApp({
      problemsDir: FIXTURE_PROBLEMS,
      toolchain: { kotlinc: "/definitely/missing/kotlinc", java: "java", supportJar: "x" },
    });
    const res = await broken.inject({ method: "POST", url: "/api/run", payload: { slug: "sum-array", code: "class Solution" } });
    expect(res.statusCode).toBe(200);
    expect((res.json() as RunResponse).status).toBe("internal_error");
    await broken.close();
  });

  it("runs code end to end with the real toolchain", async () => {
    const real = buildApp({ problemsDir: FIXTURE_PROBLEMS, toolchain: await getTestToolchain() });
    const res = await real.inject({
      method: "POST",
      url: "/api/run",
      payload: { slug: "sum-array", code: "class Solution { fun sum(nums: IntArray): Int = nums.sum() }" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ran", passed: 3, total: 3 });
    await real.close();
  });
});
