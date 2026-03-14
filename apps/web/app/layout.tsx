import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "../components/providers/ThemeProvider";
import { AppLayout } from "../components/providers/AppLayout";
import "./globals.css";


const FAVICON_URL = '/assets/favicon/meridian-favicon.png';

export const metadata: Metadata = {
  title: "Meridian Terminal",
  description: "Research platform: markets, backtests, and risk analytics.",
  icons: {
    icon: FAVICON_URL,
    shortcut: FAVICON_URL,
    apple: FAVICON_URL,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AppLayout>{children}</AppLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}
