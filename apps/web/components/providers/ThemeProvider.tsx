"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ThemeProvider as MuiThemeProvider, useTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { createMeridianTheme, LIGHT_PALETTE } from "../../lib/theme";

const STORAGE_KEY = "meridian-color-mode";

type Mode = "light" | "dark";

function getStoredMode(): Mode {
  if (typeof window === "undefined") return "light";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "dark" || v === "light") return v;
  } catch {}
  return "light";
}

type ThemeContextValue = { mode: Mode; toggleMode: () => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeMode must be used inside ThemeProvider");
  return ctx;
}

function ThemeSync({ mode }: { mode: Mode }) {
  const theme = useTheme();
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", mode);
    root.style.setProperty("--meridian-primary", theme.palette.primary.main);
    root.style.setProperty("--meridian-bg-default", theme.palette.background.default);
    root.style.setProperty("--meridian-bg-paper", theme.palette.background.paper);
    root.style.setProperty("--meridian-text-primary", theme.palette.text.primary);
    root.style.setProperty("--meridian-text-secondary", theme.palette.text.secondary);
    root.style.setProperty("--meridian-divider", theme.palette.divider as string);
  }, [mode, theme]);
  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    setMode(getStoredMode());
    setMounted(true);
  }, []);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  const theme = useMemo(() => createMeridianTheme(mode), [mode]);
  const value = useMemo(() => ({ mode, toggleMode }), [mode, toggleMode]);

  if (!mounted) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: LIGHT_PALETTE.background.default,
          color: LIGHT_PALETTE.text.primary,
        }}
        suppressHydrationWarning
      />
    );
  }

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        <ThemeSync mode={mode} />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
