import { spawn } from "node:child_process";

export type ProcResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  outputLimitExceeded: boolean;
};

export type ProcOptions = { cwd: string; timeoutMs: number; maxOutputBytes?: number };

/** Runs a command, killing it (SIGKILL) on timeout or when combined output exceeds maxOutputBytes. */
export function runProcess(command: string, args: string[], opts: ProcOptions): Promise<ProcResult> {
  const maxOutputBytes = opts.maxOutputBytes ?? 32 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: opts.cwd, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let size = 0;
    let timedOut = false;
    let outputLimitExceeded = false;

    const collect = (chunks: Buffer[]) => (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxOutputBytes) {
        if (!outputLimitExceeded) {
          outputLimitExceeded = true;
          child.kill("SIGKILL");
        }
        return;
      }
      chunks.push(chunk);
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, opts.timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      resolve({
        exitCode,
        signal,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        timedOut,
        outputLimitExceeded,
      });
    });
  });
}
