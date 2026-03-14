import { fetchMarketData, fetchYahooCandles1h, getYahooSymbol } from "../../../lib/market";
import { runSessionAnalysis } from "../../../lib/sessionAnalysis";
import type { SessionLevel, FairValueGap, LiquiditySweep } from "../../../lib/sessionAnalysis";

export type SessionSummary = {
  symbol: string;
  session_high: number;
  session_low: number;
  open: number;
  close: number;
  volume: number;
  change_pct: number;
  pattern: string;
  pattern_color: "green" | "red" | "yellow" | "blue" | "dim";
  date: string;
  session_levels?: SessionLevel[];
  fvgs?: FairValueGap[];
  sweeps?: LiquiditySweep[];
  predicting_ny?: string;
  opportunities?: string[];
};

function detectPattern(
  lastHigh: number,
  lastLow: number,
  prevHigh: number,
  prevLow: number
): { pattern: string; pattern_color: SessionSummary["pattern_color"] } {
  if (lastHigh > prevHigh && lastLow > prevLow) return { pattern: "HH/HL (bullish)", pattern_color: "green" };
  if (lastHigh < prevHigh && lastLow < prevLow) return { pattern: "LH/LL (bearish)", pattern_color: "red" };
  if (lastHigh > prevHigh && lastLow < prevLow) return { pattern: "HH/LL (expansion)", pattern_color: "yellow" };
  return { pattern: "LH/HL (contraction)", pattern_color: "blue" };
}

export const dynamic = "force-dynamic";

const DEFAULT_SYMBOLS = ["QQQ", "SPY", "^GSPC", "ES=F", "GLD", "IWM"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get("symbols");
  const symbols = symbolsParam
    ? symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : DEFAULT_SYMBOLS;

  const results: SessionSummary[] = [];

  for (const symbol of symbols) {
    try {
      const payload = await fetchMarketData(symbol, "1m");
      const candles = payload.candles;
      if (!candles || candles.length < 2) continue;
      const last = candles[candles.length - 1];
      const prev = candles[candles.length - 2];
      const session_high = last.high;
      const session_low = last.low;
      const open = last.open;
      const close = last.close;
      const volume = last.volume ?? 0;
      const change_pct = open ? ((close - open) / open) * 100 : 0;
      const { pattern, pattern_color } = detectPattern(
        last.high,
        last.low,
        prev.high,
        prev.low
      );
      const date = new Date(last.time * 1000).toISOString().slice(0, 10);
      const entry: SessionSummary = {
        symbol: payload.resolvedSymbol ?? symbol,
        session_high,
        session_low,
        open,
        close,
        volume,
        change_pct,
        pattern,
        pattern_color,
        date,
      };
      try {
        const yahooSymbol = getYahooSymbol(symbol);
        const candles1h = await fetchYahooCandles1h(yahooSymbol);
        if (candles1h.length >= 3) {
          const analysis = runSessionAnalysis(candles1h, session_high, session_low, close);
          entry.session_levels = analysis.session_levels;
          entry.fvgs = analysis.fvgs;
          entry.sweeps = analysis.sweeps;
          entry.predicting_ny = analysis.predicting_ny;
          entry.opportunities = analysis.opportunities;
        }
      } catch {
        // keep entry without 1h analysis
      }
      results.push(entry);
    } catch {
      // skip symbol on error
    }
  }

  return Response.json({
    refreshedAtUtc: new Date().toISOString(),
    symbols: results,
  }, {
    headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=300" },
  });
}
