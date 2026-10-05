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

// Minimal RFC-4180 style CSV parser (quotes, escaped quotes, CRLF).
function parseCsv(t: string) {
  const rows: string[][] = []; let r: string[] = [], c = "", q = false;
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { r.push(c); c = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; r.push(c); c = ""; if (r.some(x => x !== "")) rows.push(r); r = []; }
    else c += ch; }
  r.push(c); if (r.some(x => x !== "")) rows.push(r); return rows;
}
type Row = { category_id: string | null; label: string | null; amount: number; spent_on: string };

export default function Reports({ onChanged }: { onChanged?: () => void }) {
  const [prev, setPrev] = useState<null | { ok: Row[]; dup: number; errs: string[] }>(null);
  const [note, setNote] = useState("");
  const [bs, setBs] = useState<B[]>([]); const [cs, setCs] = useState<C[]>([]); const [es, setEs] = useState<E[]>([]);
  const [sel, setSel] = useState(""); const [ready, setReady] = useState(false);
  const load = async () => {
    const [b, c] = await Promise.all([supabase.from("budgets").select("id,name,starting_balance").order("created_at", { ascending: false }),
      supabase.from("planned_categories").select("id,budget_id,name,amount")]);
    const all: E[] = []; // page through expenses (API returns max 1000 rows per request)
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from("expenses").select("id,budget_id,category_id,label,amount,spent_on").order("spent_on", { ascending: false }).range(from, from + 999);
      all.push(...(data ?? [])); if ((data?.length ?? 0) < 1000) break;
    }
    setBs(b.data ?? []); setCs(c.data ?? []); setEs(all); setSel(b.data?.[0]?.id ?? ""); setReady(true);
  };
  useEffect(() => { load(); }, []);

  const onFile = async (f?: File) => {
    setNote(""); setPrev(null); if (!f) return;
    if (f.size > 2 * 1024 * 1024) return setNote("File is over 2 MB.");
    const rows = parseCsv((await f.text()).replace(/^\ufeff/, "")); const h = (rows[0] ?? []).map(x => x.trim().toLowerCase());
    const di = h.indexOf("date"), ai = h.indexOf("amount"), ci = h.indexOf("category"), ni = h.findIndex(x => x === "note" || x === "label");
    if (di < 0 || ai < 0) return setNote("The first row must include Date and Amount columns (Category and Note are optional).");
    const seen = new Set(es.filter(e => e.budget_id === sel).map(e => `${e.spent_on}|${Number(e.amount)}|${e.label ?? ""}|${e.category_id ?? ""}`));
    const cats = cs.filter(c => c.budget_id === sel); const ok: Row[] = []; const errs: string[] = []; let dup = 0;
    rows.slice(1).forEach((r, i) => { const line = i + 2; const date = (r[di] ?? "").trim(); const amount = Number((r[ai] ?? "").replace(/,/g, ""));
      const label = (ni >= 0 ? (r[ni] ?? "").replace(/^'(?=[=+\-@])/, "").trim() : "") || null; const cn = ci >= 0 ? (r[ci] ?? "").trim() : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) return void errs.push(`Row ${line}: date must be YYYY-MM-DD`);
      if (!Number.isFinite(amount) || amount <= 0) return void errs.push(`Row ${line}: amount must be a positive number`);
      const cat = !cn || cn.toLowerCase() === "unplanned" ? null : cats.find(c => c.name.toLowerCase() === cn.toLowerCase());
      if (cat === undefined) return void errs.push(`Row ${line}: category "${cn}" not found in this budget`);
      const key = `${date}|${amount}|${label ?? ""}|${cat?.id ?? ""}`; if (seen.has(key)) return void dup++; seen.add(key);
      ok.push({ category_id: cat?.id ?? null, label, amount, spent_on: date }); });
    setPrev({ ok, dup, errs });
  };
  const doImport = async () => {
    if (!prev) return; for (let i = 0; i < prev.ok.length; i += 200) {
      const { error } = await supabase.from("expenses").insert(prev.ok.slice(i, i + 200).map(r => ({ ...r, budget_id: sel })));
      if (error) return setNote(error.message); }
    setNote(`Imported ${prev.ok.length} expenses.`); setPrev(null); await load(); onChanged?.();
  };
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
      <div className="surface space-y-2 rounded-3xl p-4 text-sm"><h3 className="font-semibold">Import CSV into “{bs.find(b => b.id === sel)?.name}”</h3>
        <p className="text-gray-400">Columns: Date (YYYY-MM-DD), Amount, Category, Note. Blank category = unplanned. Duplicates are skipped.</p>
        <input type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={e => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
        {prev && <div className="space-y-1"><p>{prev.ok.length} ready · {prev.dup} duplicates skipped · {prev.errs.length} with errors</p>
          {prev.errs.slice(0, 5).map(x => <p key={x} className="text-red-400">{x}</p>)}{prev.errs.length > 5 && <p className="text-gray-400">…and {prev.errs.length - 5} more</p>}
          {prev.ok.length > 0 && <button className="rounded-xl bg-gold px-4 py-2 font-semibold text-black" onClick={doImport}>Import {prev.ok.length} rows</button>}</div>}
        {note && <p role="status" className="text-yellow-300">{note}</p>}</div>
    </section>
  );
}
