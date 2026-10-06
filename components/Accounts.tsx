"use client";
import { useState } from "react";
import { RefreshCw, Lock, Wallet, Info } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fmtIn } from "@/lib/money";

async function getBalance(provider: string) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`/api/mobile-money/${provider}/balance`, { headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "Could not load the balance.");
  return j as { availableBalance: string; currency: string };
}

// Read-only view of connected accounts. Nothing here can send, request or process money.
export default function Accounts() {
  const [bal, setBal] = useState<{ text: string; at: string } | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true); setErr("");
    try { const j = await getBalance("mtn"); setBal({ text: fmtIn(Number(j.availableBalance), j.currency), at: new Date().toLocaleTimeString("en-UG") }); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <div className="space-y-4">
      <div><h2 className="text-2xl font-bold tracking-tight">Connected accounts</h2><p className="text-sm text-gray-400">Read-only balances from linked providers.</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <div className="surface space-y-3 rounded-3xl p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">MTN Mobile Money (sandbox)</h3><p className="text-sm text-gray-400">Collection account balance.</p></div>
            <button disabled={busy} className="glass inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm disabled:opacity-50" onClick={load}><RefreshCw size={14} />{bal ? "Refresh" : "Load balance"}</button></div>
            {bal && <div className="flex items-center gap-3"><Wallet size={22} /><div><p className="text-2xl font-bold tracking-tight">{bal.text}</p><p className="text-xs text-gray-400">As of {bal.at}</p></div></div>}
            {err && <p role="alert" className="text-sm text-red-400">{err}</p>}</div>
          <div className="surface flex items-start gap-3 rounded-3xl p-4 opacity-70"><Lock size={18} className="mt-0.5 shrink-0" /><div><h3 className="font-semibold">Airtel Money</h3><p className="text-sm text-gray-400">Not connected yet. It will appear here once Airtel API access is added.</p></div></div>
        </div>
        <aside className="space-y-4"><div className="surface space-y-2 rounded-3xl p-4 text-sm"><h3 className="flex items-center gap-2 font-semibold"><Info size={16} />How this works</h3>
          <p className="text-gray-400">This app only reads information. It never sends, requests or processes money.</p>
          <p className="text-gray-400">MTN's API does not provide a statement or transaction history for this account, so only the balance is shown. To see your own wallets in your totals, add them as accounts under Wealth.</p></div></aside>
      </div>
    </div>
  );
}
