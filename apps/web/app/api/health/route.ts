import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getResearchLatestDir } from "../../../lib/repo";

export const dynamic = "force-dynamic";

/** Lightweight system health for observability. Used by System panel and monitoring. */
export async function GET() {
  const latestDir = getResearchLatestDir();
  let researchReady = false;
  let lastRunAtUtc: string | null = null;
  try {
    if (fs.existsSync(latestDir)) {
      const summaryPath = path.join(latestDir, "summary.json");
      if (fs.existsSync(summaryPath)) {
        researchReady = true;
        const raw = fs.readFileSync(summaryPath, "utf-8");
        const summary = JSON.parse(raw) as { timestamp_utc?: string };
        lastRunAtUtc = summary.timestamp_utc ?? null;
      }
    }
  } catch {
    // ignore
  }

  return NextResponse.json(
    {
      ok: true,
      data_feeds: "yahoo",
      research_ready: researchReady,
      last_run_utc: lastRunAtUtc,
      timestamp_utc: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
