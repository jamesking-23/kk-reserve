import "./globals.css";
export const metadata = { title: "kkingg reserves", icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%230b0b0d'/><text x='50' y='68' font-size='56' font-weight='bold' text-anchor='middle' fill='%23FFD700'>kk</text></svg>" } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="min-h-screen antialiased">{children}</body></html>;
}
