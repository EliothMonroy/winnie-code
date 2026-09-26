import { useEffect, useState, type ReactNode } from "react";
import type { CaseResult, RunResponse, Verdict } from "../../../shared/api";
import { CheckIcon, XIcon } from "./Icons";

const VERDICT_LABELS: Record<Verdict, string> = {
  accepted: "Accepted",
  wrong_answer: "Wrong Answer",
  runtime_error: "Runtime Error",
  time_limit_exceeded: "Time Limit Exceeded",
};

export function Results({ result, running }: { result: RunResponse | null; running: boolean }) {
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (result?.status === "ran") {
      const firstFailing = result.cases.findIndex((c) => c.verdict !== "accepted");
      setSelected(firstFailing === -1 ? 0 : firstFailing);
    }
  }, [result]);

  if (running) {
    return (
      <div className="results-empty">
        <span className="spinner" aria-hidden="true" /> Compiling and running…
      </div>
    );
  }

  if (!result) {
    return (
      <div className="results-empty">
        <p>
          Press <strong>Run</strong> to compile your code and check it against the test cases.
        </p>
      </div>
    );
  }

  if (result.status === "internal_error") {
    return (
      <div className="results">
        <div className="banner banner-error">
          <h3>Something went wrong</h3>
        </div>
        <pre className="code-block code-block-error">{result.message}</pre>
      </div>
    );
  }

  if (result.status === "compile_error") {
    return (
      <div className="results">
        <div className="banner banner-error">
          <h3>Compilation Error</h3>
        </div>
        {result.diagnostics.length > 0 ? (
          <ul className="diagnostics">
            {result.diagnostics.map((d, i) => (
              <li key={i} className={`diag diag-${d.severity}`}>
                <span className="diag-pos">
                  Line {d.line}:{d.column}
                </span>
                {d.message}
              </li>
            ))}
          </ul>
        ) : (
          <pre className="code-block code-block-error">{result.raw || "The compiler failed without any output."}</pre>
        )}
      </div>
    );
  }

  const allPassed = result.passed === result.total;
  const current = result.cases[selected] ?? result.cases[0];
  return (
    <div className="results">
      <div className={`summary ${allPassed ? "summary-pass" : "summary-fail"}`}>
        <span className="summary-title">{allPassed ? "All tests passed" : `${result.total - result.passed} failing`}</span>
        <span className="summary-meta">
          {result.passed} / {result.total} passed · {(result.elapsedMs / 1000).toFixed(1)} s
        </span>
      </div>
      <div className="case-tabs" role="tablist" aria-label="Test cases">
        {result.cases.map((c, i) => (
          <button
            key={c.index}
            type="button"
            role="tab"
            aria-selected={i === selected}
            className={`case-tab ${c.verdict === "accepted" ? "pass" : "fail"}`}
            onClick={() => setSelected(i)}
          >
            {c.verdict === "accepted" ? <CheckIcon width={14} height={14} /> : <XIcon width={14} height={14} />}
            <span className="case-tab-label">Case {i + 1}</span>
          </button>
        ))}
      </div>
      {current && <CaseDetails result={current} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      {children}
    </div>
  );
}

function CaseDetails({ result }: { result: CaseResult }) {
  return (
    <div className="case-details" role="tabpanel">
      <div className={`verdict verdict-${result.verdict}`}>
        {VERDICT_LABELS[result.verdict]}
        {result.elapsedMs !== undefined && <span className="summary-meta"> · {result.elapsedMs} ms</span>}
      </div>
      <Field label="Input">
        {result.input.map((param) => (
          <div key={param.name} className="input-param">
            <span className="input-name">{param.name} =</span>
            <pre className="code-block">{param.value}</pre>
          </div>
        ))}
      </Field>
      {result.output !== undefined && (
        <Field label="Your output">
          <pre className={`code-block${result.verdict === "wrong_answer" ? " code-block-error" : ""}`}>{result.output}</pre>
        </Field>
      )}
      <Field label="Expected">
        <pre className="code-block">{result.expected}</pre>
      </Field>
      {result.verdict === "time_limit_exceeded" && (
        <Field label="Error">
          <pre className="code-block code-block-error">Your code did not finish within the 10 s time limit.</pre>
        </Field>
      )}
      {result.error && (
        <Field label="Error">
          <pre className="code-block code-block-error">{result.error}</pre>
        </Field>
      )}
      {result.stdout && (
        <Field label="Stdout">
          <pre className="code-block">{result.stdout}</pre>
        </Field>
      )}
    </div>
  );
}
