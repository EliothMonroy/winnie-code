import { describe, expect, it } from "vitest";
import { parseDiagnostics } from "./diagnostics";

const RAW = [
  "Solution.kt:4:16: error: return type mismatch: expected 'Int', actual 'String'.",
  '        return "x" + 1 + c',
  "               ^^^^^^^^^^^",
  "Solution.kt:4:26: error: unresolved reference 'c'.",
  '        return "x" + 1 + c',
  "                         ^",
  "Main.kt:9:13: error: unresolved reference 'Solution'.",
  "Solution.kt:2:9: warning: variable 'unused' is never used.",
  "Solution.kt:1:1: info: something informational",
].join("\n");

describe("parseDiagnostics", () => {
  it("extracts errors and warnings for Solution.kt only", () => {
    expect(parseDiagnostics(RAW)).toEqual([
      { line: 4, column: 16, severity: "error", message: "return type mismatch: expected 'Int', actual 'String'." },
      { line: 4, column: 26, severity: "error", message: "unresolved reference 'c'." },
      { line: 2, column: 9, severity: "warning", message: "variable 'unused' is never used." },
    ]);
  });

  it("matches files by basename even with absolute paths", () => {
    expect(parseDiagnostics("/tmp/winnie-x/Solution.kt:3:5: error: boom")).toEqual([
      { line: 3, column: 5, severity: "error", message: "boom" },
    ]);
  });

  it("can target another file", () => {
    expect(parseDiagnostics(RAW, "Main.kt")).toEqual([
      { line: 9, column: 13, severity: "error", message: "unresolved reference 'Solution'." },
    ]);
  });

  it("returns an empty list for unrelated output", () => {
    expect(parseDiagnostics("error: something without a location")).toEqual([]);
  });
});
