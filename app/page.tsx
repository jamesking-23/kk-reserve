"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import Avatar, { resizeImage } from "@/components/Avatar";
import { fmt, parseMoney } from "@/lib/money";

type Budget = { id: string; name: string; starting_balance: number };
type Cat = { id: string; name: string; amount: number };
type Exp = { id: string; category_id: string | null; label: string | null; amount: number; spent_on: string };
const money = (n: number) => fmt(n);
const input = "glass w-full rounded-2xl p-3 outline-none focus:border-yellow-400";
const Logo = () => <h1 className="gold-text text-3xl font-extrabold">kkingg reserves</h1>;

// Gold button: haptic buzz + cash emoji floats above and fades
function GoldButton({ children, onClick }: { children: React.ReactNode; onClick: () => Promise<void> | void }) {
  const [pop, setPop] = useState(false);
  return (
    <div className="relative">
      <AnimatePresence>{pop && <motion.span initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -28 }} exit={{ opacity: 0 }} className="absolute -top-2 left-1/2 text-2xl">💵</motion.span>}</AnimatePresence>
      <motion.button whileTap={{ scale: 0.95 }} className="w-full rounded-2xl bg-gold px-4 py-3 font-semibold text-black shadow-[inset_0_1px_0_rgb(255_255_255/.5),0_6px_24px_rgb(255_215_0/.25)]"
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
  const [prof, setProf] = useState<{ username: string | null; avatar_url: string | null }>({ username: null, avatar_url: null });
  const [email, setEmail] = useState("");
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);
  const [uname, setUname] = useState("");
  const [ask, setAsk] = useState<null | { table: string; id: string }>(null);
  const [uid, setUid] = useState("");
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
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser(); if (!u.user) return;
      setUid(u.user.id); setEmail(u.user.email ?? "");
      await supabase.from("profiles").upsert({ id: u.user.id }, { onConflict: "id", ignoreDuplicates: true }); // self-heal missing profile row
      const { data } = await supabase.from("profiles").select("username,avatar_url").eq("id", u.user.id).single();
      if (data) { setProf(data); setUname(data.username ?? ""); }
    })();
  }, []);
  const saveName = async () => {
    const { error } = await supabase.from("profiles").update({ username: uname.trim() || null }).eq("id", uid);
    if (error) say(error.code === "23505" ? "That username is taken." : error.message); else { setProf({ ...prof, username: uname.trim() || null }); say("Profile saved"); }
  };
  const upload = async (f?: File) => {
    if (!f) return;
    try {
      const blob = await resizeImage(f);
      const path = `${uid}/avatar.webp`;
      const { error } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/webp" });
      if (error) throw error;
      const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl + "?v=" + Date.now();
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", uid);
      setProf(p => ({ ...p, avatar_url: url })); say("Photo updated");
    } catch (e: any) { say(e.message ?? "Upload failed"); }
  };
  const removePhoto = async () => {
    await supabase.storage.from("avatars").remove([`${uid}/avatar.webp`]);
    await supabase.from("profiles").update({ avatar_url: null }).eq("id", uid);
    setProf(p => ({ ...p, avatar_url: null })); say("Photo removed");
  };
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
  const del = (table: string, id: string) => setAsk({ table, id });
  const doDel = async () => { if (!ask) return; await supabase.from(ask.table).delete().eq("id", ask.id); setAsk(null); loadDetail(); say("Deleted"); };
  const shown = prof.username || email.split("@")[0] || "me";

  return (
    <main className="mx-auto max-w-lg space-y-5 p-4">
      <header className="relative flex items-center justify-between"><Logo />
        <button aria-label="Account menu" aria-expanded={menu} className="rounded-full ring-2 ring-yellow-400/60" onClick={() => setMenu(!menu)}><Avatar url={prof.avatar_url} name={shown} size={44} /></button>
        {menu && <div role="menu" className="glass-strong absolute right-0 top-14 z-20 w-64 space-y-1 rounded-3xl p-3" onKeyDown={e => e.key === "Escape" && setMenu(false)}>
          <div className="flex items-center gap-3 p-2"><Avatar url={prof.avatar_url} name={shown} size={40} /><div className="min-w-0"><p className="truncate font-semibold">{shown}</p><p className="truncate text-xs text-gray-400">{email}</p></div></div>
          <button role="menuitem" className="w-full rounded-xl p-2 text-left hover:bg-white/10" onClick={() => { setMenu(false); setSettings(true); }}>Profile &amp; settings</button>
          <button role="menuitem" className="w-full rounded-xl p-2 text-left hover:bg-white/10" onClick={() => supabase.auth.signOut()}>Log out</button></div>}
      </header>
      {budgets.length > 0 && <select className={input} value={bid} onChange={e => setBid(e.target.value)}>{budgets.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
      <section className="glass space-y-2 rounded-3xl p-4"><h2 className="font-semibold text-yellow-400">New budget</h2>
        <input className={input} aria-label="Budget name" value={nb.name} placeholder="Name (e.g. October)" onChange={e => setNb({ ...nb, name: e.target.value })} />
        <input className={input} aria-label="Starting balance" value={nb.bal} inputMode="numeric" placeholder="Starting balance" onChange={e => setNb({ ...nb, bal: e.target.value })} />
        <GoldButton onClick={async () => { const v = parseMoney(nb.bal); if (!nb.name.trim() || v === null) return say("Enter a name and a valid balance."); const { error } = await supabase.from("budgets").insert({ name: nb.name.trim(), starting_balance: v }); if (error) say(error.message); else { say("Budget created"); setNb({ name: "", bal: "" }); setBid(""); loadBudgets(); } }}>Create</GoldButton></section>
      {b && <>
        <section className="grid grid-cols-2 gap-3 text-sm">
          {([["Starting", start], ["Planned", planned], ["Spent", spent], ["Remaining", remaining]] as [string, number][]).map(([l, v]) =>
            <div key={l} className="surface rounded-3xl p-3"><p className="text-gray-400">{l}</p><p className="text-lg font-bold">{money(v)}</p></div>)}
          <p className={`col-span-2 font-semibold ${color}`}>● {status}{unplanned > 0 && <span className="ml-2 text-orange-400">Unplanned leaks: {money(unplanned)}</span>}</p>
        </section>
        <section className="space-y-3"><h2 className="font-semibold text-yellow-400">Planned expenses</h2>
          {cats.length === 0 && <p className="text-gray-500">No categories yet. Add your first below.</p>}
          {cats.map(c => { const s = exps.filter(e => e.category_id === c.id).reduce((t, e) => t + Number(e.amount), 0); const pct = Math.min(100, (s / c.amount) * 100 || 0);
            return <div key={c.id}><div className="flex justify-between text-sm"><span>{c.name}</span><span className={s > c.amount ? "text-red-400" : ""}>{money(s)} / {money(c.amount)}</span></div>
              <div className="h-2 rounded bg-white/10"><motion.div className={`h-2 rounded ${s > c.amount ? "bg-red-500" : pct > 80 ? "bg-yellow-300" : "bg-gold"}`} animate={{ width: pct + "%" }} /></div>
              <button className="text-xs text-gray-500" onClick={() => del("planned_categories", c.id)}>delete</button></div>; })}
          <div className="flex gap-2"><input className={input} aria-label="Category name" value={nc.name} placeholder="Category" onChange={e => setNc({ ...nc, name: e.target.value })} /><input className={input} aria-label="Category amount" value={nc.amt} inputMode="numeric" placeholder="Amount" onChange={e => setNc({ ...nc, amt: e.target.value })} /></div>
          <GoldButton onClick={async () => { const v = parseMoney(nc.amt); if (!nc.name.trim() || v === null) return say("Enter a name and a valid amount."); const { error } = await supabase.from("planned_categories").insert({ budget_id: bid, name: nc.name.trim(), amount: v }); if (error) say(error.message); else { setNc({ name: "", amt: "" }); loadDetail(); } }}>Add category</GoldButton></section>
        <section className="space-y-2"><h2 className="font-semibold text-yellow-400">Log spending</h2>
          <select className={input} aria-label="Category" value={ne.cat} onChange={e => setNe({ ...ne, cat: e.target.value })}><option value="">Unplanned / extra</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input className={input} aria-label="Note" value={ne.label} placeholder="Note (optional)" onChange={e => setNe({ ...ne, label: e.target.value })} />
          <input className={input} aria-label="Amount spent" value={ne.amt} inputMode="numeric" placeholder="Amount spent" onChange={e => setNe({ ...ne, amt: e.target.value })} />
          <GoldButton onClick={async () => { const v = parseMoney(ne.amt); if (v === null) return say("Enter a valid amount."); const { error } = await supabase.from("expenses").insert({ budget_id: bid, category_id: ne.cat || null, label: ne.label, amount: v }); if (error) say(error.message); else { setNe({ cat: ne.cat, label: "", amt: "" }); loadDetail(); } }}>Save expense</GoldButton></section>
        <section className="space-y-1"><h2 className="font-semibold text-yellow-400">History</h2>
          {exps.map(e => <div key={e.id} className={`flex justify-between rounded-lg p-2 text-sm ${e.category_id ? "bg-white/5" : "border border-orange-400/50 bg-orange-400/10"}`}>
            <span>{e.spent_on} {e.category_id ? cats.find(c => c.id === e.category_id)?.name : "⚠ Unplanned"} {e.label}</span>
            <span>{money(e.amount)} <button aria-label="Delete expense" onClick={() => del("expenses", e.id)}>✕</button></span></div>)}</section>
      </>}
      {ask && <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Confirm delete" onKeyDown={e => e.key === "Escape" && setAsk(null)}>
        <div className="glass-strong w-full max-w-sm space-y-3 rounded-3xl p-5"><p className="font-semibold">Delete this?</p><p className="text-sm text-gray-400">This cannot be undone.</p>
          <div className="flex gap-2"><button autoFocus className="glass flex-1 rounded-2xl p-3" onClick={() => setAsk(null)}>Cancel</button><button className="flex-1 rounded-2xl bg-red-500 p-3 font-semibold" onClick={doDel}>Delete</button></div></div></div>}
      {settings && <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Profile and settings" onKeyDown={e => e.key === "Escape" && setSettings(false)}>
        <div className="glass-strong w-full max-w-sm space-y-4 rounded-3xl p-5"><h2 className="font-semibold text-yellow-400">Profile &amp; settings</h2>
          <div className="flex items-center gap-4"><Avatar url={prof.avatar_url} name={shown} size={72} />
            <div className="space-y-2 text-sm"><label className="glass block cursor-pointer rounded-xl px-3 py-2">{prof.avatar_url ? "Replace photo" : "Upload photo"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => upload(e.target.files?.[0])} /></label>
              {prof.avatar_url && <button className="text-red-300" onClick={removePhoto}>Remove photo</button>}</div></div>
          <label className="block text-sm text-gray-300">Username<input className={input} value={uname} onChange={e => setUname(e.target.value)} /></label>
          <GoldButton onClick={saveName}>Save</GoldButton>
          <button className="w-full rounded-2xl p-2 text-gray-400" onClick={() => setSettings(false)}>Close</button></div></div>}
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
