import { describe, it, expect } from "vitest";
import { statusOf } from "./budget";
import { fmt, parseMoney, groupDigits } from "./money";
describe("statusOf", () => {
  it("matches the live data (600,000 / 542,800 / 446,910) => On Track", () => expect(statusOf(542800, 600000, 446910)).toBe("On Track"));
  it("At Risk above 85% of plan", () => expect(statusOf(100, 1000, 90)).toBe("At Risk"));
  it("Over Budget when planned exceeds balance or balance is negative", () => { expect(statusOf(2000, 1000, 0)).toBe("Over Budget"); expect(statusOf(100, 1000, 1200)).toBe("Over Budget"); });
});
describe("money", () => {
  it("formats UGX without decimals", () => expect(fmt(600000)).toMatch(/600,000/));
  it("parses grouped input", () => { expect(parseMoney("12,500")).toBe(12500); expect(parseMoney("abc")).toBeNull(); expect(parseMoney("0")).toBeNull(); });
  it("groups digits", () => expect(groupDigits("1234567")).toBe("1,234,567"));
});
