"use client";
import { useEffect, useState, ComponentType } from "react";
import { motion } from "framer-motion";
import { LayoutGrid, SlidersHorizontal, Activity, Landmark, Receipt, Target, LineChart, Calculator, Wrench, BarChart3, Globe, Settings } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Avatar, { resizeImage } from "@/components/Avatar";
import { setDisplay } from "@/lib/money";
import { useRates, convert, COUNTRIES } from "@/lib/fx";
import { GoldButton, Logo, input, SayFn } from "@/components/ui";
import Overview from "@/components/Overview";
import Budgets from "@/components/Budgets";
import Forex from "@/components/Forex";
import Tools from "@/components/Tools";
import Reserves from "@/components/Reserves";
import Reports from "@/components/Reports";
import { CashFlow, DebtHub, Wealth, Planning, Region } from "@/components/Finance";

const NAV = [["home", "Overview"], ["plan", "Budgets"], ["cash", "Cash flow"], ["wealth", "Wealth"], ["debt", "Debt"], ["reserves", "Goals"], ["markets", "Markets"], ["planning", "Planning"], ["tools", "Tools"], ["reports", "Reports"], ["region", "Region"]] as const;
type Tab = (typeof NAV)[number][0];
const ICON: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = { home: LayoutGrid, plan: SlidersHorizontal, cash: Activity, wealth: Landmark, debt: Receipt, reserves: Target, markets: LineChart, planning: Calculator, tools: Wrench, reports: BarChart3, region: Globe, settings: Settings };
const Ico = ({ k, size = 22 }: { k: string; size?: number }) => { const I = ICON[k]; return <I size={size} strokeWidth={1.7} aria-hidden />; };
const ACCENTS = ["#FFD700", "#A78BFA", "#FFB020", "#34D399", "#38BDF8", "#FB7185"];
const applyTheme = (t: string, a: string) => { const d = t === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t; document.documentElement.dataset.theme = d; document.documentElement.style.setProperty("--accent", a || "#FFD700"); localStorage.setItem("kk2-theme", t); localStorage.setItem("kk2-accent", a || ""); };

function Auth() {
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [f, setF] = useState({ email: "", password: "", username: "", phone: "+256" });
  const [msg, setMsg] = useState(""); const [show, setShow] = useState(false); const [canResend, setCanResend] = useState(false);
  const submit = async () => {
    setMsg(""); setCanResend(false);
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setMsg("Enter a valid email address.");
    if (mode === "forgot") { const { error } = await supabase.auth.resetPasswordForEmail(f.email, { redirectTo: window.location.origin }); return setMsg(error ? error.message : "If that email has an account, a reset link is on its way."); }
    if (f.password.length < 8) return setMsg("Password must be at least 8 characters.");
    if (mode === "up") {
      if (!/^\+256\d{9}$/.test(f.phone)) return setMsg("Phone must look like +256700000000");
      const { error } = await supabase.auth.signUp({ email: f.email, password: f.password, options: { data: { username: f.username, phone: f.phone } } });
      setMsg(error ? error.message : "Check your email to verify your account, then log in."); if (!error) setCanResend(true);
    } else { const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password }); if (error) { setMsg(error.message); if (/confirm/i.test(error.message)) setCanResend(true); } }
  };
  const resend = async () => { const { error } = await supabase.auth.resend({ type: "signup", email: f.email }); setMsg(error ? error.message : "Verification email sent again."); };
  return (
    <main className="mx-auto max-w-sm space-y-3 p-6 pt-20"><Logo />
      {mode === "up" && <><input className={input} aria-label="Username" placeholder="Username" onChange={e => setF({ ...f, username: e.target.value })} /><input className={input} aria-label="Phone" placeholder="+256 phone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></>}
      <input className={input} type="email" aria-label="Email" placeholder="Email" onChange={e => setF({ ...f, email: e.target.value })} />
      {mode !== "forgot" && <div className="relative"><input className={input} type={show ? "text" : "password"} aria-label="Password" placeholder="Password (8+ characters)" onChange={e => setF({ ...f, password: e.target.value })} /><button type="button" className="absolute right-3 top-3 text-sm text-gray-400" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button></div>}
      <GoldButton onClick={submit}>{mode === "up" ? "Sign up" : mode === "forgot" ? "Send reset link" : "Log in"}</GoldButton>
      {msg && <p role="alert" className="text-sm text-yellow-300">{msg}</p>}
      {canResend && <button className="text-sm text-yellow-300 underline" onClick={resend}>Resend verification email</button>}
      <div className="flex justify-between text-sm text-gray-400"><button onClick={() => { setMode(mode === "up" ? "in" : "up"); setMsg(""); }}>{mode === "up" ? "Have an account? Log in" : "New here? Sign up"}</button>
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
      <GoldButton onClick={async () => { if (a.length < 8) return setMsg("Password must be at least 8 characters."); if (a !== b) return setMsg("Passwords don't match."); const { error } = await supabase.auth.updateUser({ password: a }); if (error) setMsg(error.message); else done(); }}>Update password</GoldButton>
      {msg && <p role="alert" className="text-sm text-yellow-300">{msg}</p>}
    </main>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>("home");
  const [toast, setToast] = useState(""); const [undo, setUndo] = useState<null | (() => Promise<void>)>(null);
  const [prof, setProf] = useState<{ username: string | null; avatar_url: string | null }>({ username: null, avatar_url: null });
  const [email, setEmail] = useState(""); const [uid, setUid] = useState(""); const [uname, setUname] = useState("");
  const [menu, setMenu] = useState(false); const [settings, setSettings] = useState(false);
  const [theme, setTheme] = useState("light"); const [accent, setAccent] = useState("#FFD700");
  const [haptics, setHaptics] = useState(() => localStorage.getItem("kk-haptics") !== "off");
  const [danger, setDanger] = useState(false); const [typed, setTyped] = useState("");
  const rt = useRates();
  const [display, setDisplayCur] = useState(() => localStorage.getItem("kk2-display") || "UGX");
  const [country, setCountry] = useState(""); const [profLoaded, setProfLoaded] = useState(false);
  const [skipCountry, setSkipCountry] = useState(() => localStorage.getItem("kk2-country-skip") === "1");
  setDisplay(display, convert(1, "UGX", display, rt.rates));
  const say: SayFn = (m, u) => { setToast(m); setUndo(u ? () => u : null); setTimeout(() => { setToast(""); setUndo(null); }, u ? 7000 : 2500); };

  useEffect(() => { (async () => {
    const { data: u } = await supabase.auth.getUser(); if (!u.user) return;
    setUid(u.user.id); setEmail(u.user.email ?? "");
    await supabase.from("profiles").upsert({ id: u.user.id }, { onConflict: "id", ignoreDuplicates: true });
    const { data } = await supabase.from("profiles").select("username,avatar_url,theme,accent,country").eq("id", u.user.id).single();
    if (data) { setCountry(data.country ?? ""); setProf({ username: data.username, avatar_url: data.avatar_url }); setUname(data.username ?? "");
      const t = localStorage.getItem("kk2-theme") ?? (data.theme && data.theme !== "dark" ? data.theme : "light"), a = localStorage.getItem("kk2-accent") || data.accent || "#FFD700"; setTheme(t); setAccent(a); applyTheme(t, a); }
    setProfLoaded(true);
  })(); }, []);
  const saveName = async () => { const { error } = await supabase.from("profiles").update({ username: uname.trim() || null }).eq("id", uid); if (error) say(error.code === "23505" ? "That username is taken." : error.message); else { setProf({ ...prof, username: uname.trim() || null }); say("Profile saved"); } };
  const upload = async (f?: File) => {
    if (!f) return;
    try { const blob = await resizeImage(f), path = `${uid}/avatar.webp`; const { error } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/webp" }); if (error) throw error;
      const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl + "?v=" + Date.now(); await supabase.from("profiles").update({ avatar_url: url }).eq("id", uid); setProf(p => ({ ...p, avatar_url: url })); say("Photo updated"); }
    catch (e: any) { say(e.message ?? "Upload failed"); }
  };
  const removePhoto = async () => { await supabase.storage.from("avatars").remove([`${uid}/avatar.webp`]); await supabase.from("profiles").update({ avatar_url: null }).eq("id", uid); setProf(p => ({ ...p, avatar_url: null })); say("Photo removed"); };
  const chooseCountry = async (c: string) => { setCountry(c); if (uid) await supabase.from("profiles").update({ country: c }).eq("id", uid); };
  const chooseDisplay = (c: string) => { setDisplayCur(c); localStorage.setItem("kk2-display", c); };
  const setLook = async (t: string, a: string) => { setTheme(t); setAccent(a); applyTheme(t, a); if (uid) await supabase.from("profiles").update({ theme: t, accent: a }).eq("id", uid); };
  const deleteAccount = async () => { await supabase.storage.from("avatars").remove([`${uid}/avatar.webp`]); const { error } = await supabase.rpc("delete_my_account"); if (error) return say(error.message); localStorage.clear(); await supabase.auth.signOut(); };
  const shown = prof.username || email.split("@")[0] || "there";

  return (
    <main className="mx-auto max-w-lg space-y-5 p-4 pb-32 md:max-w-7xl md:pb-10 md:pl-24 xl:pl-[17.5rem]">
      <header className="relative flex items-center justify-between"><span className="md:hidden"><Logo /></span><span className="hidden md:block" />
        <button aria-label="Account menu" aria-expanded={menu} className="rounded-full ring-2 ring-yellow-400/60" onClick={() => setMenu(!menu)}><Avatar url={prof.avatar_url} name={shown} size={44} /></button>
        {menu && <div role="menu" className="glass-strong absolute right-0 top-14 z-20 w-64 space-y-1 rounded-3xl p-3" onKeyDown={e => e.key === "Escape" && setMenu(false)}>
          <div className="flex items-center gap-3 p-2"><Avatar url={prof.avatar_url} name={shown} size={40} /><div className="min-w-0"><p className="truncate font-semibold">{shown}</p><p className="truncate text-xs text-gray-400">{email}</p></div></div>
          <button role="menuitem" className="w-full rounded-xl p-2 text-left hover:bg-white/10" onClick={() => { setMenu(false); setSettings(true); }}>Profile &amp; settings</button>
          <button role="menuitem" className="w-full rounded-xl p-2 text-left hover:bg-white/10" onClick={() => supabase.auth.signOut()}>Log out</button></div>}
      </header>

      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {tab === "home" && <Overview rates={rt.rates} name={shown} go={t => setTab(t as Tab)} />}
        {tab === "plan" && <Budgets say={say} />}
        {tab === "cash" && <CashFlow Btn={GoldButton} say={say} rates={rt.rates} />}
        {tab === "wealth" && <Wealth Btn={GoldButton} say={say} rates={rt.rates} />}
        {tab === "debt" && <DebtHub Btn={GoldButton} say={say} />}
        {tab === "reserves" && <Reserves Btn={GoldButton} input={input} say={say} />}
        {tab === "markets" && <Forex />}
        {tab === "planning" && <Planning />}
        {tab === "tools" && <Tools />}
        {tab === "reports" && <Reports />}
        {tab === "region" && <Region rates={rt.rates} live={rt.live} country={country} onCountry={chooseCountry} display={display} onDisplay={chooseDisplay} say={say} />}
      </motion.div>

      {settings && <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Profile and settings" onKeyDown={e => e.key === "Escape" && setSettings(false)}>
        <div className="glass-strong max-h-[92vh] w-full max-w-sm space-y-4 overflow-y-auto rounded-3xl p-5"><h2 className="font-semibold text-yellow-400">Profile &amp; settings</h2>
          <div className="flex items-center gap-4"><Avatar url={prof.avatar_url} name={shown} size={72} /><div className="space-y-2 text-sm"><label className="glass block cursor-pointer rounded-xl px-3 py-2">{prof.avatar_url ? "Replace photo" : "Upload photo"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => upload(e.target.files?.[0])} /></label>{prof.avatar_url && <button className="text-red-300" onClick={removePhoto}>Remove photo</button>}</div></div>
          <label className="block text-sm text-gray-300">Username<input className={input} value={uname} onChange={e => setUname(e.target.value)} /></label>
          <GoldButton onClick={saveName}>Save</GoldButton>
          <div className="space-y-2"><p className="text-sm text-gray-300">Appearance</p>
            <div className="flex gap-2" role="radiogroup" aria-label="Theme">{(["dark", "light", "system"] as const).map(t => <button key={t} role="radio" aria-checked={theme === t} className={`flex-1 rounded-xl p-2 text-sm capitalize ${theme === t ? "bg-gold text-black" : "glass"}`} onClick={() => setLook(t, accent)}>{t}</button>)}</div>
            <div className="flex gap-2" role="radiogroup" aria-label="Accent color">{ACCENTS.map(c => <button key={c} role="radio" aria-checked={accent === c} aria-label={`Accent ${c}`} style={{ background: c }} className={`h-9 w-9 rounded-full ${accent === c ? "ring-2 ring-white" : ""}`} onClick={() => setLook(theme, c)} />)}</div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={haptics} onChange={e => { setHaptics(e.target.checked); localStorage.setItem("kk-haptics", e.target.checked ? "on" : "off"); }} /> Haptic feedback</label></div>
          <div className="space-y-2 border-t border-white/10 pt-3"><button className="text-sm text-red-300" onClick={() => setDanger(!danger)}>Delete my account and data</button>
            {danger && <><p className="text-sm text-gray-300">This permanently deletes your account, budgets, expenses, reserves and photo. Type DELETE to confirm.</p><input className={input} aria-label="Type DELETE to confirm" value={typed} onChange={e => setTyped(e.target.value)} />
              <button disabled={typed !== "DELETE"} className="w-full rounded-2xl bg-red-500 p-3 font-semibold text-white disabled:opacity-40" onClick={deleteAccount}>Permanently delete</button></>}</div>
          <button className="w-full rounded-2xl p-2 text-gray-400" onClick={() => setSettings(false)}>Close</button></div></div>}

      <nav aria-label="Main" className="glass fixed bottom-3 left-1/2 z-20 flex max-w-[94vw] -translate-x-1/2 gap-1 overflow-x-auto rounded-full p-1.5 md:hidden" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        {NAV.map(([k, l]) => <button key={k} aria-current={tab === k ? "page" : undefined} className={`flex min-h-12 shrink-0 flex-col items-center justify-center rounded-full px-3 text-[11px] font-medium ${tab === k ? "bg-gold text-black" : ""}`} onClick={() => setTab(k)}><Ico k={k} size={20} />{l}</button>)}</nav>
      <aside aria-label="Sidebar" className="glass fixed bottom-4 left-4 top-4 z-20 hidden w-16 flex-col rounded-3xl p-2 md:flex xl:w-60 xl:p-4">
        <div className="mb-4 hidden px-2 xl:block"><Logo /><p className="text-xs text-gray-400">Personal finance suite</p></div><div className="mb-4 mt-1 text-center xl:hidden"><span className="gold-text text-xl font-extrabold">kk</span></div>
        <nav aria-label="Main" className="space-y-1 overflow-y-auto">{NAV.map(([k, l]) => <button key={k} title={l} aria-label={l} aria-current={tab === k ? "page" : undefined} style={tab === k ? { background: "color-mix(in srgb, var(--accent) 30%, transparent)" } : undefined} className="flex w-full items-center justify-center gap-3 rounded-2xl px-3 py-3 text-left font-medium hover:bg-white/10 xl:justify-start" onClick={() => setTab(k)}><Ico k={k} /><span className="hidden xl:inline">{l}</span></button>)}</nav>
        <button aria-label="Profile and settings" className="glass mt-auto flex items-center justify-center gap-3 rounded-2xl p-2 text-left xl:justify-start xl:p-3" onClick={() => setSettings(true)}><Avatar url={prof.avatar_url} name={shown} size={36} /><span className="hidden min-w-0 flex-1 xl:block"><span className="block truncate text-sm font-semibold">{shown}</span><span className="block text-xs text-gray-400">Profile &amp; settings</span></span><span className="hidden xl:block"><Ico k="settings" /></span></button>
      </aside>
      {profLoaded && !country && !skipCountry && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Choose your country">
        <div className="glass-strong w-full max-w-sm space-y-3 rounded-3xl p-5"><h2 className="flex items-center gap-2 font-semibold"><Globe size={18} />Where are you based?</h2><p className="text-sm text-gray-400">This sets your regional context, such as local currency and tax authority. You can change it any time under Region.</p>
          <select className={input} aria-label="Country" defaultValue="" onChange={e => { if (e.target.value) chooseCountry(e.target.value); }}><option value="">Select a country</option>{COUNTRIES.map(x => <option key={x.code} value={x.code}>{x.name}</option>)}</select>
          <button className="w-full p-2 text-sm text-gray-400" onClick={() => { localStorage.setItem("kk2-country-skip", "1"); setSkipCountry(true); }}>Skip for now</button></div></div>}
      {toast && <div role="status" className="fixed bottom-24 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-gold px-4 py-2 text-black md:bottom-8">{toast}{undo && <button className="font-bold underline" onClick={async () => { await undo(); setToast(""); setUndo(null); }}>Undo</button>}</div>}
    </main>
  );
}

export default function Home() {
  const [session, setSession] = useState<boolean | null>(null); const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((e, s) => { if (e === "PASSWORD_RECOVERY") setRecovery(true); setSession(!!s); });
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === null) return <p className="p-10 text-center text-gray-400">Loading…</p>;
  if (recovery) return <NewPassword done={() => setRecovery(false)} />;
  return session ? <Shell /> : <Auth />;
}
