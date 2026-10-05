// Money helpers. Stored amounts are always in the base currency (UGX). The display currency only changes how they are shown.
let disp = { cur: "UGX", rate: 1 };
export const setDisplay = (cur: string, rate: number) => { disp = { cur, rate: rate > 0 ? rate : 1 }; };
export const toDisplay = (n: number) => n * disp.rate;
const NO_DECIMALS = ["UGX", "KES", "TZS", "RWF", "BIF", "CDF", "SOS"];
export const fmtIn = (n: number, currency: string, locale = "en-UG") =>
  new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: NO_DECIMALS.includes(currency) ? 0 : 2 }).format(n || 0);
export const fmt = (n: number, currency?: string, locale?: string) => (currency ? fmtIn(n, currency, locale) : fmtIn(n * disp.rate, disp.cur));
export const parseMoney = (s: string): number | null => {
  const n = Number(s.replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};
export const groupDigits = (s: string) => s.replace(/[^\d.]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
