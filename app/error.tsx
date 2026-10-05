"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <main className="mx-auto max-w-sm p-10 text-center"><h1 className="gold-text text-3xl font-extrabold">kkingg reserves</h1><p className="mt-4">Something went wrong.</p><button className="mt-4 rounded-2xl bg-gold px-4 py-2 font-semibold text-black" onClick={reset}>Try again</button></main>;
}
