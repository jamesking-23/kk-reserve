"use client";
import { useState } from "react";
// Round avatar with graceful fallback to gold-gradient initials.
export default function Avatar({ url, name, size = 40 }: { url?: string | null; name: string; size?: number }) {
  const [bad, setBad] = useState(false);
  const initials = (name || "?").trim().slice(0, 2).toUpperCase();
  const s = { width: size, height: size };
  return url && !bad
    ? <img src={url} alt="" style={s} className="rounded-full object-cover" onError={() => setBad(true)} />
    : <span style={s} aria-hidden className="flex items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-amber-600 text-sm font-bold text-black">{initials}</span>;
}
// Center-crop to a square, max 512px, WebP. Rejects >5MB before processing.
export async function resizeImage(file: File): Promise<Blob> {
  if (file.size > 5 * 1024 * 1024) throw new Error("Image is over 5 MB.");
  if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) throw new Error("Use a JPG, PNG or WebP image.");
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height), out = Math.min(512, side);
  const c = document.createElement("canvas"); c.width = c.height = out;
  c.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, out, out);
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error("Could not process image."))), "image/webp", 0.85));
}
