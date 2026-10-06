import { describe, it, expect } from "vitest";
import { statusOf } from "./budget";
import { fmt, parseMoney, groupDigits, setDisplay } from "./money";
import { convert, FALLBACK } from "./fx";
import { payoff, forecastBalance, monteCarlo, healthScore, rentVsBuy } from "./finance";
describe("statusOf", () => {
  it("matches the live data => On Track", () => expect(statusOf(542800, 600000, 446910)).toBe("On Track"));
  it("At Risk / Over Budget", () => { expect(statusOf(100, 1000, 90)).toBe("At Risk"); expect(statusOf(2000, 1000, 0)).toBe("Over Budget"); });
});
describe("money", () => {
  it("formats UGX", () => { setDisplay("UGX", 1); expect(fmt(600000)).toMatch(/600,000/); });
  it("parses and groups", () => { expect(parseMoney("12,500")).toBe(12500); expect(parseMoney("0")).toBeNull(); expect(groupDigits("1234567")).toBe("1,234,567"); });
  it("converts via USD cross rates", () => expect(convert(3700, "UGX", "USD", FALLBACK)).toBeCloseTo(1));
});
describe("payoff", () => {
  it("0% single debt clears in balance/payment months", () => expect(payoff([{ name: "a", balance: 1000, apr: 0, min: 100 }], 0, "avalanche")).toMatchObject({ months: 10, interest: 0 }));
  it("avalanche never costs more interest than snowball", () => {
    const d = [{ name: "card", balance: 5000, apr: 36, min: 150 }, { name: "loan", balance: 2000, apr: 8, min: 80 }];
    expect(payoff(d, 100, "avalanche").interest).toBeLessThanOrEqual(payoff(d, 100, "snowball").interest);
  });
  it("reports never when minimum does not cover interest", () => expect(payoff([{ name: "x", balance: 1000, apr: 60, min: 10 }], 0, "snowball").months).toBeNull());
});
describe("forecast", () => {
  it("applies daily spend and a renewal", () => {
    const s = forecastBalance(1000, 10, [{ amount: 100, cycle: "monthly", next: "2026-01-05" }], 10, new Date(2026, 0, 1));
    expect(s[0]).toBe(1000); expect(s[10]).toBe(1000 - 100 - 100);
  });
});
describe("planning", () => {
  it("monte carlo is deterministic and bounded", () => {
    const p = { age: 30, retireAge: 60, lifeAge: 90, savings: 10000, monthly: 500, ret: 7, vol: 12, infl: 3, spend: 30000 };
    const a = monteCarlo(p, 500), b = monteCarlo(p, 500); expect(a).toEqual(b); expect(a.success).toBeGreaterThanOrEqual(0); expect(a.success).toBeLessThanOrEqual(1);
  });
  it("rent vs buy returns a payment", () => expect(rentVsBuy({ price: 1e6, downPct: 20, rate: 10, years: 20, rent: 4000, rentGrowth: 5, appreciation: 5, investReturn: 7 }).pmt).toBeGreaterThan(0));
  it("health score is within 0-100", () => { const h = healthScore({ status: "On Track", saved: 600, liquid: 0, monthlySpend: 100, debt: 0, assets: 0 }); expect(h.score).toBeLessThanOrEqual(100); expect(h.score).toBeGreaterThan(0); expect(healthScore({ status: null, saved: 0, liquid: 0, monthlySpend: 0, debt: 0, assets: 0 }).parts.length).toBe(2); });
});
