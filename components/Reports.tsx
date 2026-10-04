"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmt } from "@/lib/money";

type B = { id: string; name: string; starting_balance: number };
type C = { id: string; budget_id: string; name: string; amount: number };
type E = { id: string; budget_id: string; category_id: string | null; label: string | null; amount: number; spent_on: string };

// Neutralise spreadsheet formulas (=,+,-,@) and quote cells that need it.
const cell = (v: string | number | null) => {
  let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function Reports() {
  const [bs, setBs] = useState<B[]>([]); const [cs, setCs] = useState<C[]>([]); const [es, setEs] = useState<E[]>([]);
  const [sel, setSel] = useState(""); const [ready, setReady] = useState(false);
  useEffect(() => { (async () => {
    const [b, c] = await Promise.all([supabase.from("budgets").select("id,name,starting_balance").order("created_at", { ascending: false }),
      supabase.from("planned_categories").select("id,budget_id,name,amount")]);
    const all: E[] = []; // page through expenses (API returns max 1000 rows per request)
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from("expenses").select("id,budget_id,category_id,label,amount,spent_on").order("spent_on", { ascending: false }).range(from, from + 999);
      all.push(...(data ?? [])); if ((data?.length ?? 0) < 1000) break;
    }
    setBs(b.data ?? []); setCs(c.data ?? []); setEs(all); setSel(b.data?.[0]?.id ?? ""); setReady(true);
  })(); }, []);

  const sum = (xs: { amount: number }[]) => xs.reduce((t, x) => t + Number(x.amount), 0);
  const exportCsv = () => {
    const name = (e: E) => cs.find(c => c.id === e.category_id)?.name ?? "";
    const rows = [["Budget", "Date", "Category", "Type", "Note", "Amount"], ...es.map(e => [bs.find(b => b.id === e.budget_id)?.name ?? "", e.spent_on, name(e), e.category_id ? "Planned" : "Unplanned", e.label ?? "", e.amount])];
    const blob = new Blob(["\ufeff" + rows.map(r => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `kkingg-reserves-expenses-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  if (!ready) return <p className="text-gray-400">Loading reports…</p>;
  if (bs.length === 0) return null;
  const mine = es.filter(e => e.budget_id === sel), myCats = cs.filter(c => c.budget_id === sel), unpl = sum(mine.filter(e => !e.category_id));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="font-semibold text-yellow-400">Reports</h2>
        <button className="glass rounded-xl px-3 py-2 text-sm" onClick={exportCsv} disabled={es.length === 0}>Export CSV</button></div>
      <div className="space-y-2">{bs.map(b => { const bx = es.filter(e => e.budget_id === b.id), planned = sum(cs.filter(c => c.budget_id === b.id)), spent = sum(bx);
        return <button key={b.id} aria-pressed={sel === b.id} onClick={() => setSel(b.id)} className={`surface w-full rounded-2xl p-3 text-left text-sm ${sel === b.id ? "!border-yellow-400/70" : ""}`}>
          <span className="font-semibold">{b.name}</span><span className="block text-gray-400">Spent {fmt(spent)} of {fmt(planned)} planned · Unplanned {fmt(sum(bx.filter(e => !e.category_id)))} · Left {fmt(b.starting_balance - spent)}</span></button>; })}</div>
      <div className="surface space-y-3 rounded-3xl p-4"><h3 className="text-sm font-semibold">Planned vs actual</h3>
        {myCats.length === 0 && <p className="text-sm text-gray-500">No categories in this budget.</p>}
        {myCats.map(c => { const a = sum(mine.filter(e => e.category_id === c.id)); const max = Math.max(c.amount, a) || 1;
          return <div key={c.id} className="text-sm"><div className="flex justify-between"><span>{c.name}</span><span className={a > c.amount ? "text-red-400" : ""}>{fmt(a)} / {fmt(c.amount)}</span></div>
            <div className="relative h-2 rounded bg-white/10" role="img" aria-label={`${c.name}: spent ${fmt(a)} of ${fmt(c.amount)}`}><div className="absolute h-2 rounded bg-white/25" style={{ width: (c.amount / max) * 100 + "%" }} /><div className={`absolute h-2 rounded ${a > c.amount ? "bg-red-500" : "bg-gold"}`} style={{ width: (a / max) * 100 + "%" }} /></div></div>; })}
        {unpl > 0 && <p className="text-sm text-orange-400">⚠ Unplanned: {fmt(unpl)}</p>}</div>
    </section>
  );
}
