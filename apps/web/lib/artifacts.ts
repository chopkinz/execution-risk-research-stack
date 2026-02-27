import { promises as fs } from "fs";
import path from "path";

export type Summary = {
  run_id: string;
  timestamp_utc: string;
  instrument: string;
  timeframe: string;
  start: string;
  end: string;
  trades: number;
  win_rate: number;
  profit_factor: number;
  max_drawdown_pct: number;
  sharpe: number | null;
  total_return_pct: number;
  cagr_pct: number | null;
  notes: string;
  risk: {
    max_daily_loss_pct: number;
    max_exposure_pct: number;
    kill_switch_drawdown_pct: number;
  };
  execution: {
    spread_model: string;
    slippage_model: string;
    fees_model: string;
  };
};

function artifactDir(): string {
  return path.join(process.cwd(), "public", "research", "latest");
}

export async function readSummary(): Promise<Summary | null> {
  try {
    const text = await fs.readFile(path.join(artifactDir(), "summary.json"), "utf8");
    return JSON.parse(text) as Summary;
  } catch {
    return null;
  }
}

export async function readReport(): Promise<string> {
  try {
    return await fs.readFile(path.join(artifactDir(), "report.md"), "utf8");
  } catch {
    return "No report found. Run `make run` to generate artifacts.";
  }
}

export async function hasArtifact(fileName: string): Promise<boolean> {
  try {
    await fs.access(path.join(artifactDir(), fileName));
    return true;
  } catch {
    return false;
  }
}
