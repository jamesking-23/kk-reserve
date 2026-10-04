"use client";
import { useEffect, useState, useCallback, ComponentType, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { fmt, parseMoney, groupDigits } from "@/lib/money";

type R = { id: string; name: string; target_amount: number; target_date: string | null };
type C = { id: string; reserve_id: string; amount: number };
type Btn = ComponentType<{ children: ReactNode; onClick: () => Promise<void> | void }>;

// Savings goals. A reserve's saved total is DERIVED from its contributions (never stored), so it can't drift.
export default function Reserves({ Btn, input, say }: { Btn: Btn; input: string; say: (m: string) => void }) {
  const [rs, setRs] = useState<R[]>([]);
  const [cs, setCs] = useState<C[]>([]);
  const [nr, setNr] = useState({ name: "", target: "", date: "" });
  const [amt, setAmt] = useState<Record<string, string>>({});
  const [ask, setAsk] = useState<R | null>(null);
  const load = useCallback(async () => {
    const [r, c] = await Promise.all([
      supabase.from("reserves").select("id,name,target_amount,target_date").eq("archived", false).order("created_at"),
      supabase.from("reserve_contributions").select("id,reserve_id,amount")]);
    setRs(r.data ?? []); setCs(c.data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);
  const saved = (id: string) => cs.filter(c => c.reserve_id === id).reduce((t, c) => t + Number(c.amount), 0);

  const create = async () => {
    const t = parseMoney(nr.target);
    if (!nr.name.trim() || t === null) return say("Enter a name and a valid target.");
    const { error } = await supabase.from("reserves").insert({ name: nr.name.trim(), target_amount: t, target_date: nr.date || null });
    if (error) return say(error.message);
    setNr({ name: "", target: "", date: "" }); load();
  };
  const contribute = async (r: R, sign: 1 | -1) => {
    const v = parseMoney(amt[r.id] ?? ""); if (v === null) return say("Enter a valid amount.");
    if (sign < 0 && v > saved(r.id)) return say("You can't withdraw more than is saved.");
    const { error } = await supabase.from("reserve_contributions").insert({ reserve_id: r.id, amount: sign * v });
    if (error) return say(error.message);
    setAmt({ ...amt, [r.id]: "" }); load();
    if (sign > 0 && saved(r.id) + v >= r.target_amount) say("🎉 Goal reached!");
  };
  const remove = async () => { if (!ask) return; await supabase.from("reserves").delete().eq("id", ask.id); setAsk(null); load(); say("Reserve deleted"); };

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-yellow-400">Reserves</h2>
      {rs.length === 0 && <p className="text-gray-500">No savings goals yet. Create your first below.</p>}
      {rs.map(r => { const s = saved(r.id); const pct = Math.min(100, (s / r.target_amount) * 100);
        const days = r.target_date ? Math.ceil((new Date(r.target_date).getTime() - Date.now()) / 864e5) : null;
        return <div key={r.id} className="surface space-y-2 rounded-3xl p-4">
          <div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{r.name} {s >= r.target_amount && "🏆"}</p>
            <p className="text-sm text-gray-400">{fmt(s)} of {fmt(r.target_amount)}{days !== null && (days >= 0 ? ` · ${days} days left` : " · past target date")}</p></div>
            <button aria-label={`Delete ${r.name}`} className="p-2 text-gray-400" onClick={() => setAsk(r)}>✕</button></div>
          <div className="h-2 rounded bg-white/10" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.name} progress`}><div className="h-2 rounded bg-gold" style={{ width: pct + "%" }} /></div>
          <div className="flex gap-2"><input className={input} aria-label={`Amount for ${r.name}`} inputMode="numeric" placeholder="Amount" value={amt[r.id] ?? ""} onChange={e => setAmt({ ...amt, [r.id]: groupDigits(e.target.value) })} />
            <button className="glass rounded-2xl px-4" onClick={() => contribute(r, -1)}>Withdraw</button></div>
          <Btn onClick={() => contribute(r, 1)}>Add to reserve</Btn></div>; })}
      <div className="glass space-y-2 rounded-3xl p-4"><h3 className="font-semibold">New reserve</h3>
        <input className={input} aria-label="Reserve name" placeholder="Name (e.g. Laptop)" value={nr.name} onChange={e => setNr({ ...nr, name: e.target.value })} />
        <input className={input} aria-label="Target amount" inputMode="numeric" placeholder="Target amount" value={nr.target} onChange={e => setNr({ ...nr, target: groupDigits(e.target.value) })} />
        <label className="block text-sm text-gray-300">Target date (optional)<input className={input} type="date" value={nr.date} onChange={e => setNr({ ...nr, date: e.target.value })} /></label>
        <Btn onClick={create}>Create reserve</Btn></div>
      {ask && <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Confirm delete reserve" onKeyDown={e => e.key === "Escape" && setAsk(null)}>
        <div className="glass-strong w-full max-w-sm space-y-3 rounded-3xl p-5"><p className="font-semibold">Delete “{ask.name}”?</p><p className="text-sm text-gray-400">Its saved history is deleted too. This cannot be undone.</p>
          <div className="flex gap-2"><button autoFocus className="glass flex-1 rounded-2xl p-3" onClick={() => setAsk(null)}>Cancel</button><button className="flex-1 rounded-2xl bg-red-500 p-3 font-semibold" onClick={remove}>Delete</button></div></div></div>}
    </section>
  );
}
