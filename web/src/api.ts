import type { ProblemDetail, ProblemSummary, RunResponse } from "../../shared/api";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      body !== null && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

export const api = {
  problems: () => request<{ problems: ProblemSummary[] }>("/api/problems").then((r) => r.problems),
  problem: (slug: string) => request<ProblemDetail>(`/api/problems/${encodeURIComponent(slug)}`),
  run: (slug: string, code: string) =>
    request<RunResponse>("/api/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, code }),
    }),
};
