"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import Avatar, { resizeImage } from "@/components/Avatar";
import { fmt, parseMoney, groupDigits } from "@/lib/money";
import Reserves from "@/components/Reserves";
import Reports from "@/components/Reports";
import { statusOf } from "@/lib/budget";

type Budget = { id: string; name: string; starting_balance: number; archived?: boolean; end_date?: string | null; created_at?: string };
const ACCENTS = ["#FFD700", "#FFB020", "#34D399", "#38BDF8", "#FB7185", "#C4B5FD"];
const applyTheme = (t: string, a: string) => { const d = t === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t; document.documentElement.dataset.theme = d; document.documentElement.style.setProperty("--accent", a || "#FFD700"); localStorage.setItem("kk-theme", t); localStorage.setItem("kk-accent", a || ""); };
type Cat = { id: string; name: string; amount: number };
type Exp = { id: string; category_id: string | null; label: string | null; amount: number; spent_on: string; created_at?: string };
const money = (n: number) => fmt(n);
const input = "glass w-full rounded-2xl p-3 outline-none focus:border-yellow-400";
const dayLabel = (d: string) => {
  const t = new Date().toISOString().slice(0, 10), y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  return d === t ? "Today" : d === y ? "Yesterday" : new Date(d + "T00:00:00").toLocaleDateString("en-UG", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};
const Logo = () => <h1 className="gold-text text-3xl font-extrabold">kkingg reserves</h1>;

// Gold button: haptic buzz + cash emoji floats above and fades
function GoldButton({ children, onClick }: { children: React.ReactNode; onClick: () => Promise<void> | void }) {
  const [pop, setPop] = useState(false);
  return (
    <div className="relative">
      <AnimatePresence>{pop && <motion.span initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -28 }} exit={{ opacity: 0 }} className="absolute -top-2 left-1/2 text-2xl">💵</motion.span>}</AnimatePresence>
      <motion.button whileTap={{ scale: 0.95 }} className="w-full rounded-2xl bg-gold px-4 py-3 font-semibold text-black shadow-[inset_0_1px_0_rgb(255_255_255/.5),0_6px_24px_rgb(255_215_0/.25)]"
        onClick={async () => { if (localStorage.getItem("kk-haptics") !== "off") navigator.vibrate?.(20); await onClick(); setPop(true); setTimeout(() => setPop(false), 900); }}>{children}</motion.button>
    </div>
  );
}

function Auth() {
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [f, setF] = useState({ email: "", password: "", username: "", phone: "+256" });
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const submit = async () => {
    setMsg(""); setCanResend(false);
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setMsg("Enter a valid email address.");
    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(f.email, { redirectTo: window.location.origin });
      return setMsg(error ? error.message : "If that email has an account, a reset link is on its way.");
    }
    if (f.password.length < 8) return setMsg("Password must be at least 8 characters.");
    if (mode === "up") {
      if (!/^\+256\d{9}$/.test(f.phone)) return setMsg("Phone must look like +256700000000");
      const { error } = await supabase.auth.signUp({ email: f.email, password: f.password, options: { data: { username: f.username, phone: f.phone } } });
      setMsg(error ? error.message : "Check your email to verify your account, then log in."); if (!error) setCanResend(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
      if (error) { setMsg(error.message); if (/confirm/i.test(error.message)) setCanResend(true); }
    }
  };
  const resend = async () => { const { error } = await supabase.auth.resend({ type: "signup", email: f.email }); setMsg(error ? error.message : "Verification email sent again."); };
  return (
    <main className="mx-auto max-w-sm space-y-3 p-6 pt-20"><Logo />
      {mode === "up" && <><input className={input} aria-label="Username" placeholder="Username" onChange={e => setF({ ...f, username: e.target.value })} />
        <input className={input} aria-label="Phone" placeholder="+256 phone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></>}
      <input className={input} type="email" aria-label="Email" placeholder="Email" onChange={e => setF({ ...f, email: e.target.value })} />
      {mode !== "forgot" && <div className="relative"><input className={input} type={show ? "text" : "password"} aria-label="Password" placeholder="Password (8+ characters)" onChange={e => setF({ ...f, password: e.target.value })} />
        <button type="button" className="absolute right-3 top-3 text-sm text-gray-400" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button></div>}
      <GoldButton onClick={submit}>{mode === "up" ? "Sign up" : mode === "forgot" ? "Send reset link" : "Log in"}</GoldButton>
      {msg && <p role="alert" className="text-sm text-yellow-300">{msg}</p>}
      {canResend && <button className="text-sm text-yellow-300 underline" onClick={resend}>Resend verification email</button>}
      <div className="flex justify-between text-sm text-gray-400">
        <button onClick={() => { setMode(mode === "up" ? "in" : "up"); setMsg(""); }}>{mode === "up" ? "Have an account? Log in" : "New here? Sign up"}</button>
        {mode !== "forgot" ? <button onClick={() => { setMode("forgot"); setMsg(""); }}>Forgot password?</button> : <button onClick={() => { setMode("in"); setMsg(""); }}>Back to log in</button>}</div>
      <p className="text-xs text-gray-500"><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p>
    </main>
  );
}

function NewPassword({ done }: { done: () => void }) {
  const [a, setA] = useState(""); const [b, setB] = useState(""); const [msg, setMsg] = useState("");
  return (
    <main className="mx-auto max-w-sm space-y-3 p-6 pt-20"><Logo /><h2 className="font-semibold">Choose a new password</h2>
      <input className={input} type="password" aria-label="New password" placeholder="New password (8+ characters)" onChange={e => setA(e.target.value)} />
      <input className={input} type="password" aria-label="Confirm new password" placeholder="Confirm password" onChange={e => setB(e.target.value)} />
      <GoldButton onClick={async () => { if (a.length < 8) return setMsg("Password must be at least 8 characters."); if (a !== b) return setMsg("Passwords don't match.");
        const { error } = await supabase.auth.updateUser({ password: a }); if (error) setMsg(error.message); else done(); }}>Update password</GoldButton>
      {msg && <p role="alert" className="text-sm text-yellow-300">{msg}</p>}
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
  const [q, setQ] = useState("");
  const [fcat, setFcat] = useState("");
  const [limit, setLimit] = useState(20);
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
  const [tab, setTab] = useState<"home" | "plan" | "reserves" | "reports">("home");
  const [theme, setTheme] = useState("dark");
  const [accent, setAccent] = useState("#FFD700");
  const [haptics, setHaptics] = useState(() => localStorage.getItem("kk-haptics") !== "off");
  const [danger, setDanger] = useState(false);
  const [typed, setTyped] = useState("");
  const say = (m: string, u?: () => Promise<void>) => { setToast(m); setUndo(u ? () => u : null); setTimeout(() => { setToast(""); setUndo(null); }, u ? 7000 : 2500); };
  const openNew = () => { setF({ ...blank, date: today() }); setSheet(true); };
  const openEdit = (e: Exp) => { setF({ id: e.id, cat: e.category_id ?? "", label: e.label ?? "", amt: groupDigits(String(e.amount)), date: e.spent_on }); setSheet(true); };
  useEffect(() => {
    const k = (ev: KeyboardEvent) => { if (ev.key.toLowerCase() === "n" && !ev.metaKey && !ev.ctrlKey && !/INPUT|TEXTAREA|SELECT/.test((ev.target as HTMLElement).tagName)) { ev.preventDefault(); openNew(); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  const loadBudgets = useCallback(async () => {
    const { data } = await supabase.from("budgets").select("*").order("created_at", { ascending: false });
    const list = [...(data ?? [])].sort((a: Budget, c: Budget) => Number(!!a.archived) - Number(!!c.archived)); setBudgets(list); if (list.length && !bid) setBid(list[0].id);
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
      const { data } = await supabase.from("profiles").select("username,avatar_url,theme,accent").eq("id", u.user.id).single();
      if (data) { setProf({ username: data.username, avatar_url: data.avatar_url }); setUname(data.username ?? ""); const t = data.theme || "dark", a = data.accent || "#FFD700"; setTheme(t); setAccent(a); applyTheme(t, a); }
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
  const setLook = async (t: string, a: string) => { setTheme(t); setAccent(a); applyTheme(t, a); if (uid) await supabase.from("profiles").update({ theme: t, accent: a }).eq("id", uid); };
  const deleteAccount = async () => {
    await supabase.storage.from("avatars").remove([`${uid}/avatar.webp`]);
    const { error } = await supabase.rpc("delete_my_account"); if (error) return say(error.message);
    localStorage.clear(); await supabase.auth.signOut();
  };
  const archiveBudget = async () => { await supabase.from("budgets").update({ archived: !b?.archived }).eq("id", bid); say(b?.archived ? "Budget restored" : "Budget archived"); loadBudgets(); };
  const duplicateBudget = async () => {
    if (!b) return; const { data, error } = await supabase.from("budgets").insert({ name: b.name + " (copy)", starting_balance: b.starting_balance }).select("id").single();
    if (error || !data) return say(error?.message ?? "Could not duplicate");
    if (cats.length) await supabase.from("planned_categories").insert(cats.map(c => ({ budget_id: data.id, name: c.name, amount: c.amount })));
    say("Budget duplicated with its categories"); setBid(data.id); loadBudgets();
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
  const status = statusOf(planned, start, spent);
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
  const endD = b?.end_date ? new Date(b.end_date + "T23:59:59") : (() => { const d = new Date(b?.created_at ?? Date.now()); return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59); })();
  const daysLeft = Math.ceil((endD.getTime() - Date.now()) / 864e5);
  const safe = daysLeft >= 1 ? Math.max(0, remaining) / daysLeft : null;
  const tips: string[] = [];
  if (spent > 0 && unplanned / spent > 0.2) tips.push(`Unplanned items are ${Math.round((unplanned / spent) * 100)}% of what you've spent.`);
  cats.forEach(c => { const u = exps.filter(e => e.category_id === c.id).reduce((t, e) => t + Number(e.amount), 0); if (c.amount > 0 && u / c.amount >= 0.9) tips.push(`${c.name} is ${Math.round((u / c.amount) * 100)}% used.`); });
  if (tips.length === 0) tips.push(status === "On Track" ? "You're on track." : status === "At Risk" ? "You've used most of your plan." : "You're over budget.");
  const shown = prof.username || email.split("@")[0] || "me";

  return (
    <main className="mx-auto max-w-lg space-y-5 p-4 pb-32">
      <header className="relative flex items-center justify-between"><Logo />
        <button aria-label="Account menu" aria-expanded={menu} className="rounded-full ring-2 ring-yellow-400/60" onClick={() => setMenu(!menu)}><Avatar url={prof.avatar_url} name={shown} size={44} /></button>
        {menu && <div role="menu" className="glass-strong absolute right-0 top-14 z-20 w-64 space-y-1 rounded-3xl p-3" onKeyDown={e => e.key === "Escape" && setMenu(false)}>
          <div className="flex items-center gap-3 p-2"><Avatar url={prof.avatar_url} name={shown} size={40} /><div className="min-w-0"><p className="truncate font-semibold">{shown}</p><p className="truncate text-xs text-gray-400">{email}</p></div></div>
          <button role="menuitem" className="w-full rounded-xl p-2 text-left hover:bg-white/10" onClick={() => { setMenu(false); setSettings(true); }}>Profile &amp; settings</button>
          <button role="menuitem" className="w-full rounded-xl p-2 text-left hover:bg-white/10" onClick={() => supabase.auth.signOut()}>Log out</button></div>}
      </header>
      {(tab === "home" || tab === "plan") && budgets.length > 0 && <div className="space-y-2"><select className={input} aria-label="Budget" value={bid} onChange={e => setBid(e.target.value)}>{budgets.map(x => <option key={x.id} value={x.id}>{x.name}{x.archived ? " (archived)" : ""}</option>)}</select>
        {tab === "plan" && b && <div className="flex gap-2 text-sm"><button className="glass flex-1 rounded-xl p-2" onClick={duplicateBudget}>Duplicate</button><button className="glass flex-1 rounded-xl p-2" onClick={archiveBudget}>{b.archived ? "Unarchive" : "Archive"}</button></div>}</div>}
      {tab === "home" && !b && <div className="surface space-y-3 rounded-3xl p-5 text-center"><p>No budget yet.</p><button className="rounded-2xl bg-gold px-4 py-2 font-semibold text-black" onClick={() => setTab("plan")}>Create your first budget</button></div>}
      {tab === "home" && b && <>
        <section className="grid grid-cols-2 gap-3 text-sm">
          {([["Starting", start], ["Planned", planned], ["Spent", spent], ["Remaining", remaining]] as [string, number][]).map(([l, v]) =>
            <div key={l} className="surface rounded-3xl p-3"><p className="text-gray-400">{l}</p><p className="text-lg font-bold">{money(v)}</p></div>)}
          <p className={`col-span-2 font-semibold ${color}`}>● {status}{unplanned > 0 && <span className="ml-2 text-orange-400">Unplanned leaks: {money(unplanned)}</span>}</p>
        </section>
        <section className="surface space-y-1 rounded-3xl p-4 text-sm" aria-label="Insights"><p className="font-semibold">Insights</p>
          {safe !== null && <p>Safe to spend today: <b>{money(safe)}</b></p>}
          {unplanned > 0 && <button className="w-full rounded-xl border border-orange-400/60 bg-orange-400/10 p-2 text-left text-orange-400" onClick={() => { setFcat("__u"); document.getElementById("history")?.scrollIntoView({ behavior: "smooth" }); }}>⚠ Unplanned leaks: {money(unplanned)} · tap to see them</button>}
          {tips.map(t => <p key={t} className="text-gray-300">• {t}</p>)}</section>
        <section className="space-y-2"><h2 id="history" className="font-semibold text-yellow-400">History</h2>
          <div className="flex gap-2"><input className={input} type="search" aria-label="Search expenses" placeholder="Search" value={q} onChange={e => { setQ(e.target.value); setLimit(20); }} />
            <select className={input} aria-label="Filter expenses" value={fcat} onChange={e => { setFcat(e.target.value); setLimit(20); }}><option value="">All</option><option value="__u">Unplanned only</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          {(() => {
            const term = q.trim().toLowerCase();
            const hit = exps.filter(e => (fcat === "" || (fcat === "__u" ? !e.category_id : e.category_id === fcat)) &&
              (!term || `${e.label ?? ""} ${cats.find(c => c.id === e.category_id)?.name ?? "unplanned"} ${e.amount}`.toLowerCase().includes(term)))
              .sort((a, b2) => b2.spent_on.localeCompare(a.spent_on));
            const groups: [string, Exp[]][] = []; hit.slice(0, limit).forEach(e => { const g = groups.find(x => x[0] === e.spent_on); g ? g[1].push(e) : groups.push([e.spent_on, [e]]); });
            return <>
              {hit.length === 0 && <p className="text-gray-500">{exps.length ? "No matches." : "No expenses yet. Tap + to add your first."}</p>}
              {groups.map(([d, rows]) => <div key={d} className="space-y-1"><p className="pt-2 text-xs uppercase tracking-wide text-gray-400">{dayLabel(d)} · {money(rows.reduce((t, e) => t + Number(e.amount), 0))}</p>
                {rows.map(e => <div key={e.id} className={`flex justify-between rounded-lg p-2 text-sm ${e.category_id ? "bg-white/5" : "border border-orange-400/50 bg-orange-400/10"}`}>
                  <button className="min-w-0 truncate py-1 text-left" aria-label="Edit expense" onClick={() => openEdit(e)}>{e.category_id ? cats.find(c => c.id === e.category_id)?.name : "⚠ Unplanned"} {e.label}</button>
                  <span>{money(e.amount)} <button aria-label="Delete expense" className="p-1" onClick={() => del("expenses", e.id)}>✕</button></span></div>)}</div>)}
              {hit.length > limit && <button className="glass w-full rounded-2xl p-3" onClick={() => setLimit(limit + 20)}>Show more</button>}
            </>; })()}
        </section>
      </>}
      {tab === "plan" && <>
      <section className="glass space-y-2 rounded-3xl p-4"><h2 className="font-semibold text-yellow-400">New budget</h2>
        <input className={input} aria-label="Budget name" value={nb.name} placeholder="Name (e.g. October)" onChange={e => setNb({ ...nb, name: e.target.value })} />
        <input className={input} aria-label="Starting balance" value={nb.bal} inputMode="numeric" placeholder="Starting balance" onChange={e => setNb({ ...nb, bal: e.target.value })} />
        <GoldButton onClick={async () => { const v = parseMoney(nb.bal); if (!nb.name.trim() || v === null) return say("Enter a name and a valid balance."); const { error } = await supabase.from("budgets").insert({ name: nb.name.trim(), starting_balance: v }); if (error) say(error.message); else { say("Budget created"); setNb({ name: "", bal: "" }); setBid(""); loadBudgets(); } }}>Create</GoldButton></section>
        {b && <>
        <section className="space-y-3"><h2 className="font-semibold text-yellow-400">Planned expenses</h2>
          {cats.length === 0 && <p className="text-gray-500">No categories yet. Add your first below.</p>}
          {cats.map(c => { const s = exps.filter(e => e.category_id === c.id).reduce((t, e) => t + Number(e.amount), 0); const pct = Math.min(100, (s / c.amount) * 100 || 0);
            return <div key={c.id}><div className="flex justify-between text-sm"><span>{c.name}</span><span className={s > c.amount ? "text-red-400" : ""}>{money(s)} / {money(c.amount)}</span></div>
              <div className="h-2 rounded bg-white/10"><motion.div className={`h-2 rounded ${s > c.amount ? "bg-red-500" : pct > 80 ? "bg-yellow-300" : "bg-gold"}`} animate={{ width: pct + "%" }} /></div>
              <button className="py-2 pr-4 text-xs text-gray-400" onClick={() => setEc({ id: c.id, name: c.name, amt: groupDigits(String(c.amount)) })}>edit</button><button className="py-2 text-xs text-gray-400" onClick={() => del("planned_categories", c.id)}>delete</button></div>; })}
          <div className="flex gap-2"><input className={input} aria-label="Category name" value={nc.name} placeholder="Category" onChange={e => setNc({ ...nc, name: e.target.value })} /><input className={input} aria-label="Category amount" value={nc.amt} inputMode="numeric" placeholder="Amount" onChange={e => setNc({ ...nc, amt: e.target.value })} /></div>
          <GoldButton onClick={async () => { const v = parseMoney(nc.amt); if (!nc.name.trim() || v === null) return say("Enter a name and a valid amount."); const { error } = await supabase.from("planned_categories").insert({ budget_id: bid, name: nc.name.trim(), amount: v }); if (error) say(error.message); else { setNc({ name: "", amt: "" }); loadDetail(); } }}>Add category</GoldButton></section>
        </>}
      </>}
      {tab === "reports" && <Reports onChanged={loadDetail} />}
      {tab === "reserves" && <Reserves Btn={GoldButton} input={input} say={say} />}
      {ask && <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Confirm delete" onKeyDown={e => e.key === "Escape" && setAsk(null)}>
        <div className="glass-strong w-full max-w-sm space-y-3 rounded-3xl p-5"><p className="font-semibold">Delete this?</p><p className="text-sm text-gray-400">{ask.table === "planned_categories" ? "This also deletes its logged expenses. You can undo for a few seconds." : "You can undo for a few seconds."}</p>
          <div className="flex gap-2"><button autoFocus className="glass flex-1 rounded-2xl p-3" onClick={() => setAsk(null)}>Cancel</button><button className="flex-1 rounded-2xl bg-red-500 p-3 font-semibold" onClick={doDel}>Delete</button></div></div></div>}
      {settings && <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Profile and settings" onKeyDown={e => e.key === "Escape" && setSettings(false)}>
        <div className="glass-strong max-h-[92vh] w-full max-w-sm space-y-4 overflow-y-auto rounded-3xl p-5"><h2 className="font-semibold text-yellow-400">Profile &amp; settings</h2>
          <div className="flex items-center gap-4"><Avatar url={prof.avatar_url} name={shown} size={72} />
            <div className="space-y-2 text-sm"><label className="glass block cursor-pointer rounded-xl px-3 py-2">{prof.avatar_url ? "Replace photo" : "Upload photo"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => upload(e.target.files?.[0])} /></label>
              {prof.avatar_url && <button className="text-red-300" onClick={removePhoto}>Remove photo</button>}</div></div>
          <label className="block text-sm text-gray-300">Username<input className={input} value={uname} onChange={e => setUname(e.target.value)} /></label>
          <GoldButton onClick={saveName}>Save</GoldButton>
          <div className="space-y-2"><p className="text-sm text-gray-300">Appearance</p>
            <div className="flex gap-2" role="radiogroup" aria-label="Theme">{(["dark", "light", "system"] as const).map(t => <button key={t} role="radio" aria-checked={theme === t} className={`flex-1 rounded-xl p-2 text-sm capitalize ${theme === t ? "bg-gold text-black" : "glass"}`} onClick={() => setLook(t, accent)}>{t}</button>)}</div>
            <div className="flex gap-2" role="radiogroup" aria-label="Accent color">{ACCENTS.map(c => <button key={c} role="radio" aria-checked={accent === c} aria-label={`Accent ${c}`} style={{ background: c }} className={`h-9 w-9 rounded-full ${accent === c ? "ring-2 ring-white" : ""}`} onClick={() => setLook(theme, c)} />)}</div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={haptics} onChange={e => { setHaptics(e.target.checked); localStorage.setItem("kk-haptics", e.target.checked ? "on" : "off"); }} /> Haptic feedback</label></div>
          <div className="space-y-2 border-t border-white/10 pt-3"><button className="text-sm text-red-300" onClick={() => setDanger(!danger)}>Delete my account and data</button>
            {danger && <><p className="text-sm text-gray-300">This permanently deletes your account, budgets, expenses, reserves and photo. Type DELETE to confirm.</p>
              <input className={input} aria-label="Type DELETE to confirm" value={typed} onChange={e => setTyped(e.target.value)} />
              <button disabled={typed !== "DELETE"} className="w-full rounded-2xl bg-red-500 p-3 font-semibold disabled:opacity-40" onClick={deleteAccount}>Permanently delete</button></>}</div>
          <button className="w-full rounded-2xl p-2 text-gray-400" onClick={() => setSettings(false)}>Close</button></div></div>}
      {b && <button aria-label="Add expense (N)" className="fixed bottom-24 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-3xl font-light text-black shadow-[0_8px_30px_rgb(255_215_0/.4)]" onClick={openNew}>+</button>}
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
      <nav aria-label="Main" className="glass fixed bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1 rounded-full p-1.5" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        {([["home", "Home"], ["plan", "Plan"], ["reserves", "Reserves"], ["reports", "Reports"]] as const).map(([k, l]) =>
          <button key={k} aria-current={tab === k ? "page" : undefined} className={`min-h-11 rounded-full px-4 text-sm font-medium ${tab === k ? "bg-gold text-black" : ""}`} onClick={() => setTab(k)}>{l}</button>)}</nav>
      {toast && <div role="status" className="fixed bottom-40 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-gold px-4 py-2 text-black">{toast}{undo && <button className="font-bold underline" onClick={async () => { await undo(); setToast(""); setUndo(null); }}>Undo</button>}</div>}
    </main>
  );
}

export default function Home() {
  const [session, setSession] = useState<boolean | null>(null);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((e, s) => { if (e === "PASSWORD_RECOVERY") setRecovery(true); setSession(!!s); });
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === null) return <p className="p-10 text-center text-gray-400">Loading…</p>;
  if (recovery) return <NewPassword done={() => setRecovery(false)} />;
  return session ? <Dashboard /> : <Auth />;
}
