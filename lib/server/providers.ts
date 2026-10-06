import * as mtn from "./momo";
import * as air from "./airtel";
export type ProviderId = "mtn" | "airtel";
// Read-only providers: they can only report an account balance. No payment or money-movement operations exist.
export type Provider = { id: ProviderId; name: string; configured: () => boolean; balance: () => Promise<{ availableBalance: string; currency: string }> };
export const providers: Record<ProviderId, Provider> = {
  mtn: { id: "mtn", name: "MTN Mobile Money", configured: () => { try { mtn.loadConfig(); return true; } catch { return false; } }, balance: () => mtn.withToken((t, c) => mtn.getWalletBalance(t, c)) },
  airtel: { id: "airtel", name: "Airtel Money", configured: air.airtelConfigured, balance: air.getAirtelBalance },
};
export const getProvider = (id: string): Provider | null => (id === "mtn" || id === "airtel" ? providers[id] : null);
