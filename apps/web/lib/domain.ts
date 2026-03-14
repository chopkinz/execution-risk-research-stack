/**
 * Shared domain types for Meridian Terminal.
 * Align with engine concepts (Bar, OrderIntent, Fill, etc.) where applicable.
 * Single source of truth for frontend domain models.
 */

// Re-export from market for canonical Candle type
export type { Candle, MarketPayload, MarketRange } from "./market";

/** Quote snapshot (bid/ask/last). For future real-time or L2. */
export type Quote = {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume?: number;
  timestamp: string; // ISO
};

/** Session summary (aligns with engine session output). */
export type SessionSummary = {
  symbol: string;
  session_high: number;
  session_low: number;
  open: number;
  close: number;
  volume: number;
  change_pct: number;
  pattern: string;
  pattern_color: string;
  date: string;
  session_levels?: SessionLevel[];
  fvgs?: FairValueGap[];
  sweeps?: LiquiditySweep[];
  predicting_ny?: string;
  opportunities?: string[];
};

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

/** Run summary (aligns with summary.json from engine). */
export type RunSummary = {
  run_id?: string;
  timestamp_utc?: string;
  instrument?: string;
  timeframe?: string;
  start?: string;
  end?: string;
  trades?: number;
  win_rate?: number;
  profit_factor?: number;
  max_drawdown_pct?: number;
  total_return_pct?: number;
  sharpe?: number | null;
  risk?: {
    max_daily_loss_pct?: number;
    max_exposure_pct?: number;
    max_gross_exposure?: number;
    kill_switch_drawdown_pct?: number;
    max_drawdown_pct?: number;
  };
  execution?: {
    spread_model?: string;
    slippage_model?: string;
    fees_model?: string;
  };
};

/** Research artifact readiness (aligns with /api/research/status). */
export type ResearchStatus = {
  ready: boolean;
  lastRunAtUtc: string | null;
  missing: string[];
};
