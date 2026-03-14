"use client";

import { useCallback, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";

type ArtifactTabsProps = {
  urls: {
    equity: string;
    drawdown: string;
    risk: string;
    monteCarlo?: string;
  };
};

const TAB_OPTIONS = [
  { id: "equity", label: "Equity" },
  { id: "drawdown", label: "Drawdown" },
  { id: "risk_rejections", label: "Risk rejections" },
  { id: "monte_carlo", label: "Robustness" },
] as const;

export function ResearchArtifactTabs({ urls }: ArtifactTabsProps) {
  const [tab, setTab] = useState<(typeof TAB_OPTIONS)[number]["id"]>("equity");
  const [imageError, setImageError] = useState(false);

  const content = useMemo(() => {
    if (tab === "equity") return urls.equity;
    if (tab === "drawdown") return urls.drawdown;
    if (tab === "risk_rejections") return urls.risk;
    return urls.monteCarlo;
  }, [tab, urls]);

  const onImageError = useCallback(() => setImageError(true), []);

  const onTabChange = useCallback((_: React.SyntheticEvent, value: string) => {
    setTab(value as (typeof TAB_OPTIONS)[number]["id"]);
    setImageError(false);
  }, []);

  const showPlaceholder = !content || imageError;

  return (
    <Box>
      <Tabs value={tab} onChange={onTabChange} variant="fullWidth" sx={{ mb: 2 }}>
        {TAB_OPTIONS.map((t) => (
          <Tab key={t.id} value={t.id} label={t.label} />
        ))}
      </Tabs>
      <Box
        sx={{
          overflow: "hidden",
          borderRadius: 1,
          border: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          minHeight: 320,
        }}
      >
        {content && !showPlaceholder ? (
          <Box
            component="img"
            src={content}
            alt={`${tab} chart`}
            onError={onImageError}
            sx={{ width: "100%", height: "auto", display: "block", verticalAlign: "middle" }}
          />
        ) : (
          <Box
            sx={{
              height: 320,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              px: 3,
              py: 4,
              textAlign: "center",
              bgcolor: "action.hover",
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
              {tab === "monte_carlo"
                ? "Run a backtest with robustness analysis to see this chart."
                : "Run a backtest to see this chart."}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
