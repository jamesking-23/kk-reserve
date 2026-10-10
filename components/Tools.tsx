"use client";
import { useState } from "react";
import { fmt, groupDigits } from "@/lib/money";
import { amortize, futureValue, requiredMonthly } from "@/lib/finance";
import { AreaChart } from "@/components/Charts";
import { Section, input } from "@/components/ui";

const num = (s: string) => Number((s || "0").replace(/,/g, "")) || 0;
const Field = ({ label, v, set, money }: { label: string; v: string; set: (s: string) => void; money?: boolean }) => <label className="block text-xs text-gray-400">{label}<input className={input} inputMode="decimal" value={v} onChange={e => set(money ? groupDigits(e.target.value) : e.target.value)} /></label>;
const Box = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="surface space-y-3 rounded-3xl p-4"><h3 className="font-semibold">{title}</h3>{children}</div>;
const Stat = ({ l, v }: { l: string; v: string }) => <div><p className="text-xs text-gray-400">{l}</p><p className="text-lg font-bold tracking-tight">{v}</p></div>;

export default function Tools() {
  const [ln, setLn] = useState({ p: "50,000,000", apr: "18", yrs: "5", extra: "0" });
  const [gr, setGr] = useState({ init: "2,000,000", m: "300,000", apr: "10", yrs: "10", target: "100,000,000" });
  const L = amortize(num(ln.p), num(ln.apr), Math.max(1, num(ln.yrs)) * 12, num(ln.extra)), L0 = amortize(num(ln.p), num(ln.apr), Math.max(1, num(ln.yrs)) * 12, 0);
  const G = futureValue(num(gr.init), num(gr.m), num(gr.apr), Math.min(60, Math.max(1, Math.round(num(gr.yrs))))), end = G[G.length - 1];
  const need = requiredMonthly(num(gr.target), num(gr.init), num(gr.apr), Math.max(1, num(gr.yrs)));
  return (
    <Section title="Tools" sub="Calculators for loans, savings growth and goals. All figures are in your base currency.">
      <div className="grid gap-4 md:grid-cols-2">
        <Box title="Loan calculator"><div className="grid grid-cols-2 gap-2"><Field label="Loan amount" v={ln.p} set={v => setLn({ ...ln, p: v })} money /><Field label="Interest rate % a year" v={ln.apr} set={v => setLn({ ...ln, apr: v })} /><Field label="Term in years" v={ln.yrs} set={v => setLn({ ...ln, yrs: v })} /><Field label="Extra payment a month" v={ln.extra} set={v => setLn({ ...ln, extra: v })} money /></div>
          <div className="grid grid-cols-2 gap-3"><Stat l="Monthly payment" v={fmt(L.payment)} /><Stat l="Total interest" v={fmt(L.interest)} /><Stat l="Total repaid" v={fmt(L.totalPaid)} /><Stat l="Paid off in" v={`${Math.floor(L.months / 12)}y ${L.months % 12}m`} /></div>
          {num(ln.extra) > 0 && <p className="text-sm text-green-400">Extra payments save {fmt(Math.max(0, L0.interest - L.interest))} in interest and {Math.max(0, L0.months - L.months)} months.</p>}
          <AreaChart data={[{ label: "Start", value: num(ln.p) }, ...L.yearly.map(y => ({ label: `Y${y.year}`, value: y.balance }))]} /><p className="text-xs text-gray-400">Remaining balance by year.</p></Box>
        <Box title="Savings growth"><div className="grid grid-cols-2 gap-2"><Field label="Starting amount" v={gr.init} set={v => setGr({ ...gr, init: v })} money /><Field label="Monthly saving" v={gr.m} set={v => setGr({ ...gr, m: v })} money /><Field label="Return % a year" v={gr.apr} set={v => setGr({ ...gr, apr: v })} /><Field label="Years" v={gr.yrs} set={v => setGr({ ...gr, yrs: v })} /></div>
          <div className="grid grid-cols-2 gap-3"><Stat l="Value at the end" v={fmt(end.balance)} /><Stat l="You contributed" v={fmt(end.contributed)} /><Stat l="Growth earned" v={fmt(end.balance - end.contributed)} /></div>
          <AreaChart data={G.map(g => ({ label: `Y${g.year}`, value: g.balance }))} />
          <div className="border-t border-white/10 pt-3"><Field label="Goal amount" v={gr.target} set={v => setGr({ ...gr, target: v })} money /><p className="mt-2 text-sm">To reach it in {gr.yrs} years you would save <b>{fmt(need)}</b> a month.</p></div></Box>
      </div>
    </Section>
  );
}
