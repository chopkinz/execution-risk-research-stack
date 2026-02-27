"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Tabs } from "./ui/tabs";

type ArtifactTabsProps = {
  urls: {
    equity: string;
    drawdown: string;
    risk: string;
    monteCarlo?: string;
  };
};

export function ResearchArtifactTabs({ urls }: ArtifactTabsProps) {
  const [tab, setTab] = useState("overview");

  const content = useMemo(() => {
    if (tab === "overview") return urls.equity;
    if (tab === "risk") return urls.drawdown;
    if (tab === "execution") return urls.risk;
    return urls.monteCarlo;
  }, [tab, urls]);

  return (
    <div className="space-y-3">
      <Tabs
        active={tab}
        onChange={setTab}
        options={[
          { id: "overview", label: "Overview" },
          { id: "risk", label: "Risk" },
          { id: "execution", label: "Execution" },
          { id: "robustness", label: "Robustness" }
        ]}
      />
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {content ? (
          <Image src={content} alt={`${tab} artifact`} width={1400} height={700} className="h-auto w-full" />
        ) : (
          <div className="flex h-[320px] items-center justify-center text-sm text-slate-500">
            Robustness artifact not available for this run.
          </div>
        )}
      </div>
    </div>
  );
}
