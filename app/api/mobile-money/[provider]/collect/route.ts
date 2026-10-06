import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { authedClient, fail, HttpError } from "@/lib/server/api";
import { getProvider } from "@/lib/server/providers";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
// Creates a payment request, records it as PENDING first (so nothing is lost), then asks the provider.
export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  try {
    const { sb } = await authedClient(req);
    const p = getProvider((await ctx.params).provider); if (!p) throw new HttpError(404, "Unknown provider.");
    const b = await req.json().catch(() => null);
    const phone = String(b?.phone ?? "").replace(/[\s+()-]/g, ""), amount = String(b?.amount ?? "").replace(/,/g, ""), note = String(b?.note ?? "").slice(0, 80);
    if (!/^\d{6,15}$/.test(phone)) throw new HttpError(400, "Enter a valid phone number with country code, digits only.");
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) throw new HttpError(400, "Enter a valid amount.");
    if (!p.configured()) return fail(new (await import("@/lib/server/airtel")).AirtelNotConfiguredError());
    const referenceId = randomUUID(), currency = p.currency();
    const { error } = await sb.from("mobile_money_transactions").insert({ provider: p.id, reference_id: referenceId, external_id: referenceId, amount, currency, payer_hint: phone.slice(-4), note: note || null });
    if (error) throw new HttpError(400, "Could not record the transaction.");
    try { await p.collect({ referenceId, amount, phone, note }); }
    catch (e) { await sb.from("mobile_money_transactions").update({ status: "FAILED", reason: "REQUEST_NOT_SENT", updated_at: new Date().toISOString() }).eq("reference_id", referenceId); throw e; }
    return NextResponse.json({ referenceId, status: "PENDING" }, { status: 202 });
  } catch (e) { return fail(e); }
}
