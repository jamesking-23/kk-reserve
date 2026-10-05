import "./globals.css";
import type { Viewport } from "next";
export const metadata = { title: "kkingg reserves", description: "Personal budget tracker", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, title: "kkingg" } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0b0b0d" };
// Applies saved theme/accent before first paint to avoid a flash.
const boot = `(function(){try{var t=localStorage.getItem("kk-theme")||"dark",a=localStorage.getItem("kk-accent");var d=t==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;document.documentElement.dataset.theme=d;if(a)document.documentElement.style.setProperty("--accent",a)}catch(e){}})()`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: boot }} /></head><body className="min-h-screen antialiased">{children}</body></html>;
}
