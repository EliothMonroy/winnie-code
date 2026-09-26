export type Difficulty = "Easy" | "Medium" | "Hard";

export type ProblemSummary =
  | { slug: string; ok: true; title: string; difficulty: Difficulty }
  | { slug: string; ok: false; error: string };

export type ProblemDetail = {
  slug: string;
  title: string;
  difficulty: Difficulty;
  description: string;
  template: string;
};

export type Diagnostic = {
  line: number;
  column: number;
  severity: "error" | "warning";
  message: string;
};

export type Verdict = "accepted" | "wrong_answer" | "runtime_error" | "time_limit_exceeded";

export type CaseResult = {
  index: number;
  input: { name: string; value: string }[];
  expected: string;
  verdict: Verdict;
  /** Present for accepted / wrong_answer. */
  output?: string;
  /** The user's println output for this case (truncated to 64 KB). */
  stdout: string;
  /** Exception class + message + user frames, for runtime_error (or a crash explanation). */
  error?: string;
  elapsedMs?: number;
};

export type RunResponse =
  | { status: "compile_error"; diagnostics: Diagnostic[]; raw: string }
  | { status: "ran"; passed: number; total: number; elapsedMs: number; cases: CaseResult[] }
  | { status: "internal_error"; message: string };
