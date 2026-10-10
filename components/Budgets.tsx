"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, X, FileDown, Copy, Archive, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fmt, groupDigits, parseMoney } from "@/lib/money";
import { statusOf } from "@/lib/budget";
import { AreaChart, Donut, PALETTE, UNPLANNED } from "@/components/Charts";
import { GoldButton, input, Section, SayFn } from "@/components/ui";

type Budget = { id: string; name: string; starting_balance: number; archived: boolean; kind: string; description: string | null; organisation: string | null; contingency_pct: number; start_date: string | null; end_date: string | null; created_at: string };
type Cat = { id: string; name: string; amount: number; cost_type: string };
type Exp = { id: string; category_id: string | null; label: string | null; amount: number; spent_on: string; created_at?: string };
type Inc = { id: string; name: string; amount: number };
const KINDS: [string, string][] = [["personal", "Personal"], ["household", "Household"], ["business", "Business"], ["project", "Project"], ["event", "Event"]];
const TYPES: [string, string][] = [["fixed", "Fixed cost"], ["variable", "Variable cost"], ["capital", "Capital item"]];
const money = (n: number) => fmt(n);
const num = (s: string) => { const n = Number(s.replace(/[,\s]/g, "")); return Number.isFinite(n) && n >= 0 ? n : null; };
const today = () => new Date().toISOString().slice(0, 10);
const lastDays = (n: number) => Array.from({ length: n }, (_, i) => new Date(Date.now() - (n - 1 - i) * 864e5).toISOString().slice(0, 10));
const dayLabel = (d: string) => d === today() ? "Today" : d === new Date(Date.now() - 864e5).toISOString().slice(0, 10) ? "Yesterday" : new Date(d + "T00:00:00").toLocaleDateString("en-UG", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const NB = { name: "", kind: "personal", org: "", bal: "", cont: "0", start: "", end: "" };

export default function Budgets({ say }: { say: SayFn }) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [bid, setBid] = useState("");
  const [cats, setCats] = useState<Cat[]>([]); const [exps, setExps] = useState<Exp[]>([]); const [incs, setIncs] = useState<Inc[]>([]);
  const [nb, setNb] = useState(NB); const [nc, setNc] = useState({ name: "", amt: "", type: "variable" }); const [ni, setNi] = useState({ name: "", amt: "" });
  const [q, setQ] = useState(""); const [fcat, setFcat] = useState(""); const [limit, setLimit] = useState(20); const [rng, setRng] = useState(14);
  const blank = { id: "", cat: "", label: "", amt: "", date: today() };
  const [sheet, setSheet] = useState(false); const [f, setF] = useState(blank);
  const [ec, setEc] = useState<null | { id: string; name: string; amt: string; type: string }>(null);
  const [eb, setEb] = useState<null | { name: string; kind: string; org: string; desc: string; cont: string; start: string; end: string }>(null);
  const [ask, setAsk] = useState<null | { table: string; id: string }>(null);

  const loadBudgets = useCallback(async () => {
    const { data } = await supabase.from("budgets").select("*").order("created_at", { ascending: false });
    const list = ((data ?? []) as Budget[]).sort((a, c) => Number(a.archived) - Number(c.archived)); setBudgets(list);
    setBid(cur => (cur && list.some(x => x.id === cur)) ? cur : (list.find(x => x.id === localStorage.getItem("kk2-budget"))?.id ?? list[0]?.id ?? ""));
  }, []);
  const loadDetail = useCallback(async () => {
    if (!bid) { setCats([]); setExps([]); setIncs([]); return; }
    const [c, e, i] = await Promise.all([
      supabase.from("planned_categories").select("id,name,amount,cost_type").eq("budget_id", bid),
      supabase.from("expenses").select("id,category_id,label,amount,spent_on,created_at").eq("budget_id", bid).order("created_at", { ascending: false }),
      supabase.from("budget_income").select("id,name,amount").eq("budget_id", bid).order("created_at")]);
    setCats((c.data ?? []) as Cat[]); setExps((e.data ?? []) as Exp[]); setIncs((i.data ?? []) as Inc[]);
  }, [bid]);
  useEffect(() => { loadBudgets(); }, [loadBudgets]);
  useEffect(() => { loadDetail(); if (bid) localStorage.setItem("kk2-budget", bid); }, [loadDetail, bid]);
  useEffect(() => {
    const k = (ev: KeyboardEvent) => { if (ev.key.toLowerCase() === "n" && !ev.metaKey && !ev.ctrlKey && !/INPUT|TEXTAREA|SELECT/.test((ev.target as HTMLElement).tagName) && bid) { ev.preventDefault(); setF({ ...blank, date: today() }); setSheet(true); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  const b = budgets.find(x => x.id === bid);
  const kindLabel = KINDS.find(k => k[0] === b?.kind)?.[1] ?? "Personal";
  const start = Number(b?.starting_balance ?? 0), income = incs.reduce((t, x) => t + Number(x.amount), 0), available = start + income;
  const planned = cats.reduce((t, c) => t + Number(c.amount), 0), cont = (planned * Number(b?.contingency_pct ?? 0)) / 100, committed = planned + cont;
  const spent = exps.reduce((t, e) => t + Number(e.amount), 0), unplanned = exps.filter(e => !e.category_id).reduce((t, e) => t + Number(e.amount), 0);
  const remaining = available - spent, surplus = available - committed, status = statusOf(committed, available, spent);
  const color = { "On Track": "text-green-400", "At Risk": "text-yellow-400", "Over Budget": "text-red-400" }[status];
  const catSpent = (id: string) => exps.filter(e => e.category_id === id).reduce((t, e) => t + Number(e.amount), 0);
  const typeSum = (t: string) => cats.filter(c => c.cost_type === t).reduce((s, c) => s + Number(c.amount), 0);
  const structure = [{ label: "Fixed costs", value: typeSum("fixed"), color: PALETTE[0] }, { label: "Variable costs", value: typeSum("variable"), color: PALETTE[1] }, { label: "Capital items", value: typeSum("capital"), color: PALETTE[2] }, { label: "Contingency", value: cont, color: PALETTE[3] }].filter(x => x.value > 0);
  const slices = [...cats.map((c, i) => ({ label: c.name, value: catSpent(c.id), color: PALETTE[i % PALETTE.length] })), { label: "Unplanned", value: unplanned, color: UNPLANNED }].filter(x => x.value > 0);
  const spend = (k: string) => exps.filter(e => e.spent_on === k).reduce((t, e) => t + Number(e.amount), 0);
  const chart = lastDays(rng).map(k => ({ label: new Date(k + "T00:00:00").toLocaleDateString("en-UG", { day: "numeric", month: "short" }), value: spend(k) }));
  const endD = b?.end_date ? new Date(b.end_date + "T23:59:59") : (() => { const d = new Date(b?.created_at ?? Date.now()); return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59); })();
  const startD = b?.start_date ? new Date(b.start_date + "T00:00:00") : (() => { const d = new Date(b?.created_at ?? Date.now()); return new Date(d.getFullYear(), d.getMonth(), 1); })();
  const periodDays = Math.max(1, Math.ceil((endD.getTime() - startD.getTime()) / 864e5)), elapsed = Math.min(periodDays, Math.max(1, Math.ceil((Date.now() - startD.getTime()) / 864e5)));
  const daysLeft = Math.ceil((endD.getTime() - Date.now()) / 864e5), safe = daysLeft >= 1 ? Math.max(0, remaining) / daysLeft : null;
  const burn = spent / elapsed, target = committed / periodDays, expected = committed * (elapsed / periodDays);
  const tips: string[] = [];
  if (spent > 0 && unplanned / spent > 0.2) tips.push(`Unplanned items are ${Math.round((unplanned / spent) * 100)}% of spending.`);
  cats.forEach(c => { const u = catSpent(c.id); if (c.amount > 0 && u / c.amount >= 0.9) tips.push(`${c.name} is ${Math.round((u / c.amount) * 100)}% used.`); });
  if (income > 0 && committed > income) tips.push("Planned costs exceed the funding recorded for this budget.");
  if (!tips.length) tips.push(status === "On Track" ? "Spending is on track." : status === "At Risk" ? "Most of the plan has been used." : "Spending is over the available funds.");

  const req = async (p: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await p; if (error) { say(error.message); return false; } return true; };
  const createBudget = async () => {
    const bal = num(nb.bal), c = num(nb.cont);
    if (!nb.name.trim() || bal === null || c === null || c > 100) return say("Enter a name, an opening balance (0 is fine) and a contingency between 0 and 100.");
    if (nb.start && nb.end && nb.end < nb.start) return say("The end date must be after the start date.");
    const { data, error } = await supabase.from("budgets").insert({ name: nb.name.trim(), kind: nb.kind, organisation: nb.org.trim() || null, starting_balance: bal, contingency_pct: c, start_date: nb.start || null, end_date: nb.end || null }).select("id").single();
    if (error || !data) return say(error?.message ?? "Could not create the budget.");
    setNb(NB); setBid(data.id); await loadBudgets(); say("Budget created");
  };
  const saveBudget = async () => {
    if (!eb || !b) return; const c = num(eb.cont);
    if (!eb.name.trim() || c === null || c > 100) return say("Enter a name and a contingency between 0 and 100.");
    if (await req(supabase.from("budgets").update({ name: eb.name.trim(), kind: eb.kind, organisation: eb.org.trim() || null, description: eb.desc.trim() || null, contingency_pct: c, start_date: eb.start || null, end_date: eb.end || null }).eq("id", b.id))) { setEb(null); loadBudgets(); }
  };
  const archive = async () => { if (b && await req(supabase.from("budgets").update({ archived: !b.archived }).eq("id", b.id))) { say(b.archived ? "Budget restored" : "Budget archived"); loadBudgets(); } };
  const duplicate = async () => {
    if (!b) return; const { data, error } = await supabase.from("budgets").insert({ name: b.name + " (copy)", kind: b.kind, organisation: b.organisation, description: b.description, starting_balance: b.starting_balance, contingency_pct: b.contingency_pct, start_date: b.start_date, end_date: b.end_date }).select("id").single();
    if (error || !data) return say(error?.message ?? "Could not duplicate.");
    if (cats.length) await supabase.from("planned_categories").insert(cats.map(c => ({ budget_id: data.id, name: c.name, amount: c.amount, cost_type: c.cost_type })));
    if (incs.length) await supabase.from("budget_income").insert(incs.map(i => ({ budget_id: data.id, name: i.name, amount: i.amount })));
    say("Budget duplicated"); setBid(data.id); loadBudgets();
  };
  const addCat = async () => { const v = parseMoney(nc.amt); if (!nc.name.trim() || v === null) return say("Enter a name and a valid amount."); if (await req(supabase.from("planned_categories").insert({ budget_id: bid, name: nc.name.trim(), amount: v, cost_type: nc.type }))) { setNc({ ...nc, name: "", amt: "" }); loadDetail(); } };
  const addInc = async () => { const v = num(ni.amt); if (!ni.name.trim() || v === null) return say("Enter a name and a valid amount."); if (await req(supabase.from("budget_income").insert({ budget_id: bid, name: ni.name.trim(), amount: v }))) { setNi({ name: "", amt: "" }); loadDetail(); } };
  const saveCat = async () => { if (!ec) return; const v = parseMoney(ec.amt); if (!ec.name.trim() || v === null) return say("Enter a name and a valid amount."); if (await req(supabase.from("planned_categories").update({ name: ec.name.trim(), amount: v, cost_type: ec.type }).eq("id", ec.id))) { setEc(null); loadDetail(); } };
  const saveExp = async (another: boolean) => {
    const v = parseMoney(f.amt); if (v === null) return say("Enter a valid amount.");
    const row = { category_id: f.cat || null, label: f.label.trim() || null, amount: v, spent_on: f.date || today() };
    const ok = f.id ? await req(supabase.from("expenses").update({ ...row, updated_at: new Date().toISOString() }).eq("id", f.id)) : await req(supabase.from("expenses").insert({ ...row, budget_id: bid }));
    if (!ok) return; await loadDetail(); if (another && !f.id) setF({ ...f, amt: "", label: "" }); else setSheet(false);
  };
  const pick = (e: Exp) => ({ id: e.id, budget_id: bid, category_id: e.category_id, label: e.label, amount: e.amount, spent_on: e.spent_on, created_at: e.created_at });
  const doDel = async () => {
    if (!ask) return; let restore: () => Promise<unknown> = async () => {};
    if (ask.table === "expenses") { const row = exps.find(e => e.id === ask.id); await supabase.from("expenses").delete().eq("id", ask.id); restore = async () => { if (row) await supabase.from("expenses").insert(pick(row)); }; }
    else if (ask.table === "budget_income") { const row = incs.find(i => i.id === ask.id); await supabase.from("budget_income").delete().eq("id", ask.id); restore = async () => { if (row) await supabase.from("budget_income").insert({ id: row.id, budget_id: bid, name: row.name, amount: row.amount }); }; }
    else { const cat = cats.find(c => c.id === ask.id), kids = exps.filter(e => e.category_id === ask.id); await supabase.from("planned_categories").delete().eq("id", ask.id);
      restore = async () => { if (cat) { await supabase.from("planned_categories").insert({ id: cat.id, budget_id: bid, name: cat.name, amount: cat.amount, cost_type: cat.cost_type }); if (kids.length) await supabase.from("expenses").insert(kids.map(pick)); } }; }
    setAsk(null); await loadDetail(); say("Deleted", async () => { await restore(); await loadDetail(); });
  };
  const exportPdf = async () => {
    if (!b) return; say("Preparing PDF...");
    const { buildBudgetPdf } = await import("@/lib/pdf/reports");
    const fmtD = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" });
    const doc = buildBudgetPdf({ title: b.name, kind: kindLabel, org: b.organisation, description: b.description, generated: new Date().toLocaleDateString("en-UG", { day: "numeric", month: "long", year: "numeric" }),
      period: b.start_date || b.end_date ? `${b.start_date ? fmtD(b.start_date) : "Start"} to ${b.end_date ? fmtD(b.end_date) : "open"}` : `Created ${fmtD(b.created_at.slice(0, 10))}`,
      opening: start, incomes: incs.map(i => ({ name: i.name, amount: Number(i.amount) })), costs: cats.map(c => ({ name: c.name, type: c.cost_type, planned: Number(c.amount), actual: catSpent(c.id) })), contingencyPct: Number(b.contingency_pct), unplanned });
    doc.save(`${b.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "budget"}-budget.pdf`); say("PDF saved");
  };

  const newBudgetCard = (
    <section className="glass space-y-2 rounded-3xl p-4"><h3 className="font-semibold text-yellow-400">New budget</h3>
      <input className={input} aria-label="Budget name" placeholder="Name (e.g. Cafe launch, October)" value={nb.name} onChange={e => setNb({ ...nb, name: e.target.value })} />
      <select className={input} aria-label="Budget type" value={nb.kind} onChange={e => setNb({ ...nb, kind: e.target.value })}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      {nb.kind !== "personal" && nb.kind !== "household" && <input className={input} aria-label="Organisation" placeholder="Organisation or client (optional)" value={nb.org} onChange={e => setNb({ ...nb, org: e.target.value })} />}
      <div className="grid grid-cols-2 gap-2"><input className={input} aria-label="Opening balance" inputMode="numeric" placeholder="Opening balance" value={nb.bal} onChange={e => setNb({ ...nb, bal: groupDigits(e.target.value) })} /><input className={input} aria-label="Contingency percent" inputMode="decimal" placeholder="Contingency %" value={nb.cont} onChange={e => setNb({ ...nb, cont: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-2"><label className="text-xs text-gray-400">Start<input className={input} type="date" value={nb.start} onChange={e => setNb({ ...nb, start: e.target.value })} /></label><label className="text-xs text-gray-400">End<input className={input} type="date" value={nb.end} onChange={e => setNb({ ...nb, end: e.target.value })} /></label></div>
      <GoldButton onClick={createBudget}>Create budget</GoldButton></section>
  );

  return (
    <Section title="Budgets" sub="Plan personal, household, business, project and event budgets, then export a presentation-ready PDF."
      action={b && <button className="inline-flex items-center gap-2 rounded-2xl bg-gold px-4 py-2 text-sm font-semibold text-black" onClick={exportPdf}><FileDown size={16} />Export PDF</button>}>
      {budgets.length > 0 && <div className="flex flex-wrap items-center gap-2">
        <select className={input + " !w-auto min-w-[14rem] flex-1"} aria-label="Budget" value={bid} onChange={e => setBid(e.target.value)}>{budgets.map(x => <option key={x.id} value={x.id}>{x.name} ({KINDS.find(k => k[0] === x.kind)?.[1]}){x.archived ? " - archived" : ""}</option>)}</select>
        {b && <><button className="glass inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm" onClick={() => setEb({ name: b.name, kind: b.kind, org: b.organisation ?? "", desc: b.description ?? "", cont: String(b.contingency_pct), start: b.start_date ?? "", end: b.end_date ?? "" })}><Pencil size={14} />Details</button>
          <button className="glass inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm" onClick={duplicate}><Copy size={14} />Duplicate</button>
          <button className="glass inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm" onClick={archive}><Archive size={14} />{b.archived ? "Restore" : "Archive"}</button></>}</div>}

      {b ? <>
        <section aria-label="Key figures" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {([["Available funds", money(available), "Opening balance plus funding"], ["Committed costs", money(committed), `Plan ${money(planned)} + contingency`], [surplus >= 0 ? "Projected surplus" : "Projected deficit", money(surplus), kindLabel + " budget"], ["Remaining cash", money(remaining), `Spent ${money(spent)}`]] as [string, string, string][]).map(([l, v, s], i) =>
            <div key={l} className="surface rounded-3xl p-4"><p className="text-sm text-gray-400">{l}</p><p className={`mt-1 truncate text-xl font-bold tracking-tight ${i === 2 ? (surplus >= 0 ? "text-green-400" : "text-red-400") : ""}`}>{v}</p><p className="truncate text-xs text-gray-400">{s}</p></div>)}
        </section>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-4 md:col-span-2">
            <div className="surface rounded-3xl p-4"><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Spending overview</h3>
              <select className="glass rounded-xl px-3 py-1.5 text-sm" aria-label="Chart range" value={rng} onChange={e => setRng(Number(e.target.value))}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option></select></div><AreaChart data={chart} /></div>

            <section className="surface space-y-3 rounded-3xl p-4"><h3 className="font-semibold">Cost plan</h3>
              {cats.length === 0 && <p className="text-sm text-gray-400">No cost categories yet. Add the first one below.</p>}
              {cats.map(c => { const s = catSpent(c.id), pct = Math.min(100, (s / c.amount) * 100 || 0);
                return <div key={c.id}><div className="flex justify-between gap-2 text-sm"><span className="min-w-0 truncate">{c.name} <span className="text-xs text-gray-400">{TYPES.find(t => t[0] === c.cost_type)?.[1]}</span></span><span className={s > c.amount ? "text-red-400" : ""}>{money(s)} / {money(c.amount)}</span></div>
                  <div className="h-2 rounded bg-white/10"><motion.div className={`h-2 rounded ${s > c.amount ? "bg-red-500" : pct > 80 ? "bg-yellow-300" : "bg-gold"}`} animate={{ width: pct + "%" }} /></div>
                  <button className="py-2 pr-4 text-xs text-gray-400" onClick={() => setEc({ id: c.id, name: c.name, amt: groupDigits(String(c.amount)), type: c.cost_type })}>edit</button><button className="py-2 text-xs text-gray-400" onClick={() => setAsk({ table: "planned_categories", id: c.id })}>delete</button></div>; })}
              <div className="grid gap-2 sm:grid-cols-3"><input className={input} aria-label="Category name" placeholder="Category" value={nc.name} onChange={e => setNc({ ...nc, name: e.target.value })} /><input className={input} aria-label="Category amount" inputMode="numeric" placeholder="Amount" value={nc.amt} onChange={e => setNc({ ...nc, amt: groupDigits(e.target.value) })} />
                <select className={input} aria-label="Cost type" value={nc.type} onChange={e => setNc({ ...nc, type: e.target.value })}>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
              <GoldButton onClick={addCat}>Add category</GoldButton></section>

            <section className="surface space-y-3 rounded-3xl p-4"><h3 className="font-semibold">Funding and income</h3>
              {incs.length === 0 && <p className="text-sm text-gray-400">Add revenue, grants, investor funds or other income this budget relies on.</p>}
              {incs.map(i => <div key={i.id} className="flex items-center justify-between gap-2 rounded-2xl bg-white/5 p-3 text-sm"><span className="min-w-0 truncate">{i.name}</span><span className="flex items-center gap-1 font-semibold">{money(Number(i.amount))}<button aria-label={`Delete ${i.name}`} className="p-1 text-gray-400" onClick={() => setAsk({ table: "budget_income", id: i.id })}><X size={14} /></button></span></div>)}
              <div className="grid gap-2 sm:grid-cols-2"><input className={input} aria-label="Funding source" placeholder="Source (e.g. Investor, Sales)" value={ni.name} onChange={e => setNi({ ...ni, name: e.target.value })} /><input className={input} aria-label="Funding amount" inputMode="numeric" placeholder="Amount" value={ni.amt} onChange={e => setNi({ ...ni, amt: groupDigits(e.target.value) })} /></div>
              <GoldButton onClick={addInc}>Add funding</GoldButton></section>

            <section className="space-y-2"><h3 id="history" className="font-semibold text-yellow-400">Transactions</h3>
              <div className="flex gap-2"><input className={input} type="search" aria-label="Search expenses" placeholder="Search" value={q} onChange={e => { setQ(e.target.value); setLimit(20); }} />
                <select className={input} aria-label="Filter expenses" value={fcat} onChange={e => { setFcat(e.target.value); setLimit(20); }}><option value="">All</option><option value="__u">Unplanned only</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              {(() => {
                const term = q.trim().toLowerCase();
                const hit = exps.filter(e => (fcat === "" || (fcat === "__u" ? !e.category_id : e.category_id === fcat)) && (!term || `${e.label ?? ""} ${cats.find(c => c.id === e.category_id)?.name ?? "unplanned"} ${e.amount}`.toLowerCase().includes(term))).sort((a, c) => c.spent_on.localeCompare(a.spent_on));
                const groups: [string, Exp[]][] = []; hit.slice(0, limit).forEach(e => { const g = groups.find(x => x[0] === e.spent_on); g ? g[1].push(e) : groups.push([e.spent_on, [e]]); });
                return <>{hit.length === 0 && <p className="text-sm text-gray-400">{exps.length ? "No matches." : "No transactions yet. Use the + button to add one."}</p>}
                  {groups.map(([d, rows]) => <div key={d} className="space-y-1"><p className="pt-2 text-xs uppercase tracking-wide text-gray-400">{dayLabel(d)} · {money(rows.reduce((t, e) => t + Number(e.amount), 0))}</p>
                    {rows.map(e => <div key={e.id} className={`flex justify-between rounded-lg p-2 text-sm ${e.category_id ? "bg-white/5" : "border border-orange-400/50 bg-orange-400/10"}`}>
                      <button className="min-w-0 truncate py-1 text-left" aria-label="Edit expense" onClick={() => { setF({ id: e.id, cat: e.category_id ?? "", label: e.label ?? "", amt: groupDigits(String(e.amount)), date: e.spent_on }); setSheet(true); }}>{e.category_id ? cats.find(c => c.id === e.category_id)?.name : <><AlertTriangle size={14} className="mr-1 inline" />Unplanned</>} {e.label}</button>
                      <span>{money(Number(e.amount))} <button aria-label="Delete expense" className="p-1" onClick={() => setAsk({ table: "expenses", id: e.id })}><X size={16} /></button></span></div>)}</div>)}
                  {hit.length > limit && <button className="glass w-full rounded-2xl p-3" onClick={() => setLimit(limit + 20)}>Show more</button>}</>; })()}
            </section>
          </div>
          <aside className="space-y-4" aria-label="Summary">
            <div className="surface space-y-2 rounded-3xl p-4 text-sm"><h3 className="text-base font-semibold">Budget health</h3>
              <p className={`flex items-center gap-2 font-semibold ${color}`}><span className="inline-block h-2 w-2 rounded-full bg-current" />{status}</p>
              <div className="h-2 rounded bg-white/10"><div className={`h-2 rounded ${spent > available ? "bg-red-500" : "bg-gold"}`} style={{ width: Math.min(100, available > 0 ? (spent / available) * 100 : 0) + "%" }} /></div>
              <p className="text-gray-400">{available > 0 ? Math.round((spent / available) * 100) : 0}% of available funds used</p>
              {income > 0 && <p>Cost margin: <b>{Math.round(((income - committed) / income) * 100)}%</b></p>}
              <p>Burn rate: <b>{money(burn)}</b>/day vs target <b>{money(target)}</b>/day</p>
              <p className={spent > expected ? "text-red-400" : "text-green-400"}>{spent > expected ? `${money(spent - expected)} ahead of pace.` : `${money(expected - spent)} under pace.`}</p>
              {safe !== null && <p>Safe to spend today: <b>{money(safe)}</b></p>}
              {tips.map(t => <p key={t} className="text-gray-300">• {t}</p>)}</div>
            <div className="surface rounded-3xl p-4"><h3 className="mb-2 font-semibold">Cost structure</h3><Donut slices={structure} total={committed} />
              <ul className="mt-3 space-y-1.5 text-sm">{structure.length === 0 && <li className="text-gray-400">Add categories to see the structure.</li>}{structure.map(x => <li key={x.label} className="flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: x.color }} /><span className="flex-1">{x.label}</span><span className="text-gray-400">{Math.round((x.value / committed) * 100)}%</span></li>)}</ul></div>
            <div className="surface rounded-3xl p-4"><h3 className="mb-2 font-semibold">Spending by category</h3><Donut slices={slices} total={spent} />
              <ul className="mt-3 space-y-1.5 text-sm">{slices.length === 0 && <li className="text-gray-400">No spending yet.</li>}{slices.map(x => <li key={x.label} className="flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: x.color }} /><span className="flex-1 truncate">{x.label}</span><span className="font-medium">{money(x.value)}</span></li>)}</ul></div>
            {(b.kind === "personal" || b.kind === "household") && <div className="surface space-y-1 rounded-3xl p-4 text-sm"><h3 className="font-semibold">Frameworks</h3><p>Zero-based: unassigned <b>{money(available - planned)}</b></p><p className="text-gray-400">50/30/20 of {money(available)}: needs {money(available * 0.5)}, wants {money(available * 0.3)}, savings {money(available * 0.2)}.</p></div>}
            {newBudgetCard}
          </aside>
        </div>
      </> : <div className="grid gap-4 md:grid-cols-3"><div className="surface rounded-3xl p-5 text-sm text-gray-400 md:col-span-2">No budgets yet. Create one to plan costs, funding and track spending. Business, project and event budgets support funding lines and contingency.</div><div>{newBudgetCard}</div></div>}

      {b && <button aria-label="Add expense (N)" className="fixed bottom-24 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-3xl font-light text-black shadow-[0_8px_30px_rgb(255_215_0/.4)] md:bottom-8 md:right-8" onClick={() => { setF({ ...blank, date: today() }); setSheet(true); }}>+</button>}

      {ask && <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Confirm delete" onKeyDown={e => e.key === "Escape" && setAsk(null)}>
        <div className="glass-strong w-full max-w-sm space-y-3 rounded-3xl p-5"><p className="font-semibold">Delete this?</p><p className="text-sm text-gray-400">{ask.table === "planned_categories" ? "This also deletes its logged expenses. You can undo for a few seconds." : "You can undo for a few seconds."}</p>
          <div className="flex gap-2"><button autoFocus className="glass flex-1 rounded-2xl p-3" onClick={() => setAsk(null)}>Cancel</button><button className="flex-1 rounded-2xl bg-red-500 p-3 font-semibold text-white" onClick={doDel}>Delete</button></div></div></div>}

      {sheet && (() => { const c = cats.find(x => x.id === f.cat), v = parseMoney(f.amt) ?? 0, used = c ? exps.filter(e => e.category_id === c.id && e.id !== f.id).reduce((t, e) => t + Number(e.amount), 0) : 0, left = c ? c.amount - used - v : 0;
        const recent = [...cats].sort((a, z) => { const i = exps.findIndex(e => e.category_id === a.id), j = exps.findIndex(e => e.category_id === z.id); return (i < 0 ? 1e9 : i) - (j < 0 ? 1e9 : j); });
        return <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-3" role="dialog" aria-modal="true" aria-label={f.id ? "Edit expense" : "Add expense"} onKeyDown={e => e.key === "Escape" && setSheet(false)}>
          <div className="glass-strong max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-3xl p-5"><div className="flex items-center justify-between"><h2 className="font-semibold text-yellow-400">{f.id ? "Edit expense" : "Add expense"}</h2><button aria-label="Close" className="p-2 text-gray-400" onClick={() => setSheet(false)}><X size={18} /></button></div>
            <input autoFocus aria-label="Amount" inputMode="decimal" placeholder="0" value={f.amt} onChange={e => setF({ ...f, amt: groupDigits(e.target.value) })} className="w-full bg-transparent text-center text-5xl font-bold outline-none placeholder:text-white/20" />
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
              <button role="radio" aria-checked={!f.cat} className={`rounded-full px-4 py-2 text-sm ${!f.cat ? "bg-orange-400 text-black" : "glass"}`} onClick={() => setF({ ...f, cat: "" })}><AlertTriangle size={14} className="mr-1 inline" />Unplanned</button>
              {recent.map(x => <button key={x.id} role="radio" aria-checked={f.cat === x.id} className={`rounded-full px-4 py-2 text-sm ${f.cat === x.id ? "bg-gold text-black" : "glass"}`} onClick={() => setF({ ...f, cat: x.id })}>{x.name}</button>)}</div>
            <p className={`min-h-5 text-sm ${c && left < 0 ? "text-red-400" : "text-gray-300"}`} aria-live="polite">{v > 0 && (c ? (left >= 0 ? `After this: ${money(left)} left in ${c.name}` : `This puts ${c.name} over by ${money(-left)}`) : "Unplanned: this comes straight out of your funds")}</p>
            <input className={input} aria-label="Note" placeholder="Note (optional)" value={f.label} onChange={e => setF({ ...f, label: e.target.value })} />
            <input className={input} type="date" aria-label="Date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
            <GoldButton onClick={() => saveExp(false)}>{f.id ? "Save changes" : "Save"}</GoldButton>
            {!f.id && <button className="glass w-full rounded-2xl p-3" onClick={() => saveExp(true)}>Save &amp; add another</button>}</div></div>; })()}

      {ec && <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Edit category" onKeyDown={e => e.key === "Escape" && setEc(null)}>
        <div className="glass-strong w-full max-w-sm space-y-3 rounded-3xl p-5"><h2 className="font-semibold text-yellow-400">Edit category</h2>
          <input autoFocus className={input} aria-label="Category name" value={ec.name} onChange={e => setEc({ ...ec, name: e.target.value })} />
          <input className={input} aria-label="Category amount" inputMode="numeric" value={ec.amt} onChange={e => setEc({ ...ec, amt: groupDigits(e.target.value) })} />
          <select className={input} aria-label="Cost type" value={ec.type} onChange={e => setEc({ ...ec, type: e.target.value })}>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <GoldButton onClick={saveCat}>Save</GoldButton><button className="w-full p-2 text-gray-400" onClick={() => setEc(null)}>Cancel</button></div></div>}

      {eb && <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Budget details" onKeyDown={e => e.key === "Escape" && setEb(null)}>
        <div className="glass-strong max-h-[92vh] w-full max-w-sm space-y-3 overflow-y-auto rounded-3xl p-5"><h2 className="font-semibold text-yellow-400">Budget details</h2>
          <input className={input} aria-label="Name" value={eb.name} onChange={e => setEb({ ...eb, name: e.target.value })} />
          <select className={input} aria-label="Type" value={eb.kind} onChange={e => setEb({ ...eb, kind: e.target.value })}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <input className={input} aria-label="Organisation" placeholder="Organisation or client" value={eb.org} onChange={e => setEb({ ...eb, org: e.target.value })} />
          <textarea className={input} aria-label="Description" rows={3} placeholder="Description or assumptions (appears in the PDF)" value={eb.desc} onChange={e => setEb({ ...eb, desc: e.target.value })} />
          <input className={input} aria-label="Contingency percent" inputMode="decimal" placeholder="Contingency %" value={eb.cont} onChange={e => setEb({ ...eb, cont: e.target.value })} />
          <div className="grid grid-cols-2 gap-2"><label className="text-xs text-gray-400">Start<input className={input} type="date" value={eb.start} onChange={e => setEb({ ...eb, start: e.target.value })} /></label><label className="text-xs text-gray-400">End<input className={input} type="date" value={eb.end} onChange={e => setEb({ ...eb, end: e.target.value })} /></label></div>
          <GoldButton onClick={saveBudget}>Save</GoldButton><button className="w-full p-2 text-gray-400" onClick={() => setEb(null)}>Cancel</button></div></div>}
    </Section>
  );
}
