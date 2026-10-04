// Single place for money parsing/formatting. DB stays numeric(14,2); rounding happens at display only.
export const fmt = (n: number, currency = "UGX", locale = "en-UG") =>
  new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: currency === "UGX" ? 0 : 2 }).format(n || 0);
export const parseMoney = (s: string): number | null => {
  const n = Number(s.replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};
export const groupDigits = (s: string) => s.replace(/[^\d.]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
