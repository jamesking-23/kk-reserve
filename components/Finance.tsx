"use client";
import { useEffect, useState, useCallback, ComponentType, ReactNode } from "react";
import { AlertTriangle, Trash2, CheckCircle2, Globe, Link2, Info } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fmt, fmtIn, parseMoney, groupDigits } from "@/lib/money";
import { payoff, forecastBalance, monteCarlo, rentVsBuy, monthlyEq } from "@/lib/finance";
import { CURRENCIES, COUNTRIES, convert, Rates } from "@/lib/fx";
import { AreaChart, Donut, PALETTE } from "@/components/Charts";

type Btn = ComponentType<{ children: ReactNode; onClick: () => Promise<void> | void }>;
type Common = { Btn: Btn; say: (m: string) => void };
const input = "glass w-full rounded-2xl p-3 outline-none focus:border-yellow-400";
const num = (s: string) => Number((s || "0").replace(/,/g, "")) || 0;

function useRows<T>(table: string) {
  const [rows, setRows] = useState<T[]>([]);
  const load = useCallback(async () => { const { data } = await supabase.from(table).select("*").order("created_at"); setRows((data ?? []) as T[]); }, [table]);
  useEffect(() => { load(); }, [load]);
  return { rows, load };
}
const Page = ({ title, sub, children, rail }: { title: string; sub: string; children: ReactNode; rail: ReactNode }) => (
  <div className="space-y-4"><div><h2 className="text-2xl font-bold tracking-tight">{title}</h2><p className="text-sm text-gray-400">{sub}</p></div>
    <div className="grid gap-4 md:grid-cols-3"><div className="space-y-4 md:col-span-2">{children}</div><aside className="space-y-4">{rail}</aside></div></div>
);
const Card = ({ title, children }: { title?: string; children: ReactNode }) => <div className="surface space-y-3 rounded-3xl p-4">{title && <h3 className="font-semibold">{title}</h3>}{children}</div>;
const Kpi = ({ label, value }: { label: string; value: string }) => <div><p className="text-sm text-gray-400">{label}</p><p className="text-xl font-bold tracking-tight">{value}</p></div>;
function Remove({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  const [armed, setArmed] = useState(false);
  return armed ? <button className="rounded-lg bg-red-500 px-2 py-1 text-xs font-semibold text-white" onClick={onConfirm} onBlur={() => setArmed(false)} autoFocus>Confirm delete</button>
    : <button aria-label={label} className="p-2 text-gray-400" onClick={() => setArmed(true)}><Trash2 size={16} /></button>;
}

/* ---------- Cash flow: subscriptions + forecast ---------- */
type SubRow = { id: string; name: string; amount: number; cycle: string; next_renewal: string; last_used: string | null; status: string; created_at: string };
export function CashFlow({ Btn, say, balance, avgDaily }: Common & { balance: number; avgDaily: number }) {
  const { rows, load } = useRows<SubRow>("subscriptions");
  const [f, setF] = useState({ name: "", amount: "", cycle: "monthly", next: "" });
  const [withSubs, setWithSubs] = useState(true);
  const today = new Date().toISOString().slice(0, 10), active = rows.filter(r => r.status === "active");
  const days = (d: string) => Math.ceil((new Date(d + "T00:00:00").getTime() - Date.now()) / 864e5);
  const idle = (r: SubRow) => Date.now() - new Date((r.last_used ?? r.created_at.slice(0, 10)) + "T00:00:00").getTime() > 60 * 864e5;
  const add = async () => { const a = parseMoney(f.amount); if (!f.name.trim() || a === null || !f.next) return say("Enter a name, amount and next renewal date.");
    const { error } = await supabase.from("subscriptions").insert({ name: f.name.trim(), amount: a, cycle: f.cycle, next_renewal: f.next }); if (error) return say(error.message); setF({ ...f, name: "", amount: "" }); load(); };
  const patch = async (id: string, v: object) => { await supabase.from("subscriptions").update(v).eq("id", id); load(); };
  const series = forecastBalance(balance, avgDaily, withSubs ? active.map(r => ({ amount: Number(r.amount), cycle: r.cycle, next: r.next_renewal })) : [], 90);
  const runOut = series.findIndex(v => v < 0), monthly = active.reduce((t, r) => t + monthlyEq(Number(r.amount), r.cycle), 0);
  const chart = series.map((v, i) => ({ label: i === 0 ? "Today" : `+${i}d`, value: Math.max(v, 0) })).filter((_, i) => i % 3 === 0);
  return (
    <Page title="Cash flow" sub="Forecast your balance and keep recurring charges under control."
      rail={<><Card title="Forecast"><Kpi label="In 30 days" value={fmt(series[30])} /><Kpi label="In 60 days" value={fmt(series[60])} /><Kpi label="In 90 days" value={fmt(series[90])} />
        <p className={`flex items-start gap-2 text-sm ${runOut > 0 ? "text-red-400" : "text-gray-400"}`}>{runOut > 0 ? <><AlertTriangle size={16} className="mt-0.5 shrink-0" />At this pace your balance runs out in about {runOut} days.</> : "Your balance lasts through the next 90 days at this pace."}</p></Card>
        <Card title="Subscriptions"><Kpi label="Monthly cost" value={fmt(monthly)} /><Kpi label="Yearly cost" value={fmt(monthly * 12)} /></Card></>}>
      <Card title="90-day balance forecast"><p className="text-sm text-gray-400">Based on your average daily spend of {fmt(avgDaily)} (last 60 days) and the budget balance of {fmt(balance)}.</p>
        <AreaChart data={chart} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={withSubs} onChange={e => setWithSubs(e.target.checked)} /> Include subscription renewals (turn off if you already log them as expenses)</label></Card>
      <Card title="Active subscriptions">
        {active.length === 0 && <p className="text-sm text-gray-400">No subscriptions tracked yet.</p>}
        {active.map(r => { const d = days(r.next_renewal); return (
          <div key={r.id} className="rounded-2xl bg-white/5 p-3 text-sm"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold">{r.name}</p>
            <p className="text-gray-400">{fmt(Number(r.amount))} {r.cycle} - renews {d <= 0 ? "today" : `in ${d} days`}</p></div><Remove label={`Delete ${r.name}`} onConfirm={async () => { await supabase.from("subscriptions").delete().eq("id", r.id); load(); }} /></div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {d >= 0 && d <= 7 && <span className="inline-flex items-center gap-1 rounded-full bg-orange-400/20 px-2 py-0.5 text-orange-400"><AlertTriangle size={12} />Renews soon</span>}
              {idle(r) && <span className="inline-flex items-center gap-1 rounded-full bg-red-400/15 px-2 py-0.5 text-red-400"><AlertTriangle size={12} />Possibly unused</span>}
              <button className="glass rounded-lg px-2 py-1" onClick={() => patch(r.id, { last_used: today })}>Mark used today</button>
              <button className="glass rounded-lg px-2 py-1" onClick={() => patch(r.id, { status: "cancelled" })}>Start cancellation</button></div></div>); })}</Card>
      {rows.some(r => r.status === "cancelled") && <Card title="Cancellation checklist">{rows.filter(r => r.status === "cancelled").map(r => (
        <div key={r.id} className="text-sm"><p className="font-semibold">{r.name}</p><ul className="list-disc pl-5 text-gray-400"><li>Cancel with the provider (app, website or support).</li><li>Remove your saved payment method or mobile money approval.</li><li>Keep the confirmation message or email.</li></ul>
          <button className="mt-1 inline-flex items-center gap-1 text-yellow-400" onClick={() => supabase.from("subscriptions").delete().eq("id", r.id).then(load)}><CheckCircle2 size={14} />Done, remove from list</button></div>))}</Card>}
      <Card title="Add a subscription"><div className="grid gap-2 sm:grid-cols-2"><input className={input} aria-label="Name" placeholder="Name (e.g. Netflix)" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        <input className={input} aria-label="Amount" inputMode="numeric" placeholder="Amount" value={f.amount} onChange={e => setF({ ...f, amount: groupDigits(e.target.value) })} />
        <select className={input} aria-label="Billing cycle" value={f.cycle} onChange={e => setF({ ...f, cycle: e.target.value })}>{["weekly", "monthly", "quarterly", "yearly"].map(c => <option key={c}>{c}</option>)}</select>
        <input className={input} type="date" aria-label="Next renewal" value={f.next} onChange={e => setF({ ...f, next: e.target.value })} /></div><Btn onClick={add}>Add subscription</Btn></Card>
    </Page>
  );
}

/* ---------- Debt hub + payoff simulator ---------- */
type DebtRow = { id: string; name: string; kind: string; balance: number; apr: number; min_payment: number };
const KINDS = ["Mortgage", "SACCO loan", "Student loan", "Auto financing", "Personal loan", "Credit card"];
export function DebtHub({ Btn, say }: Common) {
  const { rows, load } = useRows<DebtRow>("liabilities");
  const [f, setF] = useState({ name: "", kind: KINDS[4], balance: "", apr: "", min: "" }); const [extra, setExtra] = useState("");
  const add = async () => { const bal = parseMoney(f.balance), min = parseMoney(f.min), apr = Number(f.apr || 0);
    if (!f.name.trim() || bal === null || min === null || !(apr >= 0 && apr <= 200)) return say("Enter a name, balance, minimum payment and an APR between 0 and 200.");
    const { error } = await supabase.from("liabilities").insert({ name: f.name.trim(), kind: f.kind, balance: bal, apr, min_payment: min }); if (error) return say(error.message); setF({ ...f, name: "", balance: "", apr: "", min: "" }); load(); };
  const debts = rows.map(r => ({ name: r.name, balance: Number(r.balance), apr: Number(r.apr), min: Number(r.min_payment) }));
  const ex = num(extra), base = payoff(debts, 0, "avalanche"), av = payoff(debts, ex, "avalanche"), sn = payoff(debts, ex, "snowball");
  const total = debts.reduce((t, d) => t + d.balance, 0), mins = debts.reduce((t, d) => t + d.min, 0);
  const when = (m: number | null) => (m === null ? "Never (payments too low)" : `${Math.floor(m / 12)}y ${m % 12}m`);
  const col = (t: string, p: ReturnType<typeof payoff>) => (
    <div className="rounded-2xl bg-white/5 p-3 text-sm"><p className="font-semibold">{t}</p><p>Debt-free in <b>{when(p.months)}</b></p><p>Total interest <b>{fmt(p.interest)}</b></p>
      {base.months !== null && p.months !== null && <p className="text-green-400">Saves {fmt(Math.max(0, base.interest - p.interest))} vs minimums only</p>}<p className="mt-1 text-gray-400">Order: {p.order.join(", ") || "-"}</p></div>);
  return (
    <Page title="Debt and liabilities" sub="Track what you owe and compare payoff strategies."
      rail={<Card title="Summary"><Kpi label="Total owed" value={fmt(total)} /><Kpi label="Monthly minimums" value={fmt(mins)} /><p className="flex items-start gap-2 text-xs text-gray-400"><Info size={14} className="mt-0.5 shrink-0" />Credit score monitoring needs a credit bureau partner and is not connected.</p></Card>}>
      <Card title="Your liabilities">{rows.length === 0 && <p className="text-sm text-gray-400">No debts recorded.</p>}
        {rows.map(r => <div key={r.id} className="flex items-center justify-between gap-2 rounded-2xl bg-white/5 p-3 text-sm"><div className="min-w-0"><p className="font-semibold">{r.name} <span className="font-normal text-gray-400">({r.kind})</span></p>
          <p className="text-gray-400">{fmt(Number(r.balance))} at {Number(r.apr)}% APR - min {fmt(Number(r.min_payment))}/month</p></div>
          <Remove label={`Delete ${r.name}`} onConfirm={async () => { await supabase.from("liabilities").delete().eq("id", r.id); load(); }} /></div>)}</Card>
      <Card title="Payoff simulator"><label className="block text-sm text-gray-300">Extra payment per month<input className={input} inputMode="numeric" placeholder="0" value={extra} onChange={e => setExtra(groupDigits(e.target.value))} /></label>
        {debts.length > 0 && <div className="grid gap-2 sm:grid-cols-3">{col("Minimums only", base)}{col("Avalanche (highest APR first)", av)}{col("Snowball (smallest balance first)", sn)}</div>}</Card>
      <Card title="Add a liability"><div className="grid gap-2 sm:grid-cols-2"><input className={input} aria-label="Name" placeholder="Name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        <select className={input} aria-label="Type" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}>{KINDS.map(k => <option key={k}>{k}</option>)}</select>
        <input className={input} aria-label="Balance" inputMode="numeric" placeholder="Balance" value={f.balance} onChange={e => setF({ ...f, balance: groupDigits(e.target.value) })} />
        <input className={input} aria-label="APR percent" inputMode="decimal" placeholder="Interest rate % per year" value={f.apr} onChange={e => setF({ ...f, apr: e.target.value })} />
        <input className={input} aria-label="Minimum payment" inputMode="numeric" placeholder="Minimum monthly payment" value={f.min} onChange={e => setF({ ...f, min: groupDigits(e.target.value) })} /></div><Btn onClick={add}>Add liability</Btn></Card>
    </Page>
  );
}

/* ---------- Wealth: manual multi-asset tracking + net worth ---------- */
type AssetRow = { id: string; name: string; class: string; value: number; currency: string };
const CLASSES = ["Equities", "ETFs", "Mutual funds", "Crypto", "Commodities", "Forex", "Cash", "Real estate", "Private equity", "Collectibles", "Agricultural", "Vehicles"];
export function Wealth({ Btn, say, rates }: Common & { rates: Rates }) {
  const { rows, load } = useRows<AssetRow>("assets"); const debts = useRows<DebtRow>("liabilities").rows;
  const [f, setF] = useState({ name: "", cls: CLASSES[0], value: "", cur: "UGX" });
  const add = async () => { const v = parseMoney(f.value); if (!f.name.trim() || v === null) return say("Enter a name and a valid value.");
    const { error } = await supabase.from("assets").insert({ name: f.name.trim(), class: f.cls, value: v, currency: f.cur }); if (error) return say(error.message); setF({ ...f, name: "", value: "" }); load(); };
  const base = (a: AssetRow) => convert(Number(a.value), a.currency, "UGX", rates);
  const assets = rows.reduce((t, a) => t + base(a), 0), owed = debts.reduce((t, d) => t + Number(d.balance), 0);
  const byClass = CLASSES.map((c, i) => ({ label: c, value: rows.filter(a => a.class === c).reduce((t, a) => t + base(a), 0), color: PALETTE[i % PALETTE.length] })).filter(x => x.value > 0);
  return (
    <Page title="Wealth" sub="Manual valuations across every asset class, with net worth."
      rail={<><Card title="Net worth"><Kpi label="Net worth" value={fmt(assets - owed)} /><Kpi label="Assets" value={fmt(assets)} /><Kpi label="Liabilities" value={fmt(owed)} /></Card>
        <Card title="Allocation"><Donut slices={byClass} total={assets} /><ul className="space-y-1 text-sm">{byClass.map(x => <li key={x.label} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} /><span className="flex-1">{x.label}</span><span>{Math.round((x.value / assets) * 100)}%</span></li>)}</ul></Card>
        <p className="flex items-start gap-2 text-xs text-gray-400"><Info size={14} className="mt-0.5 shrink-0" />Values are entered by you. Live market prices, benchmarks and tax-loss harvesting need market-data partners and are not connected.</p></>}>
      <Card title="Holdings">{rows.length === 0 && <p className="text-sm text-gray-400">No assets yet. Add your first holding below.</p>}
        {rows.map(a => <div key={a.id} className="flex items-center justify-between gap-2 rounded-2xl bg-white/5 p-3 text-sm"><div className="min-w-0"><p className="font-semibold">{a.name}</p><p className="text-gray-400">{a.class}</p></div>
          <div className="text-right"><p className="font-semibold">{fmtIn(Number(a.value), a.currency)}</p>{a.currency !== "UGX" && <p className="text-xs text-gray-400">about {fmt(base(a))}</p>}</div>
          <Remove label={`Delete ${a.name}`} onConfirm={async () => { await supabase.from("assets").delete().eq("id", a.id); load(); }} /></div>)}</Card>
      <Card title="Add an asset"><div className="grid gap-2 sm:grid-cols-2"><input className={input} aria-label="Name" placeholder="Name (e.g. Plot in Entebbe)" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        <select className={input} aria-label="Asset class" value={f.cls} onChange={e => setF({ ...f, cls: e.target.value })}>{CLASSES.map(c => <option key={c}>{c}</option>)}</select>
        <input className={input} aria-label="Value" inputMode="numeric" placeholder="Current value" value={f.value} onChange={e => setF({ ...f, value: groupDigits(e.target.value) })} />
        <select className={input} aria-label="Currency" value={f.cur} onChange={e => setF({ ...f, cur: e.target.value })}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div><Btn onClick={add}>Add asset</Btn></Card>
    </Page>
  );
}

/* ---------- Planning: Monte Carlo retirement + rent vs buy ---------- */
export function Planning() {
  const [m, setM] = useState({ age: "30", retire: "60", life: "90", savings: "10,000,000", monthly: "500,000", ret: "9", vol: "14", infl: "5", spend: "30,000,000" });
  const [h, setH] = useState({ price: "300,000,000", down: "20", rate: "17", years: "20", rent: "1,500,000", rentG: "6", appr: "7", inv: "10" });
  const r = monteCarlo({ age: num(m.age), retireAge: num(m.retire), lifeAge: num(m.life), savings: num(m.savings), monthly: num(m.monthly), ret: num(m.ret), vol: num(m.vol), infl: num(m.infl), spend: num(m.spend) });
  const valid = num(m.retire) > num(m.age) && num(m.life) > num(m.retire);
  const rb = rentVsBuy({ price: num(h.price), downPct: num(h.down), rate: num(h.rate), years: num(h.years) || 1, rent: num(h.rent), rentGrowth: num(h.rentG), appreciation: num(h.appr), investReturn: num(h.inv) });
  const f = (label: string, v: string, set: (s: string) => void, money = false) => <label className="block text-xs text-gray-400">{label}<input className={input} inputMode="decimal" value={v} onChange={e => set(money ? groupDigits(e.target.value) : e.target.value)} /></label>;
  return (
    <Page title="Planning" sub="Stress-test retirement and compare big life decisions. All figures are in your base currency."
      rail={<><Card title="Retirement result">{valid ? <><Kpi label="Chance your money lasts" value={`${Math.round(r.success * 100)}%`} /><Kpi label="Typical end balance (today's money)" value={fmt(r.p50)} />
        <p className="text-xs text-gray-400">Bad case (10th percentile): {fmt(r.p10)}. Good case (90th): {fmt(r.p90)}. 2,000 simulated market paths.</p></> : <p className="text-sm text-red-400">Retirement age must be above current age, and life expectancy above retirement age.</p>}</Card>
        <Card title="Rent vs buy"><Kpi label="Monthly mortgage payment" value={fmt(rb.pmt)} /><Kpi label="Net cost of buying" value={fmt(rb.buyNet)} /><Kpi label="Net cost of renting" value={fmt(rb.rentNet)} />
          <p className="text-sm font-semibold">{rb.buyNet < rb.rentNet ? "Buying costs less over this horizon." : "Renting costs less over this horizon."}</p></Card></>}>
      <Card title="Monte Carlo retirement engine"><div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {f("Current age", m.age, v => setM({ ...m, age: v }))}{f("Retirement age", m.retire, v => setM({ ...m, retire: v }))}{f("Plan to age", m.life, v => setM({ ...m, life: v }))}
        {f("Savings today", m.savings, v => setM({ ...m, savings: v }), true)}{f("Monthly saving", m.monthly, v => setM({ ...m, monthly: v }), true)}{f("Yearly spend in retirement", m.spend, v => setM({ ...m, spend: v }), true)}
        {f("Expected return %", m.ret, v => setM({ ...m, ret: v }))}{f("Volatility %", m.vol, v => setM({ ...m, vol: v }))}{f("Inflation %", m.infl, v => setM({ ...m, infl: v }))}</div></Card>
      <Card title="Rent vs buy inputs"><div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {f("Home price", h.price, v => setH({ ...h, price: v }), true)}{f("Down payment %", h.down, v => setH({ ...h, down: v }))}{f("Mortgage rate %", h.rate, v => setH({ ...h, rate: v }))}{f("Years", h.years, v => setH({ ...h, years: v }))}
        {f("Monthly rent", h.rent, v => setH({ ...h, rent: v }), true)}{f("Rent growth %", h.rentG, v => setH({ ...h, rentG: v }))}{f("Home growth %", h.appr, v => setH({ ...h, appr: v }))}{f("Investment return %", h.inv, v => setH({ ...h, inv: v }))}</div>
        <p className="text-xs text-gray-400">Assumes 1% yearly upkeep for owners, and that renters invest the down payment. Simplified: no transaction fees or taxes.</p></Card>
    </Page>
  );
}

/* ---------- Region: country, display currency, FX, provider info ---------- */
export function Region({ rates, live, country, onCountry, display, onDisplay, say }: { rates: Rates; live: boolean; country: string; onCountry: (c: string) => void; display: string; onDisplay: (c: string) => void; say: (m: string) => void }) {
  const c = COUNTRIES.find(x => x.code === country); const [amt, setAmt] = useState("100"); const [from, setFrom] = useState("USD"); const [to, setTo] = useState("UGX");
  return (
    <Page title="Region and currency" sub="Set your country and how amounts are displayed."
      rail={<><Card title="Rates"><p className="text-sm text-gray-400">{live ? "Live rates from a public feed, refreshed every 6 hours." : "Live feed unavailable. Showing indicative rates only."}</p><p className="text-sm">1 USD = {Math.round(rates.UGX).toLocaleString()} UGX</p></Card>
        <p className="flex items-start gap-2 text-xs text-gray-400"><Info size={14} className="mt-0.5 shrink-0" />Everything you enter is stored in UGX. Changing the display currency only converts what you see.</p></>}>
      <Card title="Country"><label className="block text-sm text-gray-300">Where do you bank and file taxes?<select className={input} value={country} onChange={e => { onCountry(e.target.value); say("Country saved"); }}><option value="">Select a country</option>{COUNTRIES.map(x => <option key={x.code} value={x.code}>{x.name}</option>)}</select></label>
        {c && <div className="space-y-1 text-sm"><p>Local currency: <b>{c.currency}</b> - Tax authority: <b>{c.tax}</b></p></div>}</Card>
      <Card title="Display currency"><select className={input} aria-label="Display currency" value={display} onChange={e => onDisplay(e.target.value)}>{CURRENCIES.map(x => <option key={x}>{x}</option>)}</select></Card>
      <Card title="Currency converter"><div className="grid grid-cols-3 gap-2"><input className={input} aria-label="Amount" inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} />
        <select className={input} aria-label="From" value={from} onChange={e => setFrom(e.target.value)}>{CURRENCIES.map(x => <option key={x}>{x}</option>)}</select><select className={input} aria-label="To" value={to} onChange={e => setTo(e.target.value)}>{CURRENCIES.map(x => <option key={x}>{x}</option>)}</select></div>
        <p className="text-lg font-bold">{fmtIn(convert(num(amt), from, to, rates), to)}</p></Card>
      <Card title="Mobile money and bank connections"><p className="flex items-start gap-2 text-sm text-gray-400"><Link2 size={16} className="mt-0.5 shrink-0" />Common wallets in {c?.name ?? "your country"}: {(c?.wallets ?? ["select a country"]).join(", ")}. Automatic syncing through providers such as M-Pesa, MTN, Airtel, Stitch, Mono or PawaPay needs your own provider accounts and server-side keys. None are connected yet.</p></Card>
    </Page>
  );
}
