"use client";
import { useState, ReactNode } from "react";
import { fmt, toDisplay } from "@/lib/money";

export const PALETTE = ["#F472B6", "#A78BFA", "#60A5FA", "#34D399", "#FBBF24", "#C4B5FD"];
export const UNPLANNED = "#FB923C";
const compact = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(Math.round(n)));
// Smooth path through points using horizontal-tangent cubic segments.
const smooth = (p: [number, number][]) => p.reduce((d, [x, y], i) => (i === 0 ? `M${x},${y}` : `${d} C${(p[i - 1][0] + x) / 2},${p[i - 1][1]} ${(p[i - 1][0] + x) / 2},${y} ${x},${y}`), "");

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="h-11" />;
  const w = 140, h = 44, max = Math.max(...values), min = Math.min(...values), span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 5 - ((v - min) / span) * (h - 12)] as [number, number]);
  const line = smooth(pts), id = "sg" + color.slice(1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-2 h-11 w-full" aria-hidden>
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".3" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} /><path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Stat({ title, value, icon, tint, series, color, foot }: { title: string; value: string; icon: ReactNode; tint: string; series: number[]; color: string; foot?: ReactNode }) {
  return (
    <div className="surface rounded-3xl p-4">
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm text-gray-400">{title}</p><p className="mt-1 truncate text-2xl font-bold tracking-tight">{value}</p></div>
        <span aria-hidden className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-xl ${tint}`}>{icon}</span></div>
      {foot && <div className="mt-1 text-sm">{foot}</div>}
      <Sparkline values={series} color={color} />
    </div>
  );
}

export function AreaChart({ data, color = "#8B5CF6" }: { data: { label: string; value: number }[]; color?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 480, H = 190, L = 46, R = 12, T = 16, B = 26, n = data.length;
  const top = Math.max(...data.map(d => d.value), 1) * 1.15;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(n - 1, 1), y = (v: number) => T + (H - T - B) * (1 - v / top);
  const pts = data.map((d, i) => [x(i), y(d.value)] as [number, number]), line = smooth(pts);
  const step = Math.ceil(n / 7), hv = hover !== null ? data[hover] : null;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Spending over ${n} days. Highest day ${fmt(Math.max(...data.map(d => d.value)))}.`}
        onPointerMove={e => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHover(Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1))))); }} onPointerLeave={() => setHover(null)}>
        <defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {[0, 0.5, 1].map(t => <g key={t}><line x1={L} x2={W - R} y1={y(top * t)} y2={y(top * t)} stroke="currentColor" strokeOpacity=".12" /><text x={L - 6} y={y(top * t) + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity=".55">{compact(toDisplay(top * t))}</text></g>)}
        {n > 1 && <><path d={`${line} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="url(#areaFill)" /><path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" /></>}
        {data.map((d, i) => i % step === 0 && <text key={i} x={x(i)} y={H - 7} textAnchor="middle" fontSize="10" fill="currentColor" opacity=".55">{d.label}</text>)}
        {hv && hover !== null && <g><line x1={x(hover)} x2={x(hover)} y1={T} y2={y(0)} stroke={color} strokeDasharray="3 3" opacity=".6" /><circle cx={x(hover)} cy={y(hv.value)} r="5" fill={color} stroke="#fff" strokeWidth="2" />
          <g transform={`translate(${Math.min(Math.max(x(hover) - 50, 2), W - 102)},${Math.max(y(hv.value) - 46, 0)})`}><rect width="100" height="36" rx="10" fill="#1b1b3a" opacity=".92" /><text x="50" y="14" textAnchor="middle" fontSize="10" fill="#fff" opacity=".7">{hv.label}</text><text x="50" y="28" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">{fmt(hv.value)}</text></g></g>}
      </svg>
    </div>
  );
}

export function Donut({ slices, total }: { slices: { label: string; value: number; color: string }[]; total: number }) {
  const r = 62, C = 2 * Math.PI * r; let acc = 0;
  return (
    <svg viewBox="0 0 180 180" className="mx-auto h-44 w-44" role="img" aria-label={`Expenses by category, total ${fmt(total)}`}>
      <circle cx="90" cy="90" r={r} fill="none" stroke="currentColor" strokeOpacity=".1" strokeWidth="26" />
      {total > 0 && slices.filter(s => s.value > 0).map(s => { const len = (s.value / total) * C, off = acc; acc += len;
        return <circle key={s.label} cx="90" cy="90" r={r} fill="none" stroke={s.color} strokeWidth="26" strokeDasharray={`${Math.max(len - 2, 0)} ${C - Math.max(len - 2, 0)}`} strokeDashoffset={-off} transform="rotate(-90 90 90)" />; })}
      <text x="90" y="86" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">{Math.round(toDisplay(total)).toLocaleString()}</text>
      <text x="90" y="104" textAnchor="middle" fontSize="10" fill="currentColor" opacity=".6">Total spent</text>
    </svg>
  );
}
