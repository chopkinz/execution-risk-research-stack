/**
 * Session analysis: Asia/London/NY session levels, fair value gaps,
 * liquidity sweeps, and trade opportunities. Uses 1h candles (UTC hours).
 */
import type { Candle } from "./market";

const ASIA_START = 0;
const ASIA_END = 8;
const LONDON_START = 8;
const LONDON_END = 16;
const NY_START = 14;
const NY_END = 22;

export type SessionLevel = {
  name: string;
  high: number;
  low: number;
  open: number;
  close: number;
  start_utc: string;
  end_utc: string;
};

export type FairValueGap = {
  kind: "bullish" | "bearish";
  top: number;
  bottom: number;
  label: string;
};

export type LiquiditySweep = {
  kind: "high_sweep" | "low_sweep";
  level: number;
  label: string;
};

export type SessionAnalysisResult = {
  session_levels: SessionLevel[];
  fvgs: FairValueGap[];
  sweeps: LiquiditySweep[];
  predicting_ny: string;
  opportunities: string[];
};

function sessionName(hourUtc: number): string {
  if (hourUtc >= ASIA_START && hourUtc < ASIA_END) return "Asia";
  if (hourUtc >= LONDON_START && hourUtc < LONDON_END) return "London";
  if (hourUtc >= NY_START && hourUtc < NY_END) return "NY";
  return "Overnight";
}

/** Assume candle times are in seconds (epoch). Convert to UTC for bucketing. */
function aggregateSessionLevels(candles: Candle[]): SessionLevel[] {
  const buckets: Map<string, { high: number; low: number; opens: number[]; closes: number[]; times: number[] }> = new Map();
  for (const c of candles) {
    const d = new Date(c.time * 1000);
    const date = d.toISOString().slice(0, 10);
    const hour = d.getUTCHours();
    const name = sessionName(hour);
    if (name === "Overnight") continue;
    const key = `${date}:${name}`;
    let b = buckets.get(key);
    if (!b) {
      b = { high: c.high, low: c.low, opens: [], closes: [], times: [] };
      buckets.set(key, b);
    }
    b.high = Math.max(b.high, c.high);
    b.low = Math.min(b.low, c.low);
    b.opens.push(c.open);
    b.closes.push(c.close);
    b.times.push(c.time);
  }
  const out: SessionLevel[] = [];
  const keys = Array.from(buckets.keys()).sort();
  for (const key of keys) {
    const b = buckets.get(key)!;
    const [date, name] = key.split(":");
    const sortedTimes = [...b.times].sort((a, b) => a - b);
    const startUtc = new Date(sortedTimes[0] * 1000).toISOString().slice(0, 16).replace("T", " ");
    const endUtc = new Date(sortedTimes[sortedTimes.length - 1] * 1000).toISOString().slice(0, 16).replace("T", " ");
    out.push({
      name,
      high: b.high,
      low: b.low,
      open: b.opens[0],
      close: b.closes[b.closes.length - 1],
      start_utc: startUtc,
      end_utc: endUtc,
    });
  }
  return out.slice(-12);
}

function detectFvg(candles: Candle[], lookback = 48): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  const arr = candles.slice(-lookback);
  if (arr.length < 3) return fvgs;
  for (let i = 0; i < arr.length - 2; i++) {
    const high0 = arr[i].high;
    const low0 = arr[i].low;
    const high2 = arr[i + 2].high;
    const low2 = arr[i + 2].low;
    if (low2 > high0) {
      fvgs.push({
        kind: "bullish",
        top: low2,
        bottom: high0,
        label: `Bullish FVG ${high0.toFixed(2)}–${low2.toFixed(2)}`,
      });
    }
    if (high2 < low0) {
      fvgs.push({
        kind: "bearish",
        top: low0,
        bottom: high2,
        label: `Bearish FVG ${high2.toFixed(2)}–${low0.toFixed(2)}`,
      });
    }
  }
  return fvgs.slice(-6);
}

function detectSweeps(candles: Candle[], lookback = 24, nPrior = 5): LiquiditySweep[] {
  const sweeps: LiquiditySweep[] = [];
  const arr = candles.slice(-lookback);
  if (arr.length < nPrior + 2) return sweeps;
  for (let i = nPrior; i < arr.length - 1; i++) {
    let priorHigh = arr[i - 1].high;
    let priorLow = arr[i - 1].low;
    for (let j = i - nPrior; j < i; j++) {
      priorHigh = Math.max(priorHigh, arr[j].high);
      priorLow = Math.min(priorLow, arr[j].low);
    }
    const h = arr[i].high;
    const l = arr[i].low;
    const c = arr[i].close;
    if (h > priorHigh && c < priorHigh) {
      sweeps.push({ kind: "high_sweep", level: priorHigh, label: `Highs swept at ${priorHigh.toFixed(2)}` });
    }
    if (l < priorLow && c > priorLow) {
      sweeps.push({ kind: "low_sweep", level: priorLow, label: `Lows swept at ${priorLow.toFixed(2)}` });
    }
  }
  return sweeps.slice(-4);
}

function predictingNy(sessions: SessionLevel[], nowUtc: Date): string {
  const hour = nowUtc.getUTCHours();
  const recent = sessions.filter((s) => s.name === "Asia" || s.name === "London" || s.name === "NY").slice(-6);
  if (!recent.length) return "";
  const asia = [...recent].reverse().find((s) => s.name === "Asia");
  const london = [...recent].reverse().find((s) => s.name === "London");
  const ny = [...recent].reverse().find((s) => s.name === "NY");
  const parts: string[] = [];
  if (hour < NY_START && asia) {
    parts.push(`Asia high ${asia.high.toFixed(2)} · Asia low ${asia.low.toFixed(2)}`);
  }
  if (hour < NY_START && london) {
    parts.push(`London high ${london.high.toFixed(2)} · London low ${london.low.toFixed(2)}`);
  }
  if (hour < NY_START) {
    parts.push("→ Watch for reaction at NY open (14:30 UTC)");
  } else if (ny) {
    parts.push(`NY session high ${ny.high.toFixed(2)} · NY low ${ny.low.toFixed(2)}`);
  }
  return parts.join(" · ");
}

function buildOpportunities(
  sessions: SessionLevel[],
  fvgs: FairValueGap[],
  sweeps: LiquiditySweep[],
  dailyHigh: number,
  dailyLow: number,
  dailyClose: number
): string[] {
  const opps: string[] = [];
  const recent = sessions.slice(-6);
  for (const fvg of fvgs.slice(-3)) {
    if (fvg.kind === "bullish" && dailyClose < fvg.top) {
      opps.push(`Long: bullish FVG ${fvg.bottom.toFixed(2)}–${fvg.top.toFixed(2)} — look for long on retest`);
    } else if (fvg.kind === "bearish" && dailyClose > fvg.bottom) {
      opps.push(`Short: bearish FVG ${fvg.bottom.toFixed(2)}–${fvg.top.toFixed(2)} — look for short on retest`);
    }
  }
  for (const sw of sweeps.slice(-2)) {
    if (sw.kind === "low_sweep") {
      opps.push(`Liquidity sweep (lows at ${sw.level.toFixed(2)}) — potential long if structure holds`);
    } else {
      opps.push(`Liquidity sweep (highs at ${sw.level.toFixed(2)}) — potential short if structure holds`);
    }
  }
  const asia = [...recent].reverse().find((s) => s.name === "Asia");
  const london = [...recent].reverse().find((s) => s.name === "London");
  const ny = [...recent].reverse().find((s) => s.name === "NY");
  if (asia && dailyClose <= asia.high && dailyClose >= asia.low) {
    opps.push(`Price inside Asia range ${asia.low.toFixed(2)}–${asia.high.toFixed(2)} — use as S/R`);
  }
  if (london && dailyClose <= london.high && dailyClose >= london.low) {
    opps.push(`Price inside London range ${london.low.toFixed(2)}–${london.high.toFixed(2)} — key level for NY`);
  }
  if (ny && dailyClose <= ny.high && dailyClose >= ny.low) {
    opps.push(`NY range ${ny.low.toFixed(2)}–${ny.high.toFixed(2)} — hold for trend or break for target`);
  }
  return opps.slice(0, 6);
}

export function runSessionAnalysis(
  candles1h: Candle[],
  dailyHigh: number,
  dailyLow: number,
  dailyClose: number
): SessionAnalysisResult {
  const session_levels = aggregateSessionLevels(candles1h);
  const fvgs = detectFvg(candles1h);
  const sweeps = detectSweeps(candles1h);
  const predicting_ny = predictingNy(session_levels, new Date());
  const opportunities = buildOpportunities(session_levels, fvgs, sweeps, dailyHigh, dailyLow, dailyClose);
  return {
    session_levels,
    fvgs,
    sweeps,
    predicting_ny,
    opportunities,
  };
}
