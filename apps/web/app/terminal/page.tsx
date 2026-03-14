"use client";

import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
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

  return (
    <Box
      sx={{
        minHeight: "100%",
        bgcolor: "background.default",
        color: "text.primary",
        fontFamily: "monospace",
        fontSize: { xs: "0.875rem", md: "1rem" },
      }}
    >
      <Box sx={{ mx: "auto", maxWidth: 672, px: { xs: 1.5, sm: 2 }, py: { xs: 2, md: 3 } }}>
        <Box sx={{ mb: 3, pb: 2, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Box component="h1" sx={{ m: 0, fontSize: { xs: "1rem", sm: "1.125rem" }, fontWeight: 700, color: "primary.main" }}>
              meridian session
            </Box>
            <Box component="p" sx={{ m: 0, mt: 0.5, fontSize: "0.75rem", color: "text.secondary" }}>
              Session highs and lows · Asia, London, NY · Refreshes every minute
            </Box>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ position: "relative" }}>
              <Box
                component="button"
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                sx={{
                  minHeight: 44,
                  minWidth: 44,
                  px: 1.5,
                  borderRadius: 1,
                  border: 1,
                  borderColor: "divider",
                  bgcolor: "action.hover",
                  color: "text.secondary",
                  fontSize: "0.75rem",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  "&:hover": { bgcolor: "action.selected" },
                }}
              >
                tickers ({symbols.length})
              </Box>
              {pickerOpen && (
                <>
                  <Box
                    sx={{
                      position: "absolute",
                      right: 0,
                      top: "100%",
                      zIndex: 20,
                      mt: 0.5,
                      maxHeight: 320,
                      width: 224,
                      overflowY: "auto",
                      borderRadius: 1,
                      border: 1,
                      borderColor: "divider",
                      bgcolor: "background.paper",
                      boxShadow: 2,
                      py: 0.5,
                    }}
                  >
                    {AVAILABLE_SYMBOLS.map(({ value, label }) => (
                      <Box
                        component="label"
                        key={value}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          px: 1.5,
                          py: 1.25,
                          minHeight: 44,
                          cursor: "pointer",
                          "&:hover": { bgcolor: "action.hover" },
                          fontSize: "0.8125rem",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={symbols.includes(value)}
                          onChange={() => {
                            setSymbols((prev) =>
                              prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
                            );
                          }}
                          style={{ width: 18, height: 18 }}
                        />
                        <Box component="span" sx={{ fontFamily: "monospace", color: "text.primary" }}>
                          {value}
                        </Box>
                        <Box component="span" sx={{ color: "text.secondary" }}>{label}</Box>
                      </Box>
                    ))}
                  </Box>
                  <Box
                    component="div"
                    aria-hidden
                    onClick={() => setPickerOpen(false)}
                    sx={{ position: "fixed", inset: 0, zIndex: 10 }}
                  />
                </>
              )}
            </Box>
            <Box
              component="button"
              type="button"
              onClick={fetchSession}
              disabled={loading}
              sx={{
                minHeight: 44,
                minWidth: 44,
                px: 1.5,
                borderRadius: 1,
                border: 1,
                borderColor: "divider",
                bgcolor: "action.hover",
                color: "text.secondary",
                fontSize: "0.75rem",
                fontFamily: "inherit",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
                "&:hover": !loading ? { bgcolor: "action.selected" } : undefined,
              }}
            >
              {loading ? "…" : "refresh"}
            </Box>
          </Box>
        </Box>

        {error && (
          <Box sx={{ mb: 2, p: 2, borderRadius: 1, border: 1, borderColor: "error.main", bgcolor: "action.hover", color: "error.main", fontSize: "0.875rem" }}>
            {error}
          </Box>
        )}

        {backtest && (
          <Box sx={{ mb: 3, p: 2, borderRadius: 2, border: 1, borderColor: "divider", bgcolor: "background.paper" }}>
            <Box sx={{ mb: 2, pb: 1.5, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
              <Box component="span" sx={{ fontWeight: 700, color: "success.main" }}>Latest backtest</Box>
              <Link
                href="/research"
                style={{ fontSize: "0.75rem", color: "var(--mui-palette-primary-main)", fontWeight: 500 }}
              >
                View full →
              </Link>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "1fr 1fr 1fr" }, gap: 0.75, fontSize: "0.75rem" }}>
              <Box><Box component="span" sx={{ color: "text.secondary" }}>Instrument </Box><Box component="span">{backtest.instrument}</Box></Box>
              <Box><Box component="span" sx={{ color: "text.secondary" }}>Timeframe </Box><Box component="span">{backtest.timeframe}</Box></Box>
              <Box><Box component="span" sx={{ color: "text.secondary" }}>Trades </Box><Box component="span">{backtest.trades}</Box></Box>
              <Box><Box component="span" sx={{ color: "text.secondary" }}>Win rate </Box><Box component="span">{(backtest.win_rate * 100).toFixed(1)}%</Box></Box>
              <Box><Box component="span" sx={{ color: "text.secondary" }}>Profit factor </Box><Box component="span">{backtest.profit_factor.toFixed(2)}</Box></Box>
              <Box><Box component="span" sx={{ color: "text.secondary" }}>Max drawdown </Box><Box component="span" sx={{ color: "error.main" }}>{backtest.max_drawdown_pct.toFixed(2)}%</Box></Box>
              <Box><Box component="span" sx={{ color: "text.secondary" }}>Total return </Box><Box component="span" sx={{ color: "success.main" }}>{backtest.total_return_pct.toFixed(2)}%</Box></Box>
              <Box><Box component="span" sx={{ color: "text.secondary" }}>Sharpe </Box><Box component="span">{backtest.sharpe != null ? backtest.sharpe.toFixed(2) : "—"}</Box></Box>
              <Box><Box component="span" sx={{ color: "text.secondary" }}>Run </Box><Box component="span" sx={{ color: "text.secondary" }}>{backtest.timestamp_utc.slice(0, 19)}</Box></Box>
            </Box>
            <Box sx={{ mt: 1.5, fontSize: "0.75rem", color: "text.secondary" }}>
              Strategy, risk, and execution; full artifacts in Research.
            </Box>
          </Box>
        )}

        {!backtest && (
          <Box sx={{ mb: 2, fontSize: "0.75rem", color: "text.secondary" }}>
            No backtest yet. Run one from <Link href="/research" style={{ color: "var(--mui-palette-primary-main)", fontWeight: 500 }}>Research</Link> or use the CLI: <Box component="code" sx={{ borderRadius: 0.5, px: 0.5, bgcolor: "action.hover" }}>meridian-backtest</Box>
          </Box>
        )}

        {data?.symbols.length === 0 && !loading && (
          <Box sx={{ color: "text.secondary", fontSize: "0.875rem" }}>No data for the selected symbols. Try refreshing or changing symbols.</Box>
        )}

        {loading && !data?.symbols?.length ? (
          <Stack spacing={2}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" height={120} sx={{ borderRadius: 2 }} />
            ))}
          </Stack>
        ) : (
        <Stack spacing={2}>
          {data?.symbols.map((s) => (
            <Box
              key={s.symbol}
              sx={{ borderRadius: 2, border: 1, borderColor: "divider", bgcolor: "background.paper", p: 2 }}
            >
              <Box sx={{ mb: 2, pb: 1.5, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>{s.symbol}</Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {INDEX_PROXY_SCALE[s.symbol] && (
                    <Box component="span" sx={{ fontSize: "10px", color: "text.secondary" }}>index scale (×10)</Box>
                  )}
                  <Box component="span" sx={{ fontSize: "0.75rem", color: "text.secondary" }}>{s.date}</Box>
                </Box>
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "1fr 1fr 1fr" }, gap: 0.75, fontSize: "0.75rem" }}>
                <Box><Box component="span" sx={{ color: "text.secondary" }}>Session high </Box><Box component="span" sx={{ color: "success.main" }}>{formatPrice(s.symbol, s.session_high)}</Box></Box>
                <Box><Box component="span" sx={{ color: "text.secondary" }}>Session low </Box><Box component="span" sx={{ color: "error.main" }}>{formatPrice(s.symbol, s.session_low)}</Box></Box>
                <Box><Box component="span" sx={{ color: "text.secondary" }}>Open </Box><Box component="span">{formatPrice(s.symbol, s.open)}</Box></Box>
                <Box><Box component="span" sx={{ color: "text.secondary" }}>Close </Box><Box component="span">{formatPrice(s.symbol, s.close)}</Box></Box>
                <Box><Box component="span" sx={{ color: "text.secondary" }}>Change % </Box><Box component="span" sx={{ color: s.change_pct >= 0 ? "success.main" : "error.main" }}>{s.change_pct >= 0 ? "+" : ""}{s.change_pct.toFixed(2)}%</Box></Box>
                <Box><Box component="span" sx={{ color: "text.secondary" }}>Volume </Box><Box component="span">{s.volume.toLocaleString()}</Box></Box>
              </Box>
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                <Box component="span" sx={{ color: "text.secondary" }}>Pattern </Box>
                <Box component="span" sx={{ color: s.pattern_color === "green" ? "success.main" : s.pattern_color === "red" ? "error.main" : s.pattern_color === "yellow" ? "warning.main" : "info.main" }}>{s.pattern}</Box>
              </Box>

              {s.predicting_ny && (
                <Box sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                  <Box sx={{ fontSize: "0.75rem", fontWeight: 600, color: "info.main" }}>Predicting in NY</Box>
                  <Box sx={{ mt: 0.5, fontSize: "0.75rem", color: "text.secondary" }}>{formatPricesInText(s.symbol, s.predicting_ny)}</Box>
                </Box>
              )}

              {s.session_levels && s.session_levels.length > 0 && (
                <Box sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                  <Box sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.primary" }}>Session summary</Box>
                  <Box sx={{ mt: 0.5, display: "flex", flexWrap: "wrap", gap: 0.5, fontSize: "0.75rem" }}>
                    {["Asia", "London", "NY"].map((name) => {
                      const level = [...s.session_levels!].reverse().find((l) => l.name === name);
                      if (!level) return null;
                      return (
                        <Box component="span" key={name}>
                          <Box component="span" sx={{ color: "text.secondary" }}>{name} </Box>
                          <Box component="span" sx={{ color: "success.main" }}>{formatPrice(s.symbol, level.high)}</Box>
                          <Box component="span" sx={{ color: "text.disabled" }}> / </Box>
                          <Box component="span" sx={{ color: "error.main" }}>{formatPrice(s.symbol, level.low)}</Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}

              {s.fvgs && s.fvgs.length > 0 && (
                <Box sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                  <Box sx={{ fontSize: "0.75rem", fontWeight: 600, color: "warning.main" }}>Fair value gaps</Box>
                  <Box component="ul" sx={{ mt: 0.5, pl: 2, listStyle: "disc", fontSize: "0.75rem", color: "text.secondary" }}>
                    {s.fvgs.slice(-3).map((fvg, i) => (
                      <li key={i}>
                        {fvg.kind === "bullish" ? (
                          <Box component="span" sx={{ color: "success.main" }}>{formatPrice(s.symbol, fvg.bottom)} – {formatPrice(s.symbol, fvg.top)}</Box>
                        ) : (
                          <Box component="span" sx={{ color: "error.main" }}>{formatPrice(s.symbol, fvg.bottom)} – {formatPrice(s.symbol, fvg.top)}</Box>
                        )}
                        {" "}{fvg.kind}
                      </li>
                    ))}
                  </Box>
                </Box>
              )}

              {s.sweeps && s.sweeps.length > 0 && (
                <Box sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                  <Box sx={{ fontSize: "0.75rem", fontWeight: 600, color: "secondary.main" }}>Liquidity sweeps</Box>
                  <Box component="ul" sx={{ mt: 0.5, pl: 2, listStyle: "disc", fontSize: "0.75rem", color: "text.secondary" }}>
                    {s.sweeps.slice(-2).map((sw, i) => (
                      <li key={i}>
                        {sw.kind === "low_sweep" ? (
                          <Box component="span" sx={{ color: "success.main" }}>Lows swept {formatPrice(s.symbol, sw.level)}</Box>
                        ) : (
                          <Box component="span" sx={{ color: "error.main" }}>Highs swept {formatPrice(s.symbol, sw.level)}</Box>
                        )}
                      </li>
                    ))}
                  </Box>
                </Box>
              )}

              {s.opportunities && s.opportunities.length > 0 && (
                <Box sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                  <Box sx={{ fontSize: "0.75rem", fontWeight: 600, color: "success.main" }}>Opportunities</Box>
                  <Box component="ul" sx={{ mt: 0.5, pl: 2, listStyle: "disc", fontSize: "0.75rem", color: "text.secondary" }}>
                    {s.opportunities.slice(0, 4).map((opp, i) => (
                      <li key={i}>{formatPricesInText(s.symbol, opp)}</li>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          ))}
        </Stack>
        )}

        <Box component="footer" sx={{ mt: 4, pt: 2, borderTop: 1, borderColor: "divider", fontSize: "0.75rem", color: "text.secondary" }}>
          <p style={{ margin: 0 }}>Session CLI: <code style={{ borderRadius: 4, padding: "0 4px", backgroundColor: "var(--mui-palette-action-hover)" }}>meridian-session QQQ SPY</code></p>
          <p style={{ margin: "4px 0 0" }}>Backtest CLI: <code style={{ borderRadius: 4, padding: "0 4px", backgroundColor: "var(--mui-palette-action-hover)" }}>meridian-backtest</code> or <code style={{ borderRadius: 4, padding: "0 4px", backgroundColor: "var(--mui-palette-action-hover)" }}>make backtest</code></p>
          <p style={{ margin: "8px 0 0" }}>Or: python -m engine.scripts.session_cli | python -m engine.scripts.backtest_cli</p>
          <p style={{ margin: "4px 0 0" }}>
            Session updated: {data?.refreshedAtUtc ? new Date(data.refreshedAtUtc).toLocaleTimeString() : "—"}
          </p>
        </Box>
      </Box>
    </Box>
  );
}
