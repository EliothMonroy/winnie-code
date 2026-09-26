import path from "node:path";
import type { Diagnostic } from "../shared/api";

const DIAGNOSTIC_LINE = /^(.+?\.kt):(\d+):(\d+): (error|warning|info): (.*)$/;

/** Extracts kotlinc diagnostics that belong to `file` (errors and warnings only). */
export function parseDiagnostics(raw: string, file = "Solution.kt"): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const match = DIAGNOSTIC_LINE.exec(line);
    if (!match) continue;
    const [, filePath, lineNo, column, severity, message] = match;
    if (path.basename(filePath) !== file) continue;
    if (severity !== "error" && severity !== "warning") continue;
    diagnostics.push({ line: Number(lineNo), column: Number(column), severity, message });
  }
  return diagnostics;
}
