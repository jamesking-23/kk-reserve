import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadConfig, getAuthToken, getWalletBalance, MomoConfigError, MomoError, _resetTokenCache } from "./momo";
const env = { MTN_SUBSCRIPTION_KEY: "sub-key", MTN_API_USER_UUID: "user-uuid", MTN_API_KEY: "api-key", MTN_TARGET_ENV: "sandbox" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => _resetTokenCache()); afterEach(() => vi.unstubAllGlobals());
describe("momo", () => {
  it("fails clearly when config is missing", () => expect(() => loadConfig({})).toThrow(MomoConfigError));
  it("defaults to the sandbox host and strips pasted brackets", () => { const c = loadConfig({ ...env, MTN_API_KEY: "[abc]" }); expect(c.baseUrl).toBe("https://sandbox.momodeveloper.mtn.com"); expect(c.apiKey).toBe("abc"); expect(c.currency).toBe("EUR"); });
  it("requests a token with Basic auth and subscription key, then caches it", async () => {
    const f = vi.fn().mockResolvedValue(json({ access_token: "tok", expires_in: 3600 })); vi.stubGlobal("fetch", f);
    const cfg = loadConfig(env);
    expect(await getAuthToken(cfg)).toBe("tok"); expect(await getAuthToken(cfg)).toBe("tok"); expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0]; expect(url).toBe("https://sandbox.momodeveloper.mtn.com/collection/token/"); expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("user-uuid:api-key").toString("base64")}`); expect(init.headers["Ocp-Apim-Subscription-Key"]).toBe("sub-key");
  });
  it("sends the three required headers for the balance call", async () => {
    const f = vi.fn().mockResolvedValue(json({ availableBalance: "100", currency: "EUR" })); vi.stubGlobal("fetch", f);
    expect(await getWalletBalance("tok", loadConfig(env))).toEqual({ availableBalance: "100", currency: "EUR" });
    const [url, init] = f.mock.calls[0]; expect(url).toBe("https://sandbox.momodeveloper.mtn.com/collection/v1_0/account/balance");
    expect(init.headers).toMatchObject({ Authorization: "Bearer tok", "X-Target-Environment": "sandbox", "Ocp-Apim-Subscription-Key": "sub-key" });
  });
  it("maps MTN errors without leaking secrets", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ code: "ACCESS_DENIED" }, 401)));
    const e = await getAuthToken(loadConfig(env)).catch(x => x); expect(e).toBeInstanceOf(MomoError); expect(e.status).toBe(401); expect(e.message).not.toMatch(/api-key|sub-key/);
  });
});
