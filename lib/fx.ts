"use client";
import { useEffect, useState } from "react";
export const CURRENCIES = ["UGX", "KES", "TZS", "RWF", "BIF", "CDF", "SOS", "USD", "EUR", "GBP"] as const;
export type Rates = Record<string, number>; // units of currency per 1 USD
// Indicative fallback only (used when the live feed is unreachable). Not a trading rate.
export const FALLBACK: Rates = { USD: 1, UGX: 3700, KES: 129, TZS: 2600, RWF: 1400, BIF: 2900, CDF: 2800, SOS: 571, EUR: 0.92, GBP: 0.78 };
export const convert = (amount: number, from: string, to: string, rates: Rates) => (rates[from] && rates[to] ? (amount / rates[from]) * rates[to] : amount);

export type Country = { code: string; name: string; currency: string; tax: string };
export const COUNTRIES: Country[] = [
  { code: "UG", name: "Uganda", currency: "UGX", tax: "URA" },
  { code: "KE", name: "Kenya", currency: "KES", tax: "KRA" },
  { code: "TZ", name: "Tanzania", currency: "TZS", tax: "TRA" },
  { code: "RW", name: "Rwanda", currency: "RWF", tax: "RRA" },
  { code: "BI", name: "Burundi", currency: "BIF", tax: "OBR" },
  { code: "SS", name: "South Sudan", currency: "USD", tax: "National Revenue Authority" },
  { code: "CD", name: "DR Congo", currency: "CDF", tax: "DGI" },
  { code: "SO", name: "Somalia", currency: "USD", tax: "Ministry of Finance (Inland Revenue)" },
];

// Live rates from a public feed, cached 6 hours; falls back to indicative rates.
export function useRates() {
  const [s, setS] = useState<{ rates: Rates; live: boolean; ts: number }>({ rates: FALLBACK, live: false, ts: 0 });
  useEffect(() => {
    try { const c = JSON.parse(localStorage.getItem("kk2-fx") || "null"); if (c && Date.now() - c.ts < 6 * 3600e3) { setS({ rates: c.rates, live: true, ts: c.ts }); return; } } catch {}
    fetch("https://open.er-api.com/v6/latest/USD").then(r => r.json()).then(j => {
      if (!j?.rates?.UGX) return; const rates: Rates = {}; CURRENCIES.forEach(c => (rates[c] = j.rates[c] ?? FALLBACK[c]));
      localStorage.setItem("kk2-fx", JSON.stringify({ rates, ts: Date.now() })); setS({ rates, live: true, ts: Date.now() });
    }).catch(() => {});
  }, []);
  return s;
}
