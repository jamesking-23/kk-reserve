// Client-side PDF reports drawn with vector graphics (no screenshots), so they stay sharp when printed or projected.
import { jsPDF } from "jspdf";
import { fmt, displayCurrency } from "../money";

type RGB = [number, number, number];
const NAVY: RGB = [27, 27, 58], GOLD: RGB = [255, 215, 0], GREY: RGB = [91, 91, 122], LIGHT: RGB = [244, 242, 252], LINE: RGB = [221, 218, 238];
const GREEN: RGB = [16, 185, 129], RED: RGB = [225, 29, 72], VIOLET: RGB = [139, 92, 246];
export const PDF_PALETTE: RGB[] = [[244, 114, 182], [139, 92, 246], [96, 165, 250], [52, 211, 153], [251, 191, 36], [196, 181, 253], [251, 146, 60]];
const clean = (s: string) => s.replace(/[  ]/g, " ").replace(/−/g, "-");
const money = (n: number) => clean(fmt(n));
const W = 210, M = 14;

function header(doc: jsPDF, title: string, sub: string) {
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 44, "F"); doc.setFillColor(...GOLD); doc.rect(0, 44, W, 2.2, "F");
  doc.setTextColor(...GOLD); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("KKINGG RESERVES", M, 12);
  doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.text(clean(title).slice(0, 48), M, 27);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(210, 206, 235); doc.text(clean(sub).slice(0, 110), M, 36);
}
function section(doc: jsPDF, y: number, text: string) {
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...NAVY); doc.text(text, M, y);
  doc.setFillColor(...GOLD); doc.rect(M, y + 1.8, 12, 0.9, "F");
}
function kpi(doc: jsPDF, x: number, y: number, w: number, label: string, value: string, color: RGB = NAVY) {
  doc.setFillColor(...LIGHT); doc.roundedRect(x, y, w, 24, 3, 3, "F"); doc.setFillColor(...color); doc.roundedRect(x, y, 1.8, 24, 0.9, 0.9, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GREY); doc.text(label.toUpperCase(), x + 5, y + 8);
  doc.setFont("helvetica", "bold"); doc.setFontSize(value.length > 15 ? 10.5 : 12.5); doc.setTextColor(...color); doc.text(value, x + 5, y + 18);
}
function sector(doc: jsPDF, cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, color: RGB) {
  const steps = Math.max(2, Math.ceil((a1 - a0) / (Math.PI / 40))), pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) { const a = a0 + ((a1 - a0) * i) / steps; pts.push([cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)]); }
  for (let i = steps; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / steps; pts.push([cx + r0 * Math.cos(a), cy + r0 * Math.sin(a)]); }
  doc.setFillColor(...color); doc.lines(pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]), pts[0][0], pts[0][1], [1, 1], "F", true);
}
function donut(doc: jsPDF, cx: number, cy: number, r: number, slices: { label: string; value: number }[], centre: string, sub: string) {
  const total = slices.reduce((t, s) => t + s.value, 0); const live = slices.filter(s => s.value > 0);
  if (total <= 0) { doc.setDrawColor(...LINE); doc.setLineWidth(7); doc.circle(cx, cy, r - 3.5, "S"); }
  let a = -Math.PI / 2; live.forEach((s, i) => { const span = (s.value / total) * Math.PI * 2; sector(doc, cx, cy, r - 8, r, a, a + Math.max(span - 0.012, 0.01), PDF_PALETTE[i % PDF_PALETTE.length]); a += span; });
  doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...NAVY); doc.text(centre, cx, cy + 0.5, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...GREY); doc.text(sub, cx, cy + 5, { align: "center" });
  return live;
}
function legend(doc: jsPDF, x: number, y: number, rows: { label: string; value: number }[], total: number, width = 70) {
  rows.forEach((s, i) => { const yy = y + i * 7.2;
    doc.setFillColor(...PDF_PALETTE[i % PDF_PALETTE.length]); doc.roundedRect(x, yy - 3, 3.4, 3.4, 0.8, 0.8, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...NAVY); doc.text(clean(s.label).slice(0, 22), x + 6, yy);
    doc.setTextColor(...GREY); doc.text(`${total > 0 ? Math.round((s.value / total) * 100) : 0}%`, x + width, yy, { align: "right" }); });
}
function bars(doc: jsPDF, x: number, y: number, w: number, rows: { label: string; planned: number; actual: number }[]) {
  const labelW = 46, valW = 44, trackW = w - labelW - valW, max = Math.max(1, ...rows.map(r => Math.max(r.planned, r.actual)));
  rows.forEach((r, i) => { const yy = y + i * 10;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...NAVY); doc.text(clean(r.label).slice(0, 24), x, yy + 4);
    doc.setFillColor(...LIGHT); doc.roundedRect(x + labelW, yy, trackW, 5, 1.2, 1.2, "F");
    doc.setFillColor(216, 207, 250); doc.roundedRect(x + labelW, yy, Math.max(1.5, (r.planned / max) * trackW), 5, 1.2, 1.2, "F");
    if (r.actual > 0) { doc.setFillColor(...(r.actual > r.planned ? RED : VIOLET)); doc.roundedRect(x + labelW, yy + 1.2, Math.max(1.5, (r.actual / max) * trackW), 2.6, 1.1, 1.1, "F"); }
    doc.setFontSize(7.5); doc.setTextColor(...GREY); doc.text(`${money(r.actual)} / ${money(r.planned)}`, x + w, yy + 4, { align: "right" }); });
  const ly = y + rows.length * 10 + 2; doc.setFillColor(216, 207, 250); doc.rect(x + labelW, ly, 6, 2.6, "F"); doc.setFontSize(7.5); doc.setTextColor(...GREY); doc.text("Planned", x + labelW + 8, ly + 2.2);
  doc.setFillColor(...VIOLET); doc.rect(x + labelW + 28, ly, 6, 2.6, "F"); doc.text("Actual", x + labelW + 36, ly + 2.2); doc.setFillColor(...RED); doc.rect(x + labelW + 56, ly, 6, 2.6, "F"); doc.text("Over plan", x + labelW + 64, ly + 2.2);
  return ly + 6;
}
function line(doc: jsPDF, x: number, y: number, w: number, h: number, vals: number[], labels: string[]) {
  doc.setFillColor(...LIGHT); doc.roundedRect(x, y, w, h, 3, 3, "F");
  if (vals.length < 2) { doc.setFontSize(9); doc.setTextColor(...GREY); doc.text("Trend appears after a few days of history.", x + w / 2, y + h / 2, { align: "center" }); return; }
  const pad = 8, lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const px = (i: number) => x + pad + (i * (w - 2 * pad)) / (vals.length - 1), py = (v: number) => y + h - 12 - ((v - lo) / span) * (h - 24);
  doc.setFillColor(230, 223, 252); doc.lines(vals.slice(1).map((_, i) => [px(i + 1) - px(i), py(vals[i + 1]) - py(vals[i])]).concat([[0, y + h - 12 - py(vals[vals.length - 1])], [px(0) - px(vals.length - 1), 0]]), px(0), py(vals[0]), [1, 1], "F", true);
  doc.setDrawColor(...VIOLET); doc.setLineWidth(0.9); doc.lines(vals.slice(1).map((_, i) => [px(i + 1) - px(i), py(vals[i + 1]) - py(vals[i])]), px(0), py(vals[0]), [1, 1], "S", false);
  doc.setFontSize(7.5); doc.setTextColor(...GREY); doc.text(labels[0], x + pad, y + h - 4); doc.text(labels[labels.length - 1], x + w - pad, y + h - 4, { align: "right" });
  doc.text(money(hi), x + pad, y + 6); 
}
type Col = { label: string; w: number; align?: "left" | "right" };
function table(doc: jsPDF, y: number, cols: Col[], rows: string[][], opts: { total?: string[]; title: string; sub: string }) {
  const draw = (yy: number) => { doc.setFillColor(...NAVY); doc.rect(M, yy, W - 2 * M, 7.5, "F"); let x = M + 2;
    cols.forEach(c => { doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255, 255, 255); doc.text(c.label, c.align === "right" ? x + c.w - 4 : x, yy + 5, { align: c.align === "right" ? "right" : "left" }); x += c.w; }); return yy + 7.5; };
  let yy = draw(y);
  const put = (r: string[], bold: boolean, fill?: RGB) => {
    if (yy > 272) { doc.addPage(); header(doc, opts.title, opts.sub); yy = draw(56); }
    if (fill) { doc.setFillColor(...fill); doc.rect(M, yy, W - 2 * M, 7, "F"); }
    let x = M + 2; doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(8.5); doc.setTextColor(...NAVY);
    r.forEach((cell, i) => { const c = cols[i]; doc.text(clean(cell).slice(0, c.w > 40 ? 34 : 20), c.align === "right" ? x + c.w - 4 : x, yy + 4.8, { align: c.align === "right" ? "right" : "left" }); x += c.w; });
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, yy + 7, W - M, yy + 7); yy += 7; };
  rows.forEach((r, i) => put(r, false, i % 2 ? LIGHT : undefined));
  if (opts.total) put(opts.total, true, [236, 231, 252]);
  return yy + 6;
}
function footers(doc: jsPDF, generated: string) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, 285, W - M, 285);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...GREY);
    doc.text(`Prepared with kkingg reserves  |  ${generated}  |  Amounts in ${displayCurrency()}`, M, 290); doc.text(`Page ${i} of ${n}`, W - M, 290, { align: "right" }); }
}

export type BudgetReport = {
  title: string; kind: string; org?: string | null; description?: string | null; period: string; generated: string;
  opening: number; incomes: { name: string; amount: number }[]; costs: { name: string; type: string; planned: number; actual: number }[];
  contingencyPct: number; unplanned: number;
};
export function buildBudgetPdf(r: BudgetReport) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const sub = [r.kind + " budget", r.period, r.org].filter(Boolean).join("   |   ");
  header(doc, r.title, sub);
  const funding = r.incomes.reduce((t, x) => t + x.amount, 0), available = r.opening + funding;
  const planned = r.costs.reduce((t, c) => t + c.planned, 0), cont = (planned * r.contingencyPct) / 100, committed = planned + cont;
  const spent = r.costs.reduce((t, c) => t + c.actual, 0) + r.unplanned, surplus = available - committed;
  const kw = (W - 2 * M - 15) / 4;
  kpi(doc, M, 54, kw, "Available funds", money(available)); kpi(doc, M + kw + 5, 54, kw, "Planned costs", money(committed), VIOLET);
  kpi(doc, M + 2 * (kw + 5), 54, kw, surplus >= 0 ? "Projected surplus" : "Projected deficit", money(surplus), surplus >= 0 ? GREEN : RED); kpi(doc, M + 3 * (kw + 5), 54, kw, "Spent to date", money(spent), [217, 119, 6]);
  section(doc, 92, "Cost structure");
  const byType = (t: string) => r.costs.filter(c => c.type === t).reduce((s, c) => s + c.planned, 0);
  const slices = [{ label: "Fixed costs", value: byType("fixed") }, { label: "Variable costs", value: byType("variable") }, { label: "Capital items", value: byType("capital") }, { label: "Contingency", value: cont }].filter(s => s.value > 0);
  const live = donut(doc, 42, 125, 25, slices, money(committed).replace(/^[A-Z]{3} /, ""), "total committed");
  legend(doc, 76, 114, live, committed, 44);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...NAVY); doc.text("Budget health", 128, 92); doc.setFillColor(...GOLD); doc.rect(128, 93.8, 12, 0.9, "F");
  const used = available > 0 ? Math.min(1, spent / available) : 0;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...GREY); doc.text("Funds used", 128, 103); doc.text(`${Math.round(used * 100)}%`, 196, 103, { align: "right" });
  doc.setFillColor(...LIGHT); doc.roundedRect(128, 105, 68, 4, 2, 2, "F"); doc.setFillColor(...(used > 0.85 ? RED : VIOLET)); doc.roundedRect(128, 105, Math.max(2, 68 * used), 4, 2, 2, "F");
  const lines: [string, string][] = [["Remaining funds", money(available - spent)], ["Contingency reserve", `${r.contingencyPct}% (${money(cont)})`], ["Unplanned spending", money(r.unplanned)], ["Funding sources", String(r.incomes.length)]];
  if (funding > 0) lines.splice(1, 0, ["Cost margin", `${Math.round(((funding - committed) / funding) * 100)}%`]);
  lines.forEach(([a, b], i) => { const yy = 118 + i * 8; doc.setFontSize(8.5); doc.setTextColor(...GREY); doc.text(a, 128, yy); doc.setFont("helvetica", "bold"); doc.setTextColor(...NAVY); doc.text(b, 196, yy, { align: "right" }); doc.setFont("helvetica", "normal"); });
  section(doc, 160, "Planned vs actual by category");
  const top = [...r.costs].sort((a, b) => b.planned - a.planned).slice(0, 9);
  if (top.length) bars(doc, M, 170, W - 2 * M, top.map(c => ({ label: c.name, planned: c.planned, actual: c.actual })));
  else { doc.setFontSize(9); doc.setTextColor(...GREY); doc.text("No cost categories have been planned yet.", M, 172); }
  doc.addPage(); header(doc, r.title, sub);
  let y = 60; section(doc, y, "Funding and income"); y += 6;
  y = table(doc, y, [{ label: "Source", w: 118 }, { label: "Amount", w: 64, align: "right" }], [["Opening balance", money(r.opening)], ...r.incomes.map(i => [i.name, money(i.amount)])], { total: ["Total available funds", money(available)], title: r.title, sub });
  section(doc, y + 2, "Cost plan"); y += 8;
  y = table(doc, y, [{ label: "Category", w: 54 }, { label: "Type", w: 24 }, { label: "Planned", w: 34, align: "right" }, { label: "Actual", w: 34, align: "right" }, { label: "Variance", w: 36, align: "right" }],
    r.costs.map(c => [c.name, c.type[0].toUpperCase() + c.type.slice(1), money(c.planned), money(c.actual), money(c.planned - c.actual)]),
    { total: ["Total", "", money(planned), money(r.costs.reduce((t, c) => t + c.actual, 0)), money(planned - r.costs.reduce((t, c) => t + c.actual, 0))], title: r.title, sub });
  if (y > 240) { doc.addPage(); header(doc, r.title, sub); y = 60; }
  section(doc, y, "Notes and assumptions"); y += 8; doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...NAVY);
  const notes = [r.description ? clean(r.description) : "", `Contingency of ${r.contingencyPct}% is held on top of planned costs.`, "Variance is planned minus actual. A negative variance means a category is over its plan.", "Figures reflect data entered in the app on the date of preparation and are not audited."].filter(Boolean);
  notes.forEach(n => { const w = doc.splitTextToSize("- " + n, W - 2 * M) as string[]; doc.text(w, M, y); y += w.length * 4.6 + 1.5; });
  footers(doc, r.generated);
  return doc;
}

export type NetWorthReport = {
  generated: string; assets: { name: string; cls: string; value: number; cost?: number | null }[]; liabilities: { name: string; kind: string; balance: number; apr: number }[];
  liquid: number; history: { label: string; value: number }[];
};
export function buildNetWorthPdf(r: NetWorthReport) {
  const doc = new jsPDF({ unit: "mm", format: "a4" }); header(doc, "Net worth statement", `Prepared ${r.generated}`);
  const assets = r.assets.reduce((t, a) => t + a.value, 0), owed = r.liabilities.reduce((t, l) => t + l.balance, 0), kw = (W - 2 * M - 15) / 4;
  kpi(doc, M, 54, kw, "Net worth", money(assets - owed)); kpi(doc, M + kw + 5, 54, kw, "Total assets", money(assets), GREEN); kpi(doc, M + 2 * (kw + 5), 54, kw, "Liabilities", money(owed), RED); kpi(doc, M + 3 * (kw + 5), 54, kw, "Liquid cash", money(r.liquid), VIOLET);
  section(doc, 92, "Asset allocation");
  const classes = [...new Set(r.assets.map(a => a.cls))].map(c => ({ label: c, value: r.assets.filter(a => a.cls === c).reduce((t, a) => t + a.value, 0) })).sort((a, b) => b.value - a.value);
  const live = donut(doc, 42, 125, 25, classes, "", "by asset class"); legend(doc, 76, 114, live.slice(0, 7), assets, 44);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...NAVY); doc.text("Net worth trend", 128, 92); doc.setFillColor(...GOLD); doc.rect(128, 93.8, 12, 0.9, "F");
  line(doc, 128, 98, 68, 56, r.history.map(h => h.value), r.history.map(h => h.label));
  section(doc, 168, "Key ratios");
  const ratios: [string, string][] = [["Liquid cash share of assets", assets > 0 ? `${Math.round((r.liquid / assets) * 100)}%` : "-"], ["Liabilities as share of assets", assets > 0 ? `${Math.round((owed / assets) * 100)}%` : "-"], ["Largest asset class", classes[0] ? `${classes[0].label} (${Math.round((classes[0].value / (assets || 1)) * 100)}%)` : "-"], ["Number of accounts and holdings", String(r.assets.length)]];
  ratios.forEach(([a, b], i) => { const yy = 180 + i * 9; doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GREY); doc.text(a, M, yy); doc.setFont("helvetica", "bold"); doc.setTextColor(...NAVY); doc.text(b, 120, yy, { align: "right" }); doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, yy + 2.5, 120, yy + 2.5); });
  doc.addPage(); header(doc, "Net worth statement", `Prepared ${r.generated}`);
  let y = 60; section(doc, y, "Assets"); y += 6;
  y = table(doc, y, [{ label: "Account or holding", w: 70 }, { label: "Type", w: 36 }, { label: "Value", w: 38, align: "right" }, { label: "Gain/loss", w: 38, align: "right" }],
    r.assets.map(a => [a.name, a.cls, money(a.value), a.cost ? money(a.value - a.cost) : "-"]), { total: ["Total assets", "", money(assets), ""], title: "Net worth statement", sub: `Prepared ${r.generated}` });
  section(doc, y + 2, "Liabilities"); y += 8;
  y = table(doc, y, [{ label: "Liability", w: 70 }, { label: "Type", w: 36 }, { label: "Rate", w: 38, align: "right" }, { label: "Balance", w: 38, align: "right" }],
    r.liabilities.map(l => [l.name, l.kind, `${l.apr}%`, money(l.balance)]), { total: ["Total liabilities", "", "", money(owed)], title: "Net worth statement", sub: `Prepared ${r.generated}` });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...GREY); doc.text(doc.splitTextToSize("Values are entered by the account holder and are not independently verified. Foreign-currency items are converted at indicative market rates.", W - 2 * M) as string[], M, Math.min(y + 4, 276));
  footers(doc, r.generated); return doc;
}
