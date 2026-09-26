import { useEffect, useState } from "react";
import type { ProblemSummary } from "../../../shared/api";
import { api } from "../api";
import { DifficultyBadge } from "../components/DifficultyBadge";
import { Header } from "../components/Header";
import { CheckIcon, LogoMark } from "../components/Icons";
import { Link } from "../router";
import { isSolved } from "../storage";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; problems: ProblemSummary[] };

type ValidProblem = Extract<ProblemSummary, { ok: true }>;
type InvalidProblem = Extract<ProblemSummary, { ok: false }>;

export function ProblemList() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    document.title = "Winnie Code";
    api.problems().then(
      (problems) => setState({ status: "ready", problems }),
      (e: Error) => setState({ status: "error", message: e.message }),
    );
  }, []);

  const valid = state.status === "ready" ? state.problems.filter((p): p is ValidProblem => p.ok) : [];
  const invalid = state.status === "ready" ? state.problems.filter((p): p is InvalidProblem => !p.ok) : [];
  valid.sort((a, b) => a.title.localeCompare(b.title));
  const solvedCount = valid.filter((p) => isSolved(p.slug)).length;

  return (
    <div className="page">
      <Header />
      <main className="list-page">
        <div className="list-heading">
          <h1>Problems</h1>
          {valid.length > 0 && (
            <span className="muted">
              {solvedCount} / {valid.length} solved
            </span>
          )}
        </div>

        {state.status === "loading" && <p className="muted">Loading problems…</p>}
        {state.status === "error" && <p className="error-text">Could not load problems: {state.message}</p>}
        {state.status === "ready" && state.problems.length === 0 && <EmptyState />}

        {state.status === "ready" && state.problems.length > 0 && (
          <ul className="problem-list">
            {valid.map((p) => {
              const solved = isSolved(p.slug);
              return (
                <li key={p.slug}>
                  <Link to={`/p/${p.slug}`} className="problem-row">
                    <span className={`solved-mark${solved ? " is-solved" : ""}`} aria-label={solved ? "Solved" : "Not solved yet"}>
                      {solved && <CheckIcon width={12} height={12} strokeWidth={3} />}
                    </span>
                    <span className="problem-title">{p.title}</span>
                    <DifficultyBadge difficulty={p.difficulty} />
                  </Link>
                </li>
              );
            })}
            {invalid.map((p) => (
              <li key={p.slug}>
                <div className="problem-row problem-row-invalid">
                  <span className="solved-mark invalid" aria-label="Invalid problem">
                    !
                  </span>
                  <div className="problem-body">
                    <span className="problem-title">{p.slug}</span>
                    <span className="problem-error">{p.error}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <LogoMark width={48} height={48} />
      <h2>No problems yet</h2>
      <p>
        Paste a LeetCode-style problem into your Claude Code session and ask Claude to add it to Winnie Code. It will show
        up here.
      </p>
    </div>
  );
}
