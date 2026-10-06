// MTN MoMo Collection API client (READ-ONLY: token + account balance). SERVER ONLY: reads secrets from process.env.

export class MomoConfigError extends Error {}
export class MomoError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); this.name = "MomoError"; }
}
export type MomoConfig = { baseUrl: string; subscriptionKey: string; apiUser: string; apiKey: string; targetEnv: string; currency: string };

const clean = (v: string) => v.trim().replace(/^\[|\]$/g, ""); // tolerate values pasted with brackets

export function loadConfig(env: Record<string, string | undefined> = process.env): MomoConfig {
  const need = ["MTN_SUBSCRIPTION_KEY", "MTN_API_USER_UUID", "MTN_API_KEY"];
  const missing = need.filter(k => !env[k]?.trim());
  if (missing.length) throw new MomoConfigError(`MTN MoMo is not configured. Missing: ${missing.join(", ")}`);
  const targetEnv = clean(env.MTN_TARGET_ENV || "sandbox");
  const baseUrl = clean(env.MTN_BASE_URL || (targetEnv === "sandbox" ? "https://sandbox.momodeveloper.mtn.com" : "")).replace(/\/+$/, "");
  if (!/^https:\/\//.test(baseUrl)) throw new MomoConfigError("MTN_BASE_URL must be an https URL (sandbox: https://sandbox.momodeveloper.mtn.com).");
  return {
    baseUrl, targetEnv, subscriptionKey: clean(env.MTN_SUBSCRIPTION_KEY!), apiUser: clean(env.MTN_API_USER_UUID!), apiKey: clean(env.MTN_API_KEY!),
    currency: clean(env.MTN_CURRENCY || (targetEnv === "sandbox" ? "EUR" : "UGX")),
  };
}

const explain = (status: number) =>
  status === 400 ? "MTN rejected the request as invalid." :
  status === 401 ? "MTN rejected the credentials or the access token has expired." :
  status === 403 ? "MTN refused access. Check that the subscription key is active for the Collection product." :
  status === 404 ? "MTN could not find that resource." :
  status === 409 ? "MTN reports a conflict (duplicate reference)." :
  status === 429 ? "Too many requests to MTN. Try again shortly." :
  status >= 500 ? "MTN is temporarily unavailable." : `MTN returned an unexpected response (${status}).`;

async function call(cfg: MomoConfig, path: string, init: RequestInit, opts: { retries?: number; timeoutMs?: number } = {}) {
  const { retries = 0, timeoutMs = 10000 } = opts; let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(`${cfg.baseUrl}${path}`, { ...init, signal: ctl.signal, cache: "no-store" });
      if (res.status >= 500 && attempt < retries) { last = new MomoError(explain(res.status), res.status); continue; }
      const text = await res.text(); let body: any = null; try { body = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
      if (!res.ok) throw new MomoError(explain(res.status), res.status, typeof body?.code === "string" ? body.code : undefined);
      return { status: res.status, body };
    } catch (e) {
      if (e instanceof MomoError) throw e;
      last = new MomoError((e as Error)?.name === "AbortError" ? "MTN did not respond in time." : "Could not reach MTN.", 504);
      if (attempt >= retries) throw last;
    } finally { clearTimeout(timer); }
  }
  throw last;
}

let cached: { token: string; exp: number } | null = null;
export const _resetTokenCache = () => { cached = null; };

/** 1. POST {base}/collection/token/ with Basic auth (apiUser:apiKey) and the subscription key. Returns a short-lived access_token (cached until shortly before expiry). */
export async function getAuthToken(cfg: MomoConfig = loadConfig(), opts: { force?: boolean } = {}): Promise<string> {
  if (!opts.force && cached && cached.exp > Date.now() + 60_000) return cached.token;
  const basic = Buffer.from(`${cfg.apiUser}:${cfg.apiKey}`).toString("base64");
  const { body } = await call(cfg, "/collection/token/", { method: "POST", headers: { Authorization: `Basic ${basic}`, "Ocp-Apim-Subscription-Key": cfg.subscriptionKey } }, { retries: 1 });
  if (!body?.access_token) throw new MomoError("MTN did not return an access token.", 502);
  cached = { token: body.access_token, exp: Date.now() + (Number(body.expires_in) || 3600) * 1000 };
  return body.access_token;
}

const authed = (cfg: MomoConfig, token: string): Record<string, string> => ({ Authorization: `Bearer ${token}`, "X-Target-Environment": cfg.targetEnv, "Ocp-Apim-Subscription-Key": cfg.subscriptionKey });

/** 2. GET {base}/collection/v1_0/account/balance. Returns { availableBalance, currency } for the collection (merchant) account. */
export async function getWalletBalance(accessToken: string, cfg: MomoConfig = loadConfig()): Promise<{ availableBalance: string; currency: string }> {
  const { body } = await call(cfg, "/collection/v1_0/account/balance", { method: "GET", headers: authed(cfg, accessToken) }, { retries: 1 });
  return { availableBalance: String(body?.availableBalance ?? "0"), currency: String(body?.currency ?? cfg.currency) };
}

/** Runs fn with a token and retries once with a fresh token if MTN says 401. */
export async function withToken<T>(fn: (token: string, cfg: MomoConfig) => Promise<T>): Promise<T> {
  const cfg = loadConfig();
  try { return await fn(await getAuthToken(cfg), cfg); }
  catch (e) { if (e instanceof MomoError && e.status === 401) return fn(await getAuthToken(cfg, { force: true }), cfg); throw e; }
}
