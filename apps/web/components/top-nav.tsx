"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/markets", label: "Markets" },
  { href: "/terminal", label: "Terminal" },
  { href: "/research", label: "Research" },
  { href: "/simulation", label: "Simulation Lab" },
  { href: "/about", label: "About" }
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between px-4 py-4 md:px-8">
        <div>
          <Link href="/markets" className="text-lg font-semibold text-slate-900">
            Meridian Terminal
          </Link>
          <p className="text-xs text-slate-500">Market visualization + execution-aware research workflows.</p>
        </div>
        <nav className="flex items-center gap-2">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
