import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "NicheScout",
  description: "Niche site discovery & intelligence platform",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/sites", label: "All Sites" },
  { href: "/settings", label: "Settings" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-text">
        <div className="flex min-h-screen">
          <aside className="w-56 shrink-0 border-r border-border p-4 hidden md:block">
            <div className="mb-8 flex items-center gap-2 px-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="font-semibold tracking-tight">NicheScout</span>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-card hover:text-text transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
