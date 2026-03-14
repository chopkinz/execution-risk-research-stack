import fs from "node:fs";
import path from "node:path";
import { getResearchLatestDir } from "../../../../lib/repo";

const REQUIRED = ["summary.json", "equity_curve.png", "drawdown.png", "risk_rejections.png", "report.md"];

export const dynamic = "force-dynamic";

export async function GET() {
  const latestDir = getResearchLatestDir();
  const exists = fs.existsSync(latestDir);
  const files = exists ? fs.readdirSync(latestDir) : [];
  const missing = REQUIRED.filter((name) => !files.includes(name));
  const ready = exists && missing.length === 0;

  const riskLabDir = path.join(latestDir, "risk_lab");
  const executionLabDir = path.join(latestDir, "execution_lab");
  const readyRiskLab =
    fs.existsSync(riskLabDir) && fs.existsSync(path.join(riskLabDir, "report.md"));
  const readyExecutionLab =
    fs.existsSync(executionLabDir) && fs.existsSync(path.join(executionLabDir, "report.md"));

  let lastRunAtUtc: string | null = null;
  if (ready) {
    const summaryPath = path.join(latestDir, "summary.json");
    const summaryRaw = fs.readFileSync(summaryPath, "utf8");
    const summary = JSON.parse(summaryRaw) as { timestamp_utc?: string };
    lastRunAtUtc = summary.timestamp_utc ?? null;
    if (!lastRunAtUtc) {
      lastRunAtUtc = fs.statSync(summaryPath).mtime.toISOString();
    }
  }

  return Response.json(
    {
      ready,
      lastRunAtUtc,
      missing,
      readyRiskLab,
      readyExecutionLab,
    },
    {
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  );
}
