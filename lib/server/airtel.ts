// Airtel Money integration FRAMEWORK. Intentionally not functional yet: no Airtel API credentials exist.
// To finish: obtain Airtel Money Open API credentials, set AIRTEL_CLIENT_ID / AIRTEL_CLIENT_SECRET / AIRTEL_BASE_URL,
// then implement the four functions below against Airtel's developer documentation (verify every endpoint and header there;
// do not rely on assumptions). The provider registry already routes /api/mobile-money/airtel/* to this file.
export class AirtelNotConfiguredError extends Error {
  constructor() { super("Airtel Money is not connected yet. Credentials and implementation are pending."); this.name = "AirtelNotConfiguredError"; }
}
export const airtelConfigured = () => false; // flip to a real env check once implemented
export async function getAirtelToken(): Promise<string> { throw new AirtelNotConfiguredError(); }
export async function getAirtelBalance(): Promise<{ availableBalance: string; currency: string }> { throw new AirtelNotConfiguredError(); }
export async function airtelCollect(_i: { referenceId: string; amount: string; phone: string }): Promise<{ referenceId: string }> { throw new AirtelNotConfiguredError(); }
export async function airtelStatus(_ref: string): Promise<{ status: "PENDING" | "SUCCESSFUL" | "FAILED"; reason?: string }> { throw new AirtelNotConfiguredError(); }
