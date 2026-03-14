"use client";

import { useCallback, useMemo, useState } from "react";
import { Tabs } from "./ui/tabs";

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
  { id: "monte_carlo", label: "Monte Carlo" },
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

  const onImageError = useCallback(() => {
    setImageError(true);
  }, []);

  const onTabChange = useCallback((id: string) => {
    setTab(id as (typeof TAB_OPTIONS)[number]["id"]);
    setImageError(false);
  }, []);

  const showPlaceholder = !content || imageError;

  return (
    <div className="space-y-3">
      <Tabs active={tab} onChange={onTabChange} options={[...TAB_OPTIONS]} />
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {content && !showPlaceholder ? (
          <img
            src={content}
            alt={`${tab} artifact`}
            className="h-auto w-full"
            onError={onImageError}
          />
        ) : (
          <div className="flex h-[320px] items-center justify-center px-4 text-center text-sm text-slate-500">
            {tab === "monte_carlo"
              ? "Monte Carlo drawdown distribution not available for this run. Run a backtest with Monte Carlo resampling to generate it."
              : "Artifact not available for this run."}
          </div>
        )}
      </div>
    </div>
  );
}
