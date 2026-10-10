// Pure financial calculations (no I/O) so they can be unit-tested.
export type Debt = { name: string; balance: number; apr: number; min: number };
export type Payoff = { months: number | null; interest: number; order: string[] };

// Monthly simulation. Total monthly budget = sum of minimums + extra; once a debt is cleared its payment rolls onto the target debt.
export function payoff(debts: Debt[], extra: number, strategy: "avalanche" | "snowball"): Payoff {
  const d = debts.filter(x => x.balance > 0).map(x => ({ ...x }));
  if (!d.length) return { months: 0, interest: 0, order: [] };
  const budget = d.reduce((t, x) => t + x.min, 0) + Math.max(extra, 0);
  let months = 0, interest = 0; const order: string[] = [];
  while (d.some(x => x.balance > 0.005) && months < 1200) {
    months++;
    for (const x of d) if (x.balance > 0) { const i = (x.balance * x.apr) / 1200; x.balance += i; interest += i; }
    let pool = budget;
    for (const x of d) if (x.balance > 0) { const p = Math.min(x.min, x.balance); x.balance -= p; pool -= p; }
    const target = d.filter(x => x.balance > 0.005).sort((a, b) => (strategy === "avalanche" ? b.apr - a.apr : a.balance - b.balance));
    for (const x of target) { if (pool <= 0) break; const p = Math.min(pool, x.balance); x.balance -= p; pool -= p; }
    for (const x of d) if (x.balance <= 0.005 && !order.includes(x.name)) { x.balance = 0; order.push(x.name); }
  }
  return { months: d.some(x => x.balance > 0.005) ? null : months, interest, order };
}

export type Sub = { amount: number; cycle: string; next: string };
export const monthlyEq = (amount: number, cycle: string) => (cycle === "weekly" ? (amount * 52) / 12 : cycle === "quarterly" ? amount / 3 : cycle === "yearly" ? amount / 12 : amount);
const advance = (d: Date, cycle: string) => { const x = new Date(d); if (cycle === "weekly") x.setDate(x.getDate() + 7); else x.setMonth(x.getMonth() + (cycle === "quarterly" ? 3 : cycle === "yearly" ? 12 : 1)); return x; };

// Projected balance for day 0..days: steady daily spend plus subscription charges on their renewal dates.
export function forecastBalance(balance: number, avgDaily: number, subs: Sub[], days: number, from = new Date()): number[] {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()), charges = new Array(days + 1).fill(0);
  for (const s of subs) { let d = new Date(s.next + "T00:00:00"), guard = 0;
    while (guard++ < 500 && d <= new Date(start.getTime() + days * 864e5)) { const i = Math.round((d.getTime() - start.getTime()) / 864e5); if (i >= 1 && i <= days) charges[i] += s.amount; d = advance(d, s.cycle); } }
  let run = balance, spent = 0;
  return Array.from({ length: days + 1 }, (_, i) => { if (i > 0) { run -= avgDaily; spent += charges[i]; } return run - spent; });
}

const rng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export type MC = { age: number; retireAge: number; lifeAge: number; savings: number; monthly: number; ret: number; vol: number; infl: number; spend: number };
// Annual-step Monte Carlo. Returns are normally distributed; contributions and spending grow with inflation; results in today's money.
export function monteCarlo(p: MC, n = 2000, seed = 42) {
  const r = rng(seed), g = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()), ends: number[] = []; let ok = 0;
  for (let i = 0; i < n; i++) { let bal = p.savings, dead = false;
    for (let a = p.age; a < p.lifeAge; a++) { const ret = p.ret / 100 + (p.vol / 100) * g(), f = Math.pow(1 + p.infl / 100, a - p.age);
      bal = a < p.retireAge ? bal * (1 + ret) + p.monthly * 12 * f : bal * (1 + ret) - p.spend * f; if (bal <= 0) { dead = true; bal = 0; break; } }
    if (!dead) ok++; ends.push(bal / Math.pow(1 + p.infl / 100, p.lifeAge - p.age)); }
  ends.sort((a, b) => a - b); const q = (x: number) => ends[Math.min(n - 1, Math.floor(x * n))];
  return { success: ok / n, p10: q(0.1), p50: q(0.5), p90: q(0.9) };
}

export function rentVsBuy(p: { price: number; downPct: number; rate: number; years: number; rent: number; rentGrowth: number; appreciation: number; investReturn: number }) {
  const loan = p.price * (1 - p.downPct / 100), n = p.years * 12, r = p.rate / 1200, down = (p.price * p.downPct) / 100;
  const pmt = r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));
  const finalValue = p.price * Math.pow(1 + p.appreciation / 100, p.years);
  const buyNet = down + pmt * n + p.price * 0.01 * p.years - finalValue; // 1% a year maintenance
  let rentTotal = 0, m = p.rent * 12; for (let y = 0; y < p.years; y++) { rentTotal += m; m *= 1 + p.rentGrowth / 100; }
  const rentNet = rentTotal - down * (Math.pow(1 + p.investReturn / 100, p.years) - 1);
  return { pmt, buyNet, rentNet };
}

export const ASSET_CLASSES = ["Bank account", "Mobile money", "Cash", "Equities", "ETFs", "Mutual funds", "Crypto", "Commodities", "Forex", "Real estate", "Private equity", "Collectibles", "Agricultural", "Vehicles"];
export const LIQUID_CLASSES = ["Bank account", "Mobile money", "Cash"];

// Loan amortisation. Returns the monthly payment, months to clear (with optional extra payment), total interest and a yearly balance table.
export function amortize(principal: number, aprPct: number, termMonths: number, extra = 0) {
  const r = aprPct / 1200, n = Math.max(1, Math.round(termMonths));
  const payment = r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
  let bal = principal, interest = 0, m = 0; const yearly: { year: number; balance: number; interest: number }[] = []; let yi = 0;
  while (bal > 0.005 && m < 1200) { m++; const i = bal * r; interest += i; yi += i; bal = Math.max(0, bal + i - (payment + Math.max(extra, 0))); if (m % 12 === 0 || bal <= 0.005) { yearly.push({ year: Math.ceil(m / 12), balance: bal, interest: yi }); yi = 0; } }
  return { payment, months: m, interest, totalPaid: principal + interest, yearly };
}
// Savings growth with monthly contributions, compounded monthly. One point per year.
export function futureValue(initial: number, monthly: number, aprPct: number, years: number) {
  const r = aprPct / 1200; let bal = initial; const out: { year: number; balance: number; contributed: number }[] = [{ year: 0, balance: initial, contributed: initial }];
  for (let y = 1; y <= years; y++) { for (let k = 0; k < 12; k++) bal = bal * (1 + r) + monthly; out.push({ year: y, balance: bal, contributed: initial + monthly * 12 * y }); }
  return out;
}
export function requiredMonthly(target: number, initial: number, aprPct: number, years: number) {
  const n = years * 12, r = aprPct / 1200, grown = initial * Math.pow(1 + r, n);
  if (grown >= target) return 0;
  return r === 0 ? (target - initial) / n : ((target - grown) * r) / (Math.pow(1 + r, n) - 1);
}

// Transparent 0-100 score from the parts that apply. Budget status (40) only if a budget exists; savings rate (20) and debt-to-income (20) only if income is recorded.
export function healthScore(i: { status: string | null; saved: number; liquid: number; monthlySpend: number; debt: number; assets: number; income?: number; debtPayments?: number }) {
  const parts: { label: string; value: number; max: number }[] = [];
  if (i.status) parts.push({ label: "Budget status", value: i.status === "On Track" ? 40 : i.status === "At Risk" ? 25 : 8, max: 40 });
  const cushion = i.saved + i.liquid, months = i.monthlySpend > 0 ? cushion / i.monthlySpend : cushion > 0 ? 6 : 0;
  parts.push({ label: "Cash cushion", value: Math.round(Math.min(30, (months / 6) * 30)), max: 30 });
  const denom = i.assets + i.saved, ratio = denom > 0 ? i.debt / denom : i.debt > 0 ? 1 : 0;
  parts.push({ label: "Debt vs assets", value: Math.round(30 * (1 - Math.min(1, ratio))), max: 30 });
  if ((i.income ?? 0) > 0) {
    const rate = Math.max(0, ((i.income as number) - i.monthlySpend) / (i.income as number));
    parts.push({ label: "Savings rate", value: Math.round(20 * Math.min(1, rate / 0.2)), max: 20 });
    const dti = (i.debtPayments ?? 0) / (i.income as number);
    parts.push({ label: "Debt-to-income", value: Math.round(20 * (1 - Math.min(1, Math.max(0, (dti - 0.2) / 0.3)))), max: 20 });
  }
  const max = parts.reduce((t, x) => t + x.max, 0), val = parts.reduce((t, x) => t + x.value, 0);
  return { score: Math.round((val / max) * 100), parts };
}
