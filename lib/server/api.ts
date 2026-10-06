import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MomoConfigError, MomoError } from "./momo";
import { AirtelNotConfiguredError } from "./airtel";

export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

/** Verifies the caller's Supabase session token and returns a client that acts as that user (Row Level Security applies). */
export async function authedClient(req: Request) {
  const h = req.headers.get("authorization") || "", token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) throw new HttpError(401, "Sign in to use this feature.");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Your session has expired. Sign in again.");
  return { sb, user: data.user };
}
export function requireOwner(userId: string) {
  const ids = (process.env.MOMO_ADMIN_USER_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!ids.includes(userId)) throw new HttpError(403, "The merchant wallet balance is only visible to the app owner.");
}
export function fail(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof AirtelNotConfiguredError) return NextResponse.json({ error: e.message }, { status: 501 });
  if (e instanceof MomoConfigError) return NextResponse.json({ error: "Mobile money is not configured on the server." }, { status: 503 });
  if (e instanceof MomoError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status === 504 ? 504 : 502 });
  console.error("mobile-money route error", e instanceof Error ? e.message : "unknown");
  return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
}
