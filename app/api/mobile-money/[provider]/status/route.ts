import { NextResponse } from "next/server";
import { authedClient, fail, HttpError } from "@/lib/server/api";
import { getProvider } from "@/lib/server/providers";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
// Refreshes one of the caller's own transactions from the provider and stores the result.
export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  try {
    const { sb } = await authedClient(req);
    const p = getProvider((await ctx.params).provider); if (!p) throw new HttpError(404, "Unknown provider.");
    const ref = String((await req.json().catch(() => null))?.reference ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(ref)) throw new HttpError(400, "Invalid reference.");
    const { data: row } = await sb.from("mobile_money_transactions").select("id").eq("reference_id", ref).eq("provider", p.id).maybeSingle();
    if (!row) throw new HttpError(404, "Transaction not found.");
    const s = await p.status(ref);
    const { data, error } = await sb.from("mobile_money_transactions").update({ status: s.status, reason: s.reason ?? null, updated_at: new Date().toISOString() }).eq("id", row.id).select("*").single();
    if (error) throw new HttpError(400, "Could not update the transaction.");
    return NextResponse.json(data);
  } catch (e) { return fail(e); }
}
