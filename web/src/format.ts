/**
 * Formats a per-case elapsed time (in milliseconds, possibly fractional) for display.
 * Once the JVM is warmed up, most cases genuinely run in well under 1 ms, so a naive
 * whole-millisecond display would show a misleading "0 ms" for almost every case after
 * the first. Instead we scale precision to the magnitude:
 *   - below 1 ms: two decimals, e.g. "0.04 ms"
 *   - below 10 ms: one decimal, e.g. "1.8 ms"
 *   - 10 ms and above: whole milliseconds, e.g. "12 ms"
 */
export function formatElapsedMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0 ms";
  if (ms >= 10) return `${Math.round(ms)} ms`;
  if (ms >= 1) return `${ms.toFixed(1)} ms`;
  return `${ms.toFixed(2)} ms`;
}
