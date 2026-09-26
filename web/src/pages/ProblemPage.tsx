import { useCallback, useEffect, useRef, useState } from "react";
import type { Diagnostic, ProblemDetail, ProblemSummary, RunResponse } from "../../../shared/api";
import { api } from "../api";
import { DifficultyBadge } from "../components/DifficultyBadge";
import { Editor, type EditorHandle } from "../components/Editor";
import { Header } from "../components/Header";
import { PlayIcon, ResetIcon } from "../components/Icons";
import { Markdown } from "../components/Markdown";
import { Results } from "../components/Results";
import { SplitPane } from "../components/SplitPane";
import { Link, navigate } from "../router";
import { readStorage, storageKeys, writeStorage } from "../storage";
import { useIsDark } from "../theme";
import { useMediaQuery } from "../useMediaQuery";

type Tab = "description" | "code" | "results";
type ValidProblem = Extract<ProblemSummary, { ok: true }>;

const TAB_LABELS: Record<Tab, string> = { description: "Description", code: "Code", results: "Results" };
const NO_DIAGNOSTICS: Diagnostic[] = [];
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);

export function ProblemPage({ slug }: { slug: string }) {
  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [problems, setProblems] = useState<ValidProblem[]>([]);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>(NO_DIAGNOSTICS);
  const [tab, setTab] = useState<Tab>("description");
  const wide = useMediaQuery("(min-width: 900px)");
  const dark = useIsDark();
  const editorRef = useRef<EditorHandle>(null);
  const codeRef = useRef("");
  const runningRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    api.problem(slug).then(
      (p) => {
        if (cancelled) return;
        codeRef.current = readStorage(storageKeys.code(slug)) ?? p.template;
        setProblem(p);
        document.title = `${p.title} · Winnie Code`;
      },
      (e: Error) => {
        if (!cancelled) setLoadError(e.message);
      },
    );
    api.problems().then(
      (list) => {
        if (!cancelled) setProblems(list.filter((p): p is ValidProblem => p.ok));
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleChange = useCallback(
    (code: string) => {
      codeRef.current = code;
      writeStorage(storageKeys.code(slug), code === problem?.template ? null : code);
      setDiagnostics((prev) => (prev.length === 0 ? prev : NO_DIAGNOSTICS));
    },
    [slug, problem],
  );

  const run = useCallback(async () => {
    if (runningRef.current || !problem) return;
    runningRef.current = true;
    setRunning(true);
    setTab("results");
    let response: RunResponse;
    try {
      response = await api.run(slug, codeRef.current);
    } catch (e) {
      response = { status: "internal_error", message: (e as Error).message };
    }
    setResult(response);
    setDiagnostics(response.status === "compile_error" ? response.diagnostics : NO_DIAGNOSTICS);
    if (response.status === "ran") {
      writeStorage(storageKeys.solved(slug), response.passed === response.total ? "1" : null);
    }
    runningRef.current = false;
    setRunning(false);
  }, [problem, slug]);

  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  // ⌘/Ctrl+Enter anywhere on the page. Inside the editor, CodeMirror handles it first and marks it defaultPrevented.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.defaultPrevented) {
        e.preventDefault();
        void runRef.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function resetCode() {
    if (!problem) return;
    if (!window.confirm("Reset your code to the starting template? Your current code will be lost.")) return;
    editorRef.current?.setValue(problem.template);
  }

  if (loadError) {
    return (
      <div className="page">
        <Header />
        <main className="list-page">
          <p className="error-text">Could not load this problem: {loadError}</p>
          <p>
            <Link to="/">← Back to all problems</Link>
          </p>
        </main>
      </div>
    );
  }

  const switcher = (
    <select
      className="problem-select"
      aria-label="Switch problem"
      value={slug}
      onChange={(e) => navigate(`/p/${e.target.value}`)}
    >
      {!problems.some((p) => p.slug === slug) && <option value={slug}>{problem?.title ?? slug}</option>}
      {problems.map((p) => (
        <option key={p.slug} value={p.slug}>
          {p.title}
        </option>
      ))}
    </select>
  );

  const runButton = (
    <button
      type="button"
      className="btn btn-primary"
      onClick={() => void run()}
      disabled={!problem || running}
      title={`Run (${IS_MAC ? "⌘" : "Ctrl"} + Enter)`}
    >
      {running ? <span className="spinner" aria-hidden="true" /> : <PlayIcon />}
      <span>Run</span>
      <span className="kbd-hint run-hint">{IS_MAC ? "⌘↵" : "Ctrl↵"}</span>
    </button>
  );

  if (!problem) {
    return (
      <div className="page page-fixed">
        <Header center={switcher} actions={runButton} />
        <div className="results-empty">
          <span className="spinner" aria-hidden="true" /> Loading problem…
        </div>
      </div>
    );
  }

  const descriptionPanel = (
    <section className="panel" aria-label="Problem description">
      <div className="panel-body">
        <article className="description">
          <header className="description-header">
            <h1>{problem.title}</h1>
            <DifficultyBadge difficulty={problem.difficulty} />
          </header>
          <Markdown source={problem.description} />
        </article>
      </div>
    </section>
  );

  const editorPanel = (
    <section className="panel" aria-label="Code">
      <div className="panel-toolbar">
        <span>Kotlin</span>
        <button type="button" className="btn btn-ghost" onClick={resetCode} title="Reset to the starting template">
          <ResetIcon width={14} height={14} /> Reset
        </button>
      </div>
      <Editor
        ref={editorRef}
        initialValue={codeRef.current}
        dark={dark}
        diagnostics={diagnostics}
        onChange={handleChange}
        onRun={() => void runRef.current()}
      />
    </section>
  );

  const resultsPanel = (
    <section className="panel" aria-label="Results">
      <div className="panel-toolbar">
        <span>Results</span>
      </div>
      <div className="panel-body">
        <Results result={result} running={running} />
      </div>
    </section>
  );

  const resultDot =
    result === null ? null : result.status === "ran" && result.passed === result.total ? "pass" : "fail";

  return (
    <div className="page page-fixed">
      <Header center={switcher} actions={runButton} />
      {wide ? (
        <main className="workspace">
          <SplitPane direction="horizontal" storageKey="main" initial={42} min={20}>
            {descriptionPanel}
            <SplitPane direction="vertical" storageKey="right" initial={62} min={15}>
              {editorPanel}
              {resultsPanel}
            </SplitPane>
          </SplitPane>
        </main>
      ) : (
        <main className="mobile-workspace">
          <div className="tabs" role="tablist" aria-label="Problem sections">
            {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
              <button key={t} type="button" role="tab" className="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                {TAB_LABELS[t]}
                {t === "results" && running && <span className="spinner" aria-hidden="true" />}
                {t === "results" && !running && resultDot && <span className={`tab-dot ${resultDot}`} aria-hidden="true" />}
              </button>
            ))}
          </div>
          <div className="mobile-panels">
            <div className="mobile-panel" hidden={tab !== "description"}>
              {descriptionPanel}
            </div>
            <div className="mobile-panel" hidden={tab !== "code"}>
              {editorPanel}
            </div>
            <div className="mobile-panel" hidden={tab !== "results"}>
              {resultsPanel}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
