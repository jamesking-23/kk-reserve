"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

type Budget = { id: string; name: string; starting_balance: number };
type Cat = { id: string; name: string; amount: number };
type Exp = { id: string; category_id: string | null; label: string | null; amount: number; spent_on: string };
const money = (n: number) => "UGX " + Math.round(n).toLocaleString();
const input = "w-full rounded-xl border border-white/10 bg-white/5 p-3 outline-none focus:border-yellow-400";
const Logo = () => <h1 className="gold-text text-3xl font-extrabold">kkingg reserves</h1>;

// Gold button: haptic buzz + cash emoji floats above and fades
function GoldButton({ children, onClick }: { children: React.ReactNode; onClick: () => Promise<void> | void }) {
  const [pop, setPop] = useState(false);
  return (
    <div className="relative">
      <AnimatePresence>{pop && <motion.span initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -28 }} exit={{ opacity: 0 }} className="absolute -top-2 left-1/2 text-2xl">💵</motion.span>}</AnimatePresence>
      <motion.button whileTap={{ scale: 0.95 }} className="w-full rounded-xl bg-gold px-4 py-3 font-semibold text-black"
        onClick={async () => { navigator.vibrate?.(20); await onClick(); setPop(true); setTimeout(() => setPop(false), 900); }}>{children}</motion.button>
    </div>
  );
}

function Auth() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [f, setF] = useState({ email: "", password: "", username: "", phone: "+256" });
  const [msg, setMsg] = useState("");
  const submit = async () => {
    setMsg("");
    if (mode === "up") {
      if (!/^\+256\d{9}$/.test(f.phone)) return setMsg("Phone must look like +256700000000");
      const { error } = await supabase.auth.signUp({ email: f.email, password: f.password, options: { data: { username: f.username, phone: f.phone } } });
      setMsg(error ? error.message : "Check your email to verify your account, then log in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
      if (error) setMsg(error.message);
    }
  };
  return (
    <main className="mx-auto max-w-sm space-y-3 p-6 pt-20"><Logo />
      {mode === "up" && <><input className={input} placeholder="Username" onChange={e => setF({ ...f, username: e.target.value })} />
        <input className={input} placeholder="+256 phone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></>}
      <input className={input} type="email" placeholder="Email" onChange={e => setF({ ...f, email: e.target.value })} />
      <input className={input} type="password" placeholder="Password" onChange={e => setF({ ...f, password: e.target.value })} />
      <GoldButton onClick={submit}>{mode === "up" ? "Sign up" : "Log in"}</GoldButton>
      {msg && <p role="alert" className="text-sm text-yellow-300">{msg}</p>}
      <button className="text-sm text-gray-400" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "New here? Sign up" : "Have an account? Log in"}</button>
    </main>
  );
}

function Dashboard() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [bid, setBid] = useState("");
  const [cats, setCats] = useState<Cat[]>([]);
  const [exps, setExps] = useState<Exp[]>([]);
  const [toast, setToast] = useState("");
  const [nb, setNb] = useState({ name: "", bal: "" });
  const [nc, setNc] = useState({ name: "", amt: "" });
  const [ne, setNe] = useState({ cat: "", label: "", amt: "" });
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  const loadBudgets = useCallback(async () => {
    const { data } = await supabase.from("budgets").select("*").order("created_at", { ascending: false });
    setBudgets(data ?? []); if (data?.length && !bid) setBid(data[0].id);
  }, [bid]);
  const loadDetail = useCallback(async () => {
    if (!bid) return;
    const [c, e] = await Promise.all([
      supabase.from("planned_categories").select("id,name,amount").eq("budget_id", bid),
      supabase.from("expenses").select("id,category_id,label,amount,spent_on").eq("budget_id", bid).order("created_at", { ascending: false })]);
    setCats(c.data ?? []); setExps(e.data ?? []);
  }, [bid]);
  useEffect(() => { loadBudgets(); }, [loadBudgets]);
  useEffect(() => { loadDetail(); }, [loadDetail]);

  const b = budgets.find(x => x.id === bid);
  const planned = cats.reduce((s, c) => s + Number(c.amount), 0);
  const spent = exps.reduce((s, e) => s + Number(e.amount), 0);
  const unplanned = exps.filter(e => !e.category_id).reduce((s, e) => s + Number(e.amount), 0);
  const start = Number(b?.starting_balance ?? 0);
  const remaining = start - spent;
  const status = planned > start || remaining < 0 ? "Over Budget" : spent > planned * 0.85 ? "At Risk" : "On Track";
  const color = { "On Track": "text-green-400", "At Risk": "text-yellow-400", "Over Budget": "text-red-400" }[status];
  const del = async (table: string, id: string) => { if (confirm("Delete this? This cannot be undone.")) { await supabase.from(table).delete().eq("id", id); loadDetail(); } };

  return (
    <main className="mx-auto max-w-lg space-y-5 p-4">
      <header className="flex items-center justify-between"><Logo /><button className="text-sm text-gray-400" onClick={() => supabase.auth.signOut()}>Log out</button></header>
      {budgets.length > 0 && <select className={input} value={bid} onChange={e => setBid(e.target.value)}>{budgets.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
      <section className="space-y-2 rounded-2xl border border-yellow-400/30 p-4"><h2 className="font-semibold text-yellow-400">New budget</h2>
        <input className={input} placeholder="Name (e.g. October)" onChange={e => setNb({ ...nb, name: e.target.value })} />
        <input className={input} inputMode="numeric" placeholder="Starting balance" onChange={e => setNb({ ...nb, bal: e.target.value })} />
        <GoldButton onClick={async () => { const { error } = await supabase.from("budgets").insert({ name: nb.name, starting_balance: Number(nb.bal) }); if (error) say(error.message); else { say("Budget created"); setBid(""); loadBudgets(); } }}>Create</GoldButton></section>
      {b && <>
        <section className="grid grid-cols-2 gap-3 text-sm">
          {([["Starting", start], ["Planned", planned], ["Spent", spent], ["Remaining", remaining]] as [string, number][]).map(([l, v]) =>
            <div key={l} className="rounded-2xl bg-white/5 p-3"><p className="text-gray-400">{l}</p><p className="text-lg font-bold">{money(v)}</p></div>)}
          <p className={`col-span-2 font-semibold ${color}`}>● {status}{unplanned > 0 && <span className="ml-2 text-orange-400">Unplanned leaks: {money(unplanned)}</span>}</p>
        </section>
        <section className="space-y-3"><h2 className="font-semibold text-yellow-400">Planned expenses</h2>
          {cats.length === 0 && <p className="text-gray-500">No categories yet. Add your first below.</p>}
          {cats.map(c => { const s = exps.filter(e => e.category_id === c.id).reduce((t, e) => t + Number(e.amount), 0); const pct = Math.min(100, (s / c.amount) * 100 || 0);
            return <div key={c.id}><div className="flex justify-between text-sm"><span>{c.name}</span><span className={s > c.amount ? "text-red-400" : ""}>{money(s)} / {money(c.amount)}</span></div>
              <div className="h-2 rounded bg-white/10"><motion.div className={`h-2 rounded ${s > c.amount ? "bg-red-500" : pct > 80 ? "bg-yellow-300" : "bg-gold"}`} animate={{ width: pct + "%" }} /></div>
              <button className="text-xs text-gray-500" onClick={() => del("planned_categories", c.id)}>delete</button></div>; })}
          <div className="flex gap-2"><input className={input} placeholder="Category" onChange={e => setNc({ ...nc, name: e.target.value })} /><input className={input} inputMode="numeric" placeholder="Amount" onChange={e => setNc({ ...nc, amt: e.target.value })} /></div>
          <GoldButton onClick={async () => { const { error } = await supabase.from("planned_categories").insert({ budget_id: bid, name: nc.name, amount: Number(nc.amt) }); if (error) say(error.message); else loadDetail(); }}>Add category</GoldButton></section>
        <section className="space-y-2"><h2 className="font-semibold text-yellow-400">Log spending</h2>
          <select className={input} onChange={e => setNe({ ...ne, cat: e.target.value })}><option value="">Unplanned / extra</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input className={input} placeholder="Note (optional)" onChange={e => setNe({ ...ne, label: e.target.value })} />
          <input className={input} inputMode="numeric" placeholder="Amount spent" onChange={e => setNe({ ...ne, amt: e.target.value })} />
          <GoldButton onClick={async () => { const { error } = await supabase.from("expenses").insert({ budget_id: bid, category_id: ne.cat || null, label: ne.label, amount: Number(ne.amt) }); if (error) say(error.message); else loadDetail(); }}>Save expense</GoldButton></section>
        <section className="space-y-1"><h2 className="font-semibold text-yellow-400">History</h2>
          {exps.map(e => <div key={e.id} className={`flex justify-between rounded-lg p-2 text-sm ${e.category_id ? "bg-white/5" : "border border-orange-400/50 bg-orange-400/10"}`}>
            <span>{e.spent_on} {e.category_id ? cats.find(c => c.id === e.category_id)?.name : "⚠ Unplanned"} {e.label}</span>
            <span>{money(e.amount)} <button aria-label="Delete expense" onClick={() => del("expenses", e.id)}>✕</button></span></div>)}</section>
      </>}
      {toast && <div role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-xl bg-gold px-4 py-2 text-black">{toast}</div>}
    </main>
  );
}

export default function Home() {
  const [session, setSession] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(!!s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === null) return <p className="p-10 text-center text-gray-400">Loading…</p>;
  return session ? <Dashboard /> : <Auth />;
}
