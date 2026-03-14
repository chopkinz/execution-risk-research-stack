"use client";

import { Box } from "@mui/material";
import { TopNav } from "../top-nav";
import { FooterStatus } from "../footer-status";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: "100vh", // 100dvh where supported (mobile)
        bgcolor: "background.default",
        color: "text.primary",
        display: "flex",
        flexDirection: "column",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <TopNav />
      <Box
        component="main"
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          mx: "auto",
          width: "100%",
          maxWidth: 1480,
          px: { xs: 1.5, sm: 2, md: 3 },
          py: { xs: 2, sm: 2.5, md: 3 },
          paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </Box>
      <Box
        component="footer"
        sx={{
          borderTop: 1,
          borderColor: "divider",
          px: { xs: 1.5, sm: 2, md: 3 },
          py: 2,
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
          fontSize: "0.8125rem",
          lineHeight: 1.5,
          color: "text.secondary",
        }}
      >
        <Box sx={{ maxWidth: 1480, mx: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <span>Meridian Terminal · Market data from Yahoo Finance · Research and visualization only</span>
          <FooterStatus />
        </Box>
      </Box>
    </Box>
  );
}
