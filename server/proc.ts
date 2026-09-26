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
    // detached: true makes the child its own process-group leader, so -pid targets the whole
    // group below. Needed because kotlinc (Homebrew's bash wrapper) execs java as a child
    // without `exec`, and killing just the wrapper leaves the JVM orphaned holding the pipes.
    const child = spawn(command, args, { cwd: opts.cwd, stdio: ["ignore", "pipe", "pipe"], detached: true });

    const killGroup = () => {
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch {
        // The group may already be gone.
      }
    };

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
          killGroup();
        }
        return;
      }
      chunks.push(chunk);
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));

    const timer = setTimeout(() => {
      timedOut = true;
      killGroup();
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
