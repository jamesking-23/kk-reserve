"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fmt, displayCurrency } from "@/lib/money";
import { convert, Rates } from "@/lib/fx";
import { statusOf } from "@/lib/budget";
import { healthScore, monthlyEq, ASSET_CLASSES, LIQUID_CLASSES } from "@/lib/finance";
import { AreaChart, Donut, PALETTE } from "@/components/Charts";
import { Section } from "@/components/ui";

type Snap = { taken_on: string; assets: number; liabilities: number };
type D = { assets: number; liquid: number; debt: number; debtPay: number; saved: number; target: number; income: number; spend30: number; gain: number; hasBasis: boolean; hold: { name: string; cls: string; value: number }[]; snaps: Snap[]; subs: { name: string; amount: number; next: string }[]; bud: null | { name: string; status: string; remaining: number; available: number } };
const today = () => new Date().toISOString().slice(0, 10);
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function Overview({ rates, name, go }: { rates: Rates; name: string; go: (tab: string) => void }) {
  const [d, setD] = useState<D | null>(null);
  useEffect(() => { (async () => {
    const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const [a, l, rs, rc, inc, ex, bs, sn, sb] = await Promise.all([
      supabase.from("assets").select("name,class,value,currency,cost_basis"), supabase.from("liabilities").select("balance,min_payment"),
      supabase.from("reserves").select("target_amount").eq("archived", false), supabase.from("reserve_contributions").select("amount"),
      supabase.from("income_sources").select("amount,cycle").eq("status", "active"), supabase.from("expenses").select("amount").gte("spent_on", since),
      supabase.from("budgets").select("id,name,starting_balance,contingency_pct").eq("archived", false).order("created_at", { ascending: false }).limit(1),
      supabase.from("net_worth_snapshots").select("taken_on,assets,liabilities").order("taken_on").limit(180),
      supabase.from("subscriptions").select("name,amount,next_renewal").eq("status", "active")]);
    const cv = (v: number, c: string) => convert(v, c, "UGX", rates);
    const hold = (a.data ?? []).map(x => ({ name: x.name as string, cls: x.class as string, value: cv(Number(x.value), x.currency) }));
    const assets = hold.reduce((t, h) => t + h.value, 0), debt = (l.data ?? []).reduce((t, x) => t + Number(x.balance), 0);
    const basis = (a.data ?? []).filter(x => x.cost_basis !== null && x.cost_basis !== undefined);
    let bud: D["bud"] = null; const b0 = bs.data?.[0];
    if (b0) { const [c, i, e] = await Promise.all([supabase.from("planned_categories").select("amount").eq("budget_id", b0.id), supabase.from("budget_income").select("amount").eq("budget_id", b0.id), supabase.from("expenses").select("amount").eq("budget_id", b0.id)]);
      const planned = (c.data ?? []).reduce((t, x) => t + Number(x.amount), 0) * (1 + Number(b0.contingency_pct) / 100), avail = Number(b0.starting_balance) + (i.data ?? []).reduce((t, x) => t + Number(x.amount), 0), spent = (e.data ?? []).reduce((t, x) => t + Number(x.amount), 0);
      bud = { name: b0.name, status: statusOf(planned, avail, spent), remaining: avail - spent, available: avail }; }
    let snaps = (sn.data ?? []) as Snap[];
    if (assets > 0 || debt > 0) { await supabase.from("net_worth_snapshots").upsert({ taken_on: today(), assets, liabilities: debt }, { onConflict: "user_id,taken_on" }); snaps = [...snaps.filter(s => s.taken_on !== today()), { taken_on: today(), assets, liabilities: debt }]; }
    setD({ assets, debt, hold, snaps, bud, liquid: hold.filter(h => LIQUID_CLASSES.includes(h.cls)).reduce((t, h) => t + h.value, 0), debtPay: (l.data ?? []).reduce((t, x) => t + Number(x.min_payment), 0),
      saved: (rc.data ?? []).reduce((t, x) => t + Number(x.amount), 0), target: (rs.data ?? []).reduce((t, x) => t + Number(x.target_amount), 0), income: (inc.data ?? []).reduce((t, x) => t + monthlyEq(Number(x.amount), x.cycle), 0),
      spend30: (ex.data ?? []).reduce((t, x) => t + Number(x.amount), 0), hasBasis: basis.length > 0, gain: basis.reduce((t, x) => t + cv(Number(x.value) - Number(x.cost_basis), x.currency), 0),
      subs: (sb.data ?? []).map(x => ({ name: x.name as string, amount: Number(x.amount), next: x.next_renewal as string })).filter(x => (new Date(x.next + "T00:00:00").getTime() - Date.now()) / 864e5 <= 14).sort((p, q) => p.next.localeCompare(q.next)) });
  })(); }, [rates]);

  const hr = new Date().getHours(), hello = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  if (!d) return <Section title={`${hello}, ${name}`} sub="Loading your financial position..."><div className="surface h-40 animate-pulse rounded-3xl" /></Section>;
  const nw = d.assets - d.debt, ago = d.snaps.find(s => s.taken_on >= new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)), change = ago ? nw - (ago.assets - ago.liabilities) : null;
  const savingsRate = d.income > 0 ? (d.income - d.spend30) / d.income : null, dti = d.income > 0 ? d.debtPay / d.income : null, runway = d.spend30 > 0 ? d.liquid / d.spend30 : null;
  const hs = healthScore({ status: d.bud?.status ?? null, saved: d.saved, liquid: d.liquid, monthlySpend: d.spend30, debt: d.debt, assets: d.assets, income: d.income, debtPayments: d.debtPay });
  const byClass = ASSET_CLASSES.map((c, i) => ({ label: c, value: d.hold.filter(h => h.cls === c).reduce((t, h) => t + h.value, 0), color: PALETTE[i % PALETTE.length] })).filter(x => x.value > 0);
  const top = [...d.hold].sort((x, y) => y.value - x.value).slice(0, 6);
  const trend = d.snaps.map(s => ({ label: new Date(s.taken_on + "T00:00:00").toLocaleDateString("en-UG", { day: "numeric", month: "short" }), value: Math.max(0, s.assets - s.liabilities) }));
  const dc = displayCurrency(), quote = (c: string) => `1 ${c} = ${convert(1, c, dc, rates).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${dc}`;
  const metrics: [string, string, string][] = [
    ["Monthly income", d.income > 0 ? fmt(d.income) : "Not set", d.income > 0 ? "From income sources" : "Add under Cash flow"],
    ["Savings rate", savingsRate === null ? "-" : pct(savingsRate), "Income less 30-day spending"],
    ["Debt-to-income", dti === null ? "-" : pct(dti), "Debt payments vs income"],
    ["Cash runway", runway === null ? "-" : `${runway.toFixed(1)} months`, "Liquid cash vs spending"],
    ["Savings in goals", fmt(d.saved), d.target > 0 ? `${pct(Math.min(1, d.saved / d.target))} of ${fmt(d.target)}` : "No goals yet"],
    ["Investment gain", d.hasBasis ? fmt(d.gain) : "-", d.hasBasis ? "Value less cost basis" : "Add cost basis in Wealth"]];

  return (
    <Section title={`${hello}, ${name}`} sub="Your complete financial position at a glance." action={<span className="text-sm text-gray-400">{new Date().toLocaleDateString("en-UG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>}>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-indigo-900 p-5 text-white shadow-xl lg:col-span-2">
          <p className="text-sm text-white/70">Net worth</p><p className="mt-1 text-4xl font-bold tracking-tight md:text-5xl">{fmt(nw)}</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-white/80">{change === null ? "Trend builds as you use the app" : <>{change >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}{fmt(Math.abs(change))} over 30 days</>}</p>
          <div className="mt-5 grid grid-cols-3 gap-3 text-sm">{([["Assets", fmt(d.assets)], ["Liabilities", fmt(d.debt)], ["Liquid cash", fmt(d.liquid)]] as [string, string][]).map(([l, v]) => <div key={l} className="rounded-2xl bg-white/10 p-3"><p className="text-xs text-white/70">{l}</p><p className="truncate font-semibold">{v}</p></div>)}</div></div>
        <div className="surface rounded-3xl p-4"><h3 className="font-semibold">Financial health</h3><p className="mt-1 text-4xl font-bold tracking-tight">{hs.score}<span className="text-base font-medium text-gray-400"> / 100</span></p>
          <div className="mt-2 space-y-2 text-sm">{hs.parts.map(x => <div key={x.label}><div className="flex justify-between text-gray-400"><span>{x.label}</span><span>{x.value}/{x.max}</span></div><div className="h-1.5 rounded bg-white/10"><div className="h-1.5 rounded bg-gold" style={{ width: (x.value / x.max) * 100 + "%" }} /></div></div>)}</div></div>
      </div>
      <section aria-label="Metrics" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">{metrics.map(([l, v, s]) => <div key={l} className="surface rounded-3xl p-4"><p className="text-xs text-gray-400">{l}</p><p className="mt-1 truncate text-lg font-bold tracking-tight">{v}</p><p className="truncate text-xs text-gray-400">{s}</p></div>)}</section>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <div className="surface rounded-3xl p-4"><h3 className="mb-2 font-semibold">Net worth trend</h3>{trend.length >= 2 ? <AreaChart data={trend} /> : <p className="text-sm text-gray-400">A snapshot is saved each day you open the app. The trend appears after two days of history.</p>}</div>
          <div className="surface rounded-3xl p-4"><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Accounts and holdings</h3><button className="glass rounded-xl px-3 py-1.5 text-sm" onClick={() => go("wealth")}>Manage</button></div>
            {top.length === 0 && <p className="text-sm text-gray-400">No accounts added yet. Add your bank, savings and cash accounts under Wealth to see balances here.</p>}
            {top.map(h => <div key={h.name + h.cls} className="flex items-center justify-between gap-3 rounded-2xl p-2 text-sm"><div className="min-w-0"><p className="truncate font-medium">{h.name}</p><p className="text-xs text-gray-400">{h.cls}</p></div><p className="font-semibold">{fmt(h.value)}</p></div>)}</div>
        </div>
        <aside className="space-y-4">
          <div className="surface rounded-3xl p-4"><h3 className="mb-2 font-semibold">Allocation</h3><Donut slices={byClass} total={d.assets} />
            <ul className="mt-3 space-y-1.5 text-sm">{byClass.length === 0 && <li className="text-gray-400">Nothing to show yet.</li>}{byClass.map(x => <li key={x.label} className="flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: x.color }} /><span className="flex-1 truncate">{x.label}</span><span className="text-gray-400">{Math.round((x.value / d.assets) * 100)}%</span></li>)}</ul></div>
          <div className="surface space-y-1 rounded-3xl p-4 text-sm"><div className="flex items-center justify-between"><h3 className="font-semibold">Markets</h3><button className="glass rounded-xl px-3 py-1.5" onClick={() => go("markets")}>Open</button></div>{["USD", "EUR", "GBP"].filter(c => c !== dc).map(c => <p key={c} className="tabular-nums text-gray-300">{quote(c)}</p>)}</div>
          <div className="surface space-y-1 rounded-3xl p-4 text-sm"><h3 className="font-semibold">Upcoming renewals</h3>{d.subs.length === 0 && <p className="text-gray-400">Nothing due in the next 14 days.</p>}{d.subs.map(s => <p key={s.name + s.next} className="flex justify-between gap-2"><span className="truncate">{s.name}</span><span className="text-gray-400">{fmt(s.amount)} on {new Date(s.next + "T00:00:00").toLocaleDateString("en-UG", { day: "numeric", month: "short" })}</span></p>)}</div>
          {d.bud && <div className="surface space-y-1 rounded-3xl p-4 text-sm"><h3 className="font-semibold">Latest budget</h3><p>{d.bud.name}: <b>{d.bud.status}</b></p><p className="text-gray-400">{fmt(d.bud.remaining)} left of {fmt(d.bud.available)}</p>{d.bud.status === "Over Budget" && <p className="flex items-center gap-1 text-red-400"><AlertTriangle size={14} />Spending exceeds funds.</p>}<button className="glass mt-1 rounded-xl px-3 py-1.5" onClick={() => go("plan")}>Open budgets</button></div>}
        </aside>
      </div>
    </Section>
  );
}
