import type { Metadata } from "next";
import { TopNav } from "../components/top-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meridian Terminal",
  description: "Market visualization and execution-aware research workflows in a clean institutional interface."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-white">
          <TopNav />
          <main className="mx-auto w-full max-w-[1480px] px-4 py-6 md:px-8 md:py-8">{children}</main>
          <footer className="border-t border-slate-200 bg-white px-4 py-4 text-xs text-slate-500 md:px-8">
            <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between">
              <span>v0.1 • Data: Yahoo Finance / Stooq • For visualization and research workflows.</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
