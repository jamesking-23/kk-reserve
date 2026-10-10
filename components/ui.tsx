"use client";
import { useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Banknote } from "lucide-react";

export const input = "glass w-full rounded-2xl p-3 outline-none focus:border-yellow-400";
export const Logo = () => <h1 className="gold-text text-3xl font-extrabold">kkingg reserves</h1>;
export type SayFn = (m: string, undo?: () => Promise<void>) => void;

// Primary action button: haptic buzz (if enabled) and a brief cash icon after success.
export function GoldButton({ children, onClick }: { children: ReactNode; onClick: () => Promise<void> | void }) {
  const [pop, setPop] = useState(false);
  return (
    <div className="relative">
      <AnimatePresence>{pop && <motion.span initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -28 }} exit={{ opacity: 0 }} className="absolute -top-2 left-1/2"><Banknote size={24} /></motion.span>}</AnimatePresence>
      <motion.button whileTap={{ scale: 0.95 }} className="w-full rounded-2xl bg-gold px-4 py-3 font-semibold text-black shadow-[inset_0_1px_0_rgb(255_255_255/.5),0_6px_24px_rgb(255_215_0/.25)]"
        onClick={async () => { if (localStorage.getItem("kk-haptics") !== "off") navigator.vibrate?.(20); await onClick(); setPop(true); setTimeout(() => setPop(false), 900); }}>{children}</motion.button>
    </div>
  );
}
export const Section = ({ title, sub, action, children }: { title: string; sub?: string; action?: ReactNode; children: ReactNode }) => (
  <div className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>{sub && <p className="text-sm text-gray-400">{sub}</p>}</div>{action}</div>{children}</div>
);
