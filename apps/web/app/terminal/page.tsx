"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getAvailableSymbols } from "../../lib/market";

type SessionLevel = {
  name: string;
  high: number;
  low: number;
  open: number;
  close: number;
  start_utc: string;
  end_utc: string;
};

type FairValueGap = { kind: "bullish" | "bearish"; top: number; bottom: number; label: string };
type LiquiditySweep = { kind: "high_sweep" | "low_sweep"; level: number; label: string };

type SessionSummary = {
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

type SessionPayload = {
  refreshedAtUtc: string;
  symbols: SessionSummary[];
};

type BacktestSummary = {
  instrument: string;
  timeframe: string;
  start: string;
  end: string;
  trades: number;
  win_rate: number;
  profit_factor: number;
  max_drawdown_pct: number;
  total_return_pct: number;
  sharpe: number | null;
  timestamp_utc: string;
  risk?: { max_daily_loss_pct: number; kill_switch_drawdown_pct: number };
  execution?: { spread_model: string; slippage_model: string };
};

const DEFAULT_SYMBOLS = ["QQQ", "SPY", "^GSPC", "ES=F", "GLD", "IWM"];

/** Index proxy scale only for ETFs charted as index (SPY→SPX, QQQ→NDX). Indices/futures (^GSPC, ES=F) already at index level. */
const INDEX_PROXY_SCALE: Record<string, number> = { SPY: 10, QQQ: 10 };

function formatPrice(symbol: string, price: number): string {
  const scale = INDEX_PROXY_SCALE[symbol];
  const value = scale ? price * scale : price;
  if (value >= 1000) return value.toFixed(1);
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(4);
}

/** Replace price-like numbers in text with index-scale for SPY/QQQ only. */
function formatPricesInText(symbol: string, text: string): string {
  const scale = INDEX_PROXY_SCALE[symbol];
  if (!scale || scale === 1) return text;
  return text.replace(/\d+\.\d+/g, (m) => {
    const v = parseFloat(m) * scale;
    return v >= 1000 ? v.toFixed(1) : v.toFixed(2);
  });
}

const AVAILABLE_SYMBOLS = getAvailableSymbols();

export default function TerminalPage() {
  const [data, setData] = useState<SessionPayload | null>(null);
  const [backtest, setBacktest] = useState<BacktestSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [pickerOpen, setPickerOpen] = useState(false);

  const fetchSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/session?symbols=${encodeURIComponent(symbols.join(","))}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Session data unavailable");
      const payload = (await res.json()) as SessionPayload;
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  const fetchBacktest = useCallback(async () => {
    try {
      const statusRes = await fetch("/api/research/status", { cache: "no-store" });
      const status = (await statusRes.json()) as { ready: boolean };
      if (!status.ready) {
        setBacktest(null);
        return;
      }
      const sumRes = await fetch("/research/latest/summary.json", { cache: "no-store" });
      if (!sumRes.ok) {
        setBacktest(null);
        return;
      }
      const summary = (await sumRes.json()) as BacktestSummary;
      setBacktest(summary);
    } catch {
      setBacktest(null);
    }
  }, []);

  useEffect(() => {
    fetchSession();
    fetchBacktest();
    const t = setInterval(fetchSession, 60 * 1000);
    return () => clearInterval(t);
  }, [fetchSession, fetchBacktest]);

  const colorClass = (c: string) => {
    if (c === "green") return "text-emerald-400";
    if (c === "red") return "text-red-400";
    if (c === "yellow") return "text-amber-400";
    if (c === "blue") return "text-sky-400";
    return "text-slate-500";
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-300 font-mono text-sm md:text-base">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-6 flex items-center justify-between border-b border-slate-700 pb-3">
          <div>
            <h1 className="text-lg font-bold text-emerald-400">meridian session</h1>
            <p className="text-xs text-slate-500">
              session highs · Asia/London/NY · FVGs · sweeps · opportunities · refresh every 1m
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                className="rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700"
              >
                tickers ({symbols.length})
              </button>
              {pickerOpen && (
                <>
                  <div className="absolute right-0 top-full z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded border border-slate-600 bg-slate-900 py-1 shadow-lg">
                    {AVAILABLE_SYMBOLS.map(({ value, label }) => (
                      <label
                        key={value}
                        className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-800"
                      >
                        <input
                          type="checkbox"
                          checked={symbols.includes(value)}
                          onChange={() => {
                            setSymbols((prev) =>
                              prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
                            );
                          }}
                          className="rounded border-slate-600"
                        />
                        <span className="font-mono text-slate-200">{value}</span>
                        <span className="text-slate-500">{label}</span>
                      </label>
                    ))}
                  </div>
                  <div
                    className="fixed inset-0 z-10"
                    aria-hidden
                    onClick={() => setPickerOpen(false)}
                  />
                </>
              )}
            </div>
            <button
              type="button"
              onClick={fetchSession}
              disabled={loading}
              className="rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? "…" : "refresh"}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded border border-red-900/50 bg-red-950/30 px-4 py-2 text-red-400">
            {error}
          </div>
        )}

        {backtest && (
          <div className="mb-6 rounded-lg border border-slate-700 bg-slate-900/50 p-4">
            <div className="mb-3 flex items-center justify-between border-b border-slate-700 pb-2">
              <span className="font-bold text-emerald-400">last backtest</span>
              <Link
                href="/research"
                className="text-xs text-sky-400 hover:underline"
              >
                view full →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs md:grid-cols-3">
              <div><span className="text-slate-500">instrument </span><span>{backtest.instrument}</span></div>
              <div><span className="text-slate-500">timeframe </span><span>{backtest.timeframe}</span></div>
              <div><span className="text-slate-500">trades </span><span>{backtest.trades}</span></div>
              <div><span className="text-slate-500">win_rate% </span><span>{(backtest.win_rate * 100).toFixed(1)}</span></div>
              <div><span className="text-slate-500">profit_factor </span><span>{backtest.profit_factor.toFixed(2)}</span></div>
              <div><span className="text-slate-500">max_dd% </span><span className="text-red-400">{backtest.max_drawdown_pct.toFixed(2)}</span></div>
              <div><span className="text-slate-500">total_return% </span><span className="text-emerald-400">{backtest.total_return_pct.toFixed(2)}</span></div>
              <div><span className="text-slate-500">sharpe </span><span>{backtest.sharpe != null ? backtest.sharpe.toFixed(2) : "—"}</span></div>
              <div><span className="text-slate-500">run </span><span className="text-slate-500">{backtest.timestamp_utc.slice(0, 19)}</span></div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Strategy → risk engine → execution sim; artifacts in Research (Unified / Risk Lab / Execution Sim).
            </p>
          </div>
        )}

        {!backtest && (
          <p className="mb-4 text-xs text-slate-500">
            No backtest yet. Run one from <Link href="/research" className="text-sky-400 hover:underline">Research</Link> or CLI: <code className="rounded bg-slate-800 px-1">meridian-backtest</code>
          </p>
        )}

        {data?.symbols.length === 0 && !loading && (
          <p className="text-slate-500">No session data. Check symbols or try again.</p>
        )}

        <div className="space-y-4">
          {data?.symbols.map((s) => (
            <div
              key={s.symbol}
              className="rounded-lg border border-slate-700 bg-slate-900/50 p-4"
            >
              <div className="mb-3 flex items-center justify-between border-b border-slate-700 pb-2">
                <span className="font-bold text-slate-200">{s.symbol}</span>
                <span className="flex items-center gap-2">
                  {INDEX_PROXY_SCALE[s.symbol] && (
                    <span className="text-[10px] text-slate-500">index scale (×10)</span>
                  )}
                  <span className="text-xs text-slate-500">{s.date}</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs md:grid-cols-3">
                <div>
                  <span className="text-slate-500">session_high </span>
                  <span className="text-emerald-400">{formatPrice(s.symbol, s.session_high)}</span>
                </div>
                <div>
                  <span className="text-slate-500">session_low </span>
                  <span className="text-red-400">{formatPrice(s.symbol, s.session_low)}</span>
                </div>
                <div>
                  <span className="text-slate-500">open </span>
                  <span>{formatPrice(s.symbol, s.open)}</span>
                </div>
                <div>
                  <span className="text-slate-500">close </span>
                  <span>{formatPrice(s.symbol, s.close)}</span>
                </div>
                <div>
                  <span className="text-slate-500">change% </span>
                  <span className={s.change_pct >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {s.change_pct >= 0 ? "+" : ""}{s.change_pct.toFixed(2)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">volume </span>
                  <span>{s.volume.toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-2 border-t border-slate-700 pt-2">
                <span className="text-slate-500">pattern </span>
                <span className={colorClass(s.pattern_color)}>{s.pattern}</span>
              </div>

              {s.predicting_ny && (
                <div className="mt-3 border-t border-slate-700 pt-2">
                  <div className="text-xs font-medium text-cyan-400">Predicting in NY</div>
                  <p className="mt-0.5 text-xs text-slate-400">{formatPricesInText(s.symbol, s.predicting_ny)}</p>
                </div>
              )}

              {s.session_levels && s.session_levels.length > 0 && (
                <div className="mt-3 border-t border-slate-700 pt-2">
                  <div className="text-xs font-medium text-slate-300">Session summary</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {["Asia", "London", "NY"].map((name) => {
                      const level = [...s.session_levels!].reverse().find((l) => l.name === name);
                      if (!level) return null;
                      return (
                        <span key={name}>
                          <span className="text-slate-500">{name}</span>{" "}
                          <span className="text-emerald-400">{formatPrice(s.symbol, level.high)}</span>
                          <span className="text-slate-600"> / </span>
                          <span className="text-red-400">{formatPrice(s.symbol, level.low)}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {s.fvgs && s.fvgs.length > 0 && (
                <div className="mt-3 border-t border-slate-700 pt-2">
                  <div className="text-xs font-medium text-amber-400">Fair value gaps</div>
                  <ul className="mt-0.5 list-inside list-disc text-xs text-slate-400">
                    {s.fvgs.slice(-3).map((fvg, i) => (
                      <li key={i}>
                        {fvg.kind === "bullish" ? (
                          <span className="text-emerald-400">{formatPrice(s.symbol, fvg.bottom)} – {formatPrice(s.symbol, fvg.top)}</span>
                        ) : (
                          <span className="text-red-400">{formatPrice(s.symbol, fvg.bottom)} – {formatPrice(s.symbol, fvg.top)}</span>
                        )}
                        {" "}{fvg.kind}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {s.sweeps && s.sweeps.length > 0 && (
                <div className="mt-3 border-t border-slate-700 pt-2">
                  <div className="text-xs font-medium text-fuchsia-400">Liquidity sweeps</div>
                  <ul className="mt-0.5 list-inside list-disc text-xs text-slate-400">
                    {s.sweeps.slice(-2).map((sw, i) => (
                      <li key={i}>
                        {sw.kind === "low_sweep" ? (
                          <span className="text-emerald-400">Lows swept {formatPrice(s.symbol, sw.level)}</span>
                        ) : (
                          <span className="text-red-400">Highs swept {formatPrice(s.symbol, sw.level)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {s.opportunities && s.opportunities.length > 0 && (
                <div className="mt-3 border-t border-slate-700 pt-2">
                  <div className="text-xs font-medium text-emerald-400">Opportunities</div>
                  <ul className="mt-0.5 list-inside list-disc text-xs text-slate-400">
                    {s.opportunities.slice(0, 4).map((opp, i) => (
                      <li key={i}>{formatPricesInText(s.symbol, opp)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        <footer className="mt-8 border-t border-slate-700 pt-4 text-xs text-slate-500">
          <p>Session CLI: <code className="rounded bg-slate-800 px-1">meridian-session QQQ SPY</code></p>
          <p className="mt-1">Backtest CLI: <code className="rounded bg-slate-800 px-1">meridian-backtest</code> or <code className="rounded bg-slate-800 px-1">make backtest</code></p>
          <p className="mt-2">Or: python -m engine.scripts.session_cli | python -m engine.scripts.backtest_cli</p>
          <p className="mt-1">
            Session updated: {data?.refreshedAtUtc ? new Date(data.refreshedAtUtc).toLocaleTimeString() : "—"}
          </p>
        </footer>
      </div>
    </div>
  );
}
