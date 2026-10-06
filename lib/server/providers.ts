import * as mtn from "./momo";
import * as air from "./airtel";
export type ProviderId = "mtn" | "airtel";
export type Provider = {
  id: ProviderId; name: string; configured: () => boolean; currency: () => string;
  balance: () => Promise<{ availableBalance: string; currency: string }>;
  collect: (i: { referenceId: string; amount: string; phone: string; note?: string }) => Promise<{ referenceId: string }>;
  status: (ref: string) => Promise<{ status: "PENDING" | "SUCCESSFUL" | "FAILED"; reason?: string }>;
};
const safe = (f: () => string) => { try { return f(); } catch { return ""; } };
export const providers: Record<ProviderId, Provider> = {
  mtn: {
    id: "mtn", name: "MTN Mobile Money",
    configured: () => { try { mtn.loadConfig(); return true; } catch { return false; } },
    currency: () => safe(() => mtn.loadConfig().currency),
    balance: () => mtn.withToken((t, c) => mtn.getWalletBalance(t, c)),
    collect: i => mtn.withToken((t, c) => mtn.requestToPay(t, { referenceId: i.referenceId, amount: i.amount, phone: i.phone, externalId: i.referenceId, payeeNote: i.note }, c)),
    status: ref => mtn.withToken((t, c) => mtn.getRequestToPayStatus(t, ref, c)),
  },
  airtel: {
    id: "airtel", name: "Airtel Money", configured: air.airtelConfigured, currency: () => "UGX",
    balance: air.getAirtelBalance, collect: i => air.airtelCollect(i), status: air.airtelStatus,
  },
};
export const getProvider = (id: string): Provider | null => (id === "mtn" || id === "airtel" ? providers[id] : null);
