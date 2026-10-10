"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { RefreshCw, ArrowUpRight, ArrowDownRight, Info } from "lucide-react";
import { Sparkline } from "@/components/Charts";
import { Section, input } from "@/components/ui";
import { FALLBACK } from "@/lib/fx";

const MAJORS = ["EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "CNY", "INR", "ZAR", "BRL", "MXN", "SGD", "HKD", "SEK", "NOK", "TRY", "KRW"];
const AFRICA = ["UGX", "KES", "TZS", "RWF", "BIF", "CDF", "SOS", "NGN", "GHS", "EGP", "ETB", "MAD"];
const NAMES: Record<string, string> = { USD: "US Dollar", EUR: "Euro", GBP: "British Pound", JPY: "Japanese Yen", CHF: "Swiss Franc", CAD: "Canadian Dollar", AUD: "Australian Dollar", NZD: "New Zealand Dollar", CNY: "Chinese Yuan", INR: "Indian Rupee", ZAR: "South African Rand", BRL: "Brazilian Real", MXN: "Mexican Peso", SGD: "Singapore Dollar", HKD: "Hong Kong Dollar", SEK: "Swedish Krona", NOK: "Norwegian Krone", TRY: "Turkish Lira", KRW: "South Korean Won", UGX: "Ugandan Shilling", KES: "Kenyan Shilling", TZS: "Tanzanian Shilling", RWF: "Rwandan Franc", BIF: "Burundian Franc", CDF: "Congolese Franc", SOS: "Somali Shilling", NGN: "Nigerian Naira", GHS: "Ghanaian Cedi", EGP: "Egyptian Pound", ETB: "Ethiopian Birr", MAD: "Moroccan Dirham" };
type Data = { latest: Record<string, number>; dates: string[]; series: Record<string, number[]>; live: boolean; histOk: boolean; asOf: string };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const nice = (r: number) => (r >= 1000 ? r.toLocaleString("en-US", { maximumFractionDigits: 2 }) : r >= 100 ? r.toFixed(2) : r >= 1 ? r.toFixed(4) : r.toFixed(6));

async function load(): Promise<Data> {
  let latest: Record<string, number> = { ...FALLBACK }, live = false, asOf = "indicative";
  try { const j = await (await fetch("https://open.er-api.com/v6/latest/USD")).json(); if (j?.rates?.UGX) { latest = j.rates; live = true; asOf = String(j.time_last_update_utc ?? "").slice(0, 16) || iso(new Date()); } } catch { /* fall back */ }
  let dates: string[] = [], series: Record<string, number[]> = {}, histOk = false;
  try {
    const j = await (await fetch(`https://api.frankfurter.dev/v1/${iso(new Date(Date.now() - 31 * 864e5))}..${iso(new Date())}?base=USD&symbols=${MAJORS.join(",")}`)).json();
    if (j?.rates) { dates = Object.keys(j.rates).sort(); MAJORS.forEach(c => (series[c] = dates.map(d => j.rates[d][c]))); series.USD = dates.map(() => 1); histOk = dates.length > 1;
      if (!live && dates.length) { latest = { USD: 1, ...j.rates[dates[dates.length - 1]] }; live = true; asOf = dates[dates.length - 1]; } }
  } catch { /* history optional */ }
  return { latest, dates, series, live, histOk, asOf };
}

export default function Forex() {
  const [d, setD] = useState<Data | null>(null); const [busy, setBusy] = useState(false);
  const [base, setBase] = useState("USD"); const [q, setQ] = useState(""); const [sort, setSort] = useState<"name" | "change">("name");
  const [amt, setAmt] = useState("100"); const [from, setFrom] = useState("USD"); const [to, setTo] = useState("UGX");
  const refresh = useCallback(async (force = false) => {
    setBusy(true);
    try { const c = force ? null : JSON.parse(localStorage.getItem("kk2-forex") || "null"); if (c && Date.now() - c.ts < 3600e3) { setD(c.d); setBusy(false); return; } } catch { /* ignore */ }
    const fresh = await load(); setD(fresh); try { localStorage.setItem("kk2-forex", JSON.stringify({ ts: Date.now(), d: fresh })); } catch { /* ignore */ } setBusy(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const rows = useMemo(() => {
    if (!d) return [];
    const L = d.latest, bases = ["USD", ...MAJORS];
    return bases.filter(c => c !== base && L[c] && L[base]).map(c => {
      const rate = L[c] / L[base]; let vals: number[] = [], change: number | null = null;
      if (d.histOk && d.series[c] && d.series[base]) { vals = d.series[c].map((v, i) => v / d.series[base][i]); change = vals[vals.length - 1] / vals[0] - 1; }
      return { c, rate, vals, change };
    });
  }, [d, base]);
  const shown = rows.filter(r => !q || (r.c + NAMES[r.c]).toLowerCase().includes(q.toLowerCase())).sort((a, z) => sort === "change" ? (z.change ?? -9) - (a.change ?? -9) : a.c.localeCompare(z.c));
  const withChange = rows.filter(r => r.change !== null), best = [...withChange].sort((a, z) => (z.change as number) - (a.change as number))[0], worst = [...withChange].sort((a, z) => (a.change as number) - (z.change as number))[0];
  const L = d?.latest ?? FALLBACK, conv = L[from] && L[to] ? ((Number(amt.replace(/,/g, "")) || 0) / L[from]) * L[to] : 0;
  const all = Object.keys(NAMES);

  return (
    <Section title="Markets" sub="Reference rates for the top currencies, with a 30-day trend." action={<button className="glass inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm" onClick={() => refresh(true)} disabled={busy}><RefreshCw size={14} className={busy ? "animate-spin" : ""} />Refresh</button>}>
      {!d ? <p className="text-gray-400">Loading rates...</p> : <>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="surface rounded-3xl p-4"><p className="text-sm text-gray-400">Base currency</p><select className={input + " mt-1"} aria-label="Base currency" value={base} onChange={e => setBase(e.target.value)}>{["USD", ...MAJORS, ...AFRICA].map(c => <option key={c} value={c}>{c} - {NAMES[c]}</option>)}</select></div>
          <div className="surface rounded-3xl p-4"><p className="text-sm text-gray-400">Strongest vs {base} (30 days)</p>{best ? <p className="mt-1 text-xl font-bold">{best.c} <span className="text-base font-medium text-green-400">+{((best.change as number) * 100).toFixed(2)}%</span></p> : <p className="mt-1 text-sm text-gray-400">Trend data unavailable.</p>}</div>
          <div className="surface rounded-3xl p-4"><p className="text-sm text-gray-400">Weakest vs {base} (30 days)</p>{worst ? <p className="mt-1 text-xl font-bold">{worst.c} <span className="text-base font-medium text-red-400">{((worst.change as number) * 100).toFixed(2)}%</span></p> : <p className="mt-1 text-sm text-gray-400">Trend data unavailable.</p>}</div>
        </div>
        <div className="grid gap-4 md:grid-cols-3"><div className="space-y-4 md:col-span-2">
          <div className="surface space-y-3 rounded-3xl p-4"><div className="flex flex-wrap items-center gap-2"><h3 className="mr-auto font-semibold">Major currencies</h3>
            <input className={input + " !w-40"} type="search" aria-label="Search currencies" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} />
            <select className={input + " !w-auto"} aria-label="Sort" value={sort} onChange={e => setSort(e.target.value as "name" | "change")}><option value="name">Sort: name</option><option value="change">Sort: 30-day change</option></select></div>
            <div className="divide-y divide-white/10">{shown.map(r => <div key={r.c} className="flex items-center gap-3 py-2.5 text-sm">
              <div className="w-28 min-w-0"><p className="font-semibold">{r.c}</p><p className="truncate text-xs text-gray-400">{NAMES[r.c]}</p></div>
              <div className="flex-1 text-right"><p className="font-semibold tabular-nums">{nice(r.rate)}</p><p className="text-xs text-gray-400">per 1 {base}</p></div>
              <div className="hidden w-24 sm:block">{r.vals.length > 1 && <Sparkline values={r.vals} color={(r.change ?? 0) >= 0 ? "#10B981" : "#E11D48"} />}</div>
              <div className={`flex w-20 items-center justify-end gap-1 font-medium ${r.change === null ? "text-gray-400" : r.change >= 0 ? "text-green-400" : "text-red-400"}`}>{r.change === null ? "-" : <>{r.change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(r.change * 100).toFixed(2)}%</>}</div></div>)}
              {shown.length === 0 && <p className="py-3 text-sm text-gray-400">No currencies match.</p>}</div></div>
          <div className="surface space-y-2 rounded-3xl p-4"><h3 className="font-semibold">African currencies</h3><div className="grid gap-x-6 sm:grid-cols-2">{AFRICA.filter(c => c !== base && L[c] && L[base]).map(c => <div key={c} className="flex items-center justify-between border-b border-white/10 py-2 text-sm"><span><b>{c}</b> <span className="text-xs text-gray-400">{NAMES[c]}</span></span><span className="font-semibold tabular-nums">{nice(L[c] / L[base])}</span></div>)}</div></div>
        </div>
        <aside className="space-y-4">
          <div className="surface space-y-2 rounded-3xl p-4"><h3 className="font-semibold">Converter</h3><input className={input} aria-label="Amount" inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} />
            <div className="grid grid-cols-2 gap-2"><select className={input} aria-label="From" value={from} onChange={e => setFrom(e.target.value)}>{all.map(c => <option key={c}>{c}</option>)}</select><select className={input} aria-label="To" value={to} onChange={e => setTo(e.target.value)}>{all.map(c => <option key={c}>{c}</option>)}</select></div>
            <p className="text-2xl font-bold tracking-tight">{nice(conv)} <span className="text-base font-medium text-gray-400">{to}</span></p></div>
          <div className="surface space-y-1 rounded-3xl p-4 text-sm"><h3 className="flex items-center gap-2 font-semibold"><Info size={16} />About these rates</h3>
            <p className="text-gray-400">{d.live ? `Updated ${d.asOf}.` : "Live feed unavailable, showing indicative rates."} {d.histOk ? "30-day trends use daily reference rates." : "Trend data is unavailable right now."}</p>
            <p className="text-gray-400">These are mid-market reference rates for information. They are not tradable quotes and exclude fees and spreads.</p></div>
        </aside></div></>}
    </Section>
  );
}
