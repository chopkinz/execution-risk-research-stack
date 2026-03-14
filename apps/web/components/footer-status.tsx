"use client";

import Box from "@mui/material/Box";
import { useEffect, useState } from "react";

type Health = {
  ok?: boolean;
  research_ready?: boolean;
  last_run_utc?: string | null;
  data_feeds?: string;
  timestamp_utc?: string;
};

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffM = Math.floor(diffMs / 60000);
    if (diffM < 1) return "just now";
    if (diffM < 60) return `${diffM}m ago`;
    const diffH = Math.floor(diffM / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

export function FooterStatus() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: Health) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!health) return null;

  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          "&::before": {
            content: '""',
            width: 6,
            height: 6,
            borderRadius: "50%",
            bgcolor: health.research_ready ? "success.main" : "grey.500",
          },
        }}
      >
        {health.research_ready ? "Results ready" : "No results yet"}
      </Box>
      {health.last_run_utc && (
        <Box component="span" sx={{ color: "text.secondary" }}>
          Last run {formatRelative(health.last_run_utc)}
        </Box>
      )}
    </Box>
  );
}
