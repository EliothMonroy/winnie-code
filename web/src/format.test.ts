import { describe, expect, it } from "vitest";
import { formatElapsedMs } from "./format";

describe("formatElapsedMs", () => {
  it("never shows a misleading 0 ms for a real sub-millisecond time", () => {
    expect(formatElapsedMs(0.042)).toBe("0.04 ms");
    expect(formatElapsedMs(0.001)).toBe("0.00 ms");
    expect(formatElapsedMs(0.999)).toBe("1.00 ms");
  });

  it("shows one decimal between 1 and 10 ms", () => {
    expect(formatElapsedMs(1.767)).toBe("1.8 ms");
    expect(formatElapsedMs(9.9)).toBe("9.9 ms");
  });

  it("rounds to whole milliseconds at 10 ms and above", () => {
    expect(formatElapsedMs(10)).toBe("10 ms");
    expect(formatElapsedMs(12.4)).toBe("12 ms");
    expect(formatElapsedMs(999.6)).toBe("1000 ms");
  });

  it("falls back to a plain 0 ms for negative or non-finite input, but shows real zero as 0.00 ms", () => {
    expect(formatElapsedMs(0)).toBe("0.00 ms");
    expect(formatElapsedMs(-5)).toBe("0 ms");
    expect(formatElapsedMs(NaN)).toBe("0 ms");
  });
});
