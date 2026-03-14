"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { createMeridianTheme } from "../../lib/theme";

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
          backgroundColor: "#fafafa",
          color: "#1a1a1a",
        }}
        suppressHydrationWarning
      />
    );
  }

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
