import { NextResponse } from "next/server";
import { authedClient, requireOwner, fail, HttpError } from "@/lib/server/api";
import { getProvider } from "@/lib/server/providers";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  try {
    const { user } = await authedClient(req); requireOwner(user.id);
    const p = getProvider((await ctx.params).provider); if (!p) throw new HttpError(404, "Unknown provider.");
    return NextResponse.json(await p.balance());
  } catch (e) { return fail(e); }
}
