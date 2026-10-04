"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import Avatar, { resizeImage } from "@/components/Avatar";
import { fmt, parseMoney, groupDigits } from "@/lib/money";

type Budget = { id: string; name: string; starting_balance: number };
type Cat = { id: string; name: string; amount: number };
type Exp = { id: string; category_id: string | null; label: string | null; amount: number; spent_on: string; created_at?: string };
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
  const today = () => new Date().toISOString().slice(0, 10);
  const blank = { id: "", cat: "", label: "", amt: "", date: today() };
  const [sheet, setSheet] = useState(false);
  const [f, setF] = useState(blank);
  const [ec, setEc] = useState<null | { id: string; name: string; amt: string }>(null);
  const [undo, setUndo] = useState<null | (() => Promise<void>)>(null);
  const [prof, setProf] = useState<{ username: string | null; avatar_url: string | null }>({ username: null, avatar_url: null });
  const [email, setEmail] = useState("");
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);
  const [uname, setUname] = useState("");
  const [ask, setAsk] = useState<null | { table: string; id: string }>(null);
  const [uid, setUid] = useState("");
  const say = (m: string, u?: () => Promise<void>) => { setToast(m); setUndo(u ? () => u : null); setTimeout(() => { setToast(""); setUndo(null); }, u ? 7000 : 2500); };
  const openNew = () => { setF({ ...blank, date: today() }); setSheet(true); };
  const openEdit = (e: Exp) => { setF({ id: e.id, cat: e.category_id ?? "", label: e.label ?? "", amt: groupDigits(String(e.amount)), date: e.spent_on }); setSheet(true); };
  useEffect(() => {
    const k = (ev: KeyboardEvent) => { if (ev.key.toLowerCase() === "n" && !ev.metaKey && !ev.ctrlKey && !/INPUT|TEXTAREA|SELECT/.test((ev.target as HTMLElement).tagName)) { ev.preventDefault(); openNew(); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  const loadBudgets = useCallback(async () => {
    const { data } = await supabase.from("budgets").select("*").order("created_at", { ascending: false });
    setBudgets(data ?? []); if (data?.length && !bid) setBid(data[0].id);
  }, [bid]);
  const loadDetail = useCallback(async () => {
    if (!bid) return;
    const [c, e] = await Promise.all([
      supabase.from("planned_categories").select("id,name,amount").eq("budget_id", bid),
      supabase.from("expenses").select("id,category_id,label,amount,spent_on,created_at").eq("budget_id", bid).order("created_at", { ascending: false })]);
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
  const pick = (e: Exp) => ({ id: e.id, budget_id: bid, category_id: e.category_id, label: e.label, amount: e.amount, spent_on: e.spent_on, created_at: e.created_at });
  const doDel = async () => {
    if (!ask) return; let restore: () => Promise<void> = async () => {};
    if (ask.table === "expenses") { const row = exps.find(e => e.id === ask.id); await supabase.from("expenses").delete().eq("id", ask.id); restore = async () => { if (row) await supabase.from("expenses").insert(pick(row)); }; }
    else { const cat = cats.find(c => c.id === ask.id); const kids = exps.filter(e => e.category_id === ask.id); await supabase.from("planned_categories").delete().eq("id", ask.id);
      restore = async () => { if (cat) { await supabase.from("planned_categories").insert({ id: cat.id, budget_id: bid, name: cat.name, amount: cat.amount }); if (kids.length) await supabase.from("expenses").insert(kids.map(pick)); } }; }
    setAsk(null); await loadDetail(); say("Deleted", async () => { await restore(); await loadDetail(); });
  };
  const saveExp = async (another: boolean) => {
    const v = parseMoney(f.amt); if (v === null) return say("Enter a valid amount.");
    const row = { category_id: f.cat || null, label: f.label.trim() || null, amount: v, spent_on: f.date || today() };
    const { error } = f.id ? await supabase.from("expenses").update({ ...row, updated_at: new Date().toISOString() }).eq("id", f.id) : await supabase.from("expenses").insert({ ...row, budget_id: bid });
    if (error) return say(error.message);
    await loadDetail();
    if (another && !f.id) setF({ ...f, amt: "", label: "" }); else setSheet(false);
  };
  const saveCat = async () => {
    if (!ec) return; const v = parseMoney(ec.amt); if (!ec.name.trim() || v === null) return say("Enter a name and a valid amount.");
    const { error } = await supabase.from("planned_categories").update({ name: ec.name.trim(), amount: v }).eq("id", ec.id);
    if (error) say(error.message); else { setEc(null); loadDetail(); }
  };
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
              <button className="py-2 pr-4 text-xs text-gray-400" onClick={() => setEc({ id: c.id, name: c.name, amt: groupDigits(String(c.amount)) })}>edit</button><button className="py-2 text-xs text-gray-400" onClick={() => del("planned_categories", c.id)}>delete</button></div>; })}
          <div className="flex gap-2"><input className={input} aria-label="Category name" value={nc.name} placeholder="Category" onChange={e => setNc({ ...nc, name: e.target.value })} /><input className={input} aria-label="Category amount" value={nc.amt} inputMode="numeric" placeholder="Amount" onChange={e => setNc({ ...nc, amt: e.target.value })} /></div>
          <GoldButton onClick={async () => { const v = parseMoney(nc.amt); if (!nc.name.trim() || v === null) return say("Enter a name and a valid amount."); const { error } = await supabase.from("planned_categories").insert({ budget_id: bid, name: nc.name.trim(), amount: v }); if (error) say(error.message); else { setNc({ name: "", amt: "" }); loadDetail(); } }}>Add category</GoldButton></section>
        <section className="space-y-1"><h2 className="font-semibold text-yellow-400">History</h2>
          {exps.map(e => <div key={e.id} className={`flex justify-between rounded-lg p-2 text-sm ${e.category_id ? "bg-white/5" : "border border-orange-400/50 bg-orange-400/10"}`}>
            <button className="min-w-0 truncate py-1 text-left" aria-label="Edit expense" onClick={() => openEdit(e)}>{e.spent_on} {e.category_id ? cats.find(c => c.id === e.category_id)?.name : "⚠ Unplanned"} {e.label}</button>
            <span>{money(e.amount)} <button aria-label="Delete expense" onClick={() => del("expenses", e.id)}>✕</button></span></div>)}</section>
      </>}
      {ask && <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Confirm delete" onKeyDown={e => e.key === "Escape" && setAsk(null)}>
        <div className="glass-strong w-full max-w-sm space-y-3 rounded-3xl p-5"><p className="font-semibold">Delete this?</p><p className="text-sm text-gray-400">{ask.table === "planned_categories" ? "This also deletes its logged expenses. You can undo for a few seconds." : "You can undo for a few seconds."}</p>
          <div className="flex gap-2"><button autoFocus className="glass flex-1 rounded-2xl p-3" onClick={() => setAsk(null)}>Cancel</button><button className="flex-1 rounded-2xl bg-red-500 p-3 font-semibold" onClick={doDel}>Delete</button></div></div></div>}
      {settings && <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Profile and settings" onKeyDown={e => e.key === "Escape" && setSettings(false)}>
        <div className="glass-strong w-full max-w-sm space-y-4 rounded-3xl p-5"><h2 className="font-semibold text-yellow-400">Profile &amp; settings</h2>
          <div className="flex items-center gap-4"><Avatar url={prof.avatar_url} name={shown} size={72} />
            <div className="space-y-2 text-sm"><label className="glass block cursor-pointer rounded-xl px-3 py-2">{prof.avatar_url ? "Replace photo" : "Upload photo"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => upload(e.target.files?.[0])} /></label>
              {prof.avatar_url && <button className="text-red-300" onClick={removePhoto}>Remove photo</button>}</div></div>
          <label className="block text-sm text-gray-300">Username<input className={input} value={uname} onChange={e => setUname(e.target.value)} /></label>
          <GoldButton onClick={saveName}>Save</GoldButton>
          <button className="w-full rounded-2xl p-2 text-gray-400" onClick={() => setSettings(false)}>Close</button></div></div>}
      {b && <button aria-label="Add expense (N)" className="fixed bottom-6 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-3xl font-light text-black shadow-[0_8px_30px_rgb(255_215_0/.4)]" onClick={openNew}>+</button>}
      {sheet && (() => { const c = cats.find(x => x.id === f.cat); const v = parseMoney(f.amt) ?? 0; const used = c ? exps.filter(e => e.category_id === c.id && e.id !== f.id).reduce((t, e) => t + Number(e.amount), 0) : 0;
        const left = c ? c.amount - used - v : 0; const recent = [...cats].sort((a, b2) => { const i = exps.findIndex(e => e.category_id === a.id), j = exps.findIndex(e => e.category_id === b2.id); return (i < 0 ? 1e9 : i) - (j < 0 ? 1e9 : j); });
        return <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-3" role="dialog" aria-modal="true" aria-label={f.id ? "Edit expense" : "Add expense"} onKeyDown={e => e.key === "Escape" && setSheet(false)}>
          <div className="glass-strong max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-3xl p-5"><div className="flex items-center justify-between"><h2 className="font-semibold text-yellow-400">{f.id ? "Edit expense" : "Add expense"}</h2><button aria-label="Close" className="p-2 text-gray-400" onClick={() => setSheet(false)}>✕</button></div>
            <input autoFocus aria-label="Amount" inputMode="decimal" placeholder="0" value={f.amt} onChange={e => setF({ ...f, amt: groupDigits(e.target.value) })} className="w-full bg-transparent text-center text-5xl font-bold outline-none placeholder:text-white/20" />
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
              <button role="radio" aria-checked={!f.cat} className={`rounded-full px-4 py-2 text-sm ${!f.cat ? "bg-orange-400 text-black" : "glass"}`} onClick={() => setF({ ...f, cat: "" })}>⚠ Unplanned</button>
              {recent.map(x => <button key={x.id} role="radio" aria-checked={f.cat === x.id} className={`rounded-full px-4 py-2 text-sm ${f.cat === x.id ? "bg-gold text-black" : "glass"}`} onClick={() => setF({ ...f, cat: x.id })}>{x.name}</button>)}</div>
            <p className={`min-h-5 text-sm ${c && left < 0 ? "text-red-400" : "text-gray-300"}`} aria-live="polite">{v > 0 && (c ? (left >= 0 ? `After this: ${money(left)} left in ${c.name}` : `This puts ${c.name} over by ${money(-left)}`) : "Unplanned: this comes straight out of your balance")}</p>
            <input className={input} aria-label="Note" placeholder="Note (optional)" value={f.label} onChange={e => setF({ ...f, label: e.target.value })} />
            <input className={input} type="date" aria-label="Date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
            <GoldButton onClick={() => saveExp(false)}>{f.id ? "Save changes" : "Save"}</GoldButton>
            {!f.id && <button className="glass w-full rounded-2xl p-3" onClick={() => saveExp(true)}>Save &amp; add another</button>}</div></div>; })()}
      {ec && <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Edit category" onKeyDown={e => e.key === "Escape" && setEc(null)}>
        <div className="glass-strong w-full max-w-sm space-y-3 rounded-3xl p-5"><h2 className="font-semibold text-yellow-400">Edit category</h2>
          <input autoFocus className={input} aria-label="Category name" value={ec.name} onChange={e => setEc({ ...ec, name: e.target.value })} />
          <input className={input} aria-label="Category amount" inputMode="numeric" value={ec.amt} onChange={e => setEc({ ...ec, amt: groupDigits(e.target.value) })} />
          <GoldButton onClick={saveCat}>Save</GoldButton><button className="w-full p-2 text-gray-400" onClick={() => setEc(null)}>Cancel</button></div></div>}
      {toast && <div role="status" className="fixed bottom-24 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-gold px-4 py-2 text-black">{toast}{undo && <button className="font-bold underline" onClick={async () => { await undo(); setToast(""); setUndo(null); }}>Undo</button>}</div>}
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
