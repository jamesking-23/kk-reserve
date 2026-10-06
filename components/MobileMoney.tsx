"use client";
import { useEffect, useState, useCallback } from "react";
import { RefreshCw, CheckCircle2, XCircle, Clock, Lock, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fmtIn, groupDigits } from "@/lib/money";

type Tx = { id: string; provider: "mtn" | "airtel"; reference_id: string; amount: number; currency: string; payer_hint: string | null; note: string | null; status: "PENDING" | "SUCCESSFUL" | "FAILED"; reason: string | null; created_at: string };
const input = "glass w-full rounded-2xl p-3 outline-none focus:border-yellow-400";

async function api(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "Request failed");
  return j;
}
const StatusIcon = ({ s }: { s: Tx["status"] }) => s === "SUCCESSFUL" ? <CheckCircle2 size={18} className="text-green-400" aria-label="Successful" /> : s === "FAILED" ? <XCircle size={18} className="text-red-400" aria-label="Failed" /> : <Clock size={18} className="text-yellow-400" aria-label="Pending" />;

export default function MobileMoney({ say }: { say: (m: string) => void }) {
  const [rows, setRows] = useState<Tx[]>([]);
  const [f, setF] = useState({ phone: "", amount: "", note: "" });
  const [bal, setBal] = useState<string>(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const { data } = await supabase.from("mobile_money_transactions").select("*").order("created_at", { ascending: false }).limit(50); setRows((data ?? []) as Tx[]); }, []);
  useEffect(() => { load(); }, [load]);
  const refresh = useCallback(async (t: Tx) => { try { await api(`/api/mobile-money/${t.provider}/status`, { method: "POST", body: JSON.stringify({ reference: t.reference_id }) }); } catch (e) { say((e as Error).message); } await load(); }, [load, say]);
  const pending = rows.filter(r => r.status === "PENDING" && r.provider === "mtn");
  useEffect(() => { if (!pending.length) return; const id = setInterval(() => pending.forEach(refresh), 10000); return () => clearInterval(id); }, [pending.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const collect = async () => {
    setBusy(true);
    try { await api("/api/mobile-money/mtn/collect", { method: "POST", body: JSON.stringify({ phone: f.phone, amount: f.amount, note: f.note }) }); setF({ ...f, amount: "", note: "" }); say("Payment request sent"); }
    catch (e) { say((e as Error).message); }
    setBusy(false); load();
  };
  const balance = async () => { try { const j = await api("/api/mobile-money/mtn/balance"); setBal(fmtIn(Number(j.availableBalance), j.currency)); } catch (e) { say((e as Error).message); } };

  return (
    <div className="space-y-3">
      <div className="surface space-y-3 rounded-3xl p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">MTN Mobile Money</h3><p className="text-sm text-gray-400">Sandbox. Collect payments and track each request until it succeeds or fails.</p></div>
        <button className="glass inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm" onClick={balance}><Wallet size={14} />{bal || "Wallet balance"}</button></div>
        <div className="grid gap-2 sm:grid-cols-2"><input className={input} aria-label="Payer phone number" inputMode="numeric" placeholder="Phone, digits only (sandbox: 46733123450)" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
          <input className={input} aria-label="Amount" inputMode="decimal" placeholder="Amount" value={f.amount} onChange={e => setF({ ...f, amount: groupDigits(e.target.value) })} /></div>
        <input className={input} aria-label="Note" placeholder="Note (optional)" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
        <button disabled={busy} className="w-full rounded-2xl bg-gold px-4 py-3 font-semibold text-black disabled:opacity-50" onClick={collect}>{busy ? "Sending..." : "Request payment"}</button></div>
      <div className="surface flex items-start gap-3 rounded-3xl p-4 opacity-70"><Lock size={18} className="mt-0.5 shrink-0" /><div><h3 className="font-semibold">Airtel Money</h3><p className="text-sm text-gray-400">Not connected yet. The server framework is ready; it will activate once Airtel API credentials are added.</p></div></div>
      <div className="surface space-y-2 rounded-3xl p-4"><div className="flex items-center justify-between"><h3 className="font-semibold">Tracked transactions</h3><button aria-label="Refresh" className="p-2" onClick={() => { pending.forEach(refresh); load(); }}><RefreshCw size={16} /></button></div>
        {rows.length === 0 && <p className="text-sm text-gray-400">No mobile money transactions yet.</p>}
        {rows.map(t => <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 text-sm"><StatusIcon s={t.status} />
          <div className="min-w-0 flex-1"><p className="font-medium">{fmtIn(Number(t.amount), t.currency)} <span className="font-normal text-gray-400">from ...{t.payer_hint ?? "----"}</span></p><p className="truncate text-xs text-gray-400">{t.provider.toUpperCase()} - {new Date(t.created_at).toLocaleString("en-UG")}{t.reason ? ` - ${t.reason}` : ""}{t.note ? ` - ${t.note}` : ""}</p></div>
          {t.status === "PENDING" && <button className="glass rounded-lg px-2 py-1 text-xs" onClick={() => refresh(t)}>Check</button>}</div>)}</div>
    </div>
  );
}
