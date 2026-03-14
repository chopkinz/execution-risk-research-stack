"use client";

import { ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChartSkeleton } from "./chart-skeleton";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Panel } from "./ui/panel";
import { StatTile } from "./ui/stat-tile";
import { Tabs } from "./ui/tabs";
import { useThemeMode } from "./providers/ThemeProvider";

type MarketRange = "1m" | "3m" | "6m" | "1y";
type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
type MarketPayload = {
  tickerLabel: string;
  requestedSymbol: string;
  resolvedSymbol: string;
  range: MarketRange;
  candles: Candle[];
  source: "yahoo" | "stooq" | "fallback_proxy";
  note?: string;
  refreshedAtUtc: string;
};

const QUICK = ["QQQ", "SPY", "GLD", "UUP"] as const;
const ADVANCED = ["NQ=F", "ES=F", "GC=F", "EURUSD=X", "^NDX", "^GSPC"] as const;
const RANGES: MarketRange[] = ["1m", "3m", "6m", "1y"];
const STYLE_OPTIONS = [
  { id: "candles", label: "Candles" },
  { id: "line", label: "Line" }
] as const;

type StyleMode = (typeof STYLE_OPTIONS)[number]["id"];
type HoverOhlc = { open: number; high: number; low: number; close: number } | null;

function numberFmt(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function pctFmt(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function sourceLabel(source: MarketPayload["source"]): string {
  if (source === "yahoo") return "Yahoo Finance";
  if (source === "stooq") return "Stooq";
  return "Proxy (fallback)";
}

function formatChicagoTime(isoUtc: string): string {
  const d = new Date(isoUtc);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(d);
}

function volatility20d(candles: Candle[]): number {
  if (candles.length < 21) return 0;
  const slice = candles.slice(-21);
  const returns: number[] = [];
  for (let i = 1; i < slice.length; i += 1) {
    const prev = slice[i - 1].close;
    const curr = slice[i].close;
    if (prev > 0 && curr > 0) returns.push(Math.log(curr / prev));
  }
  if (!returns.length) return 0;
  const mean = returns.reduce((acc, val) => acc + val, 0) / returns.length;
  const variance = returns.reduce((acc, val) => acc + (val - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

const CHART_THEME = {
  light: {
    layout: { background: { type: ColorType.Solid, color: "#ffffff" }, textColor: "#475569" },
    rightPriceScale: { borderColor: "#e2e8f0" },
    timeScale: { borderColor: "#e2e8f0" },
    grid: { vertLines: { color: "#f1f5f9" }, horzLines: { color: "#f1f5f9" } },
    upColor: "#0d47a1",
    downColor: "#334155",
    lineColor: "#0d47a1",
    volumeUp: "rgba(13,71,161,0.35)",
    volumeDown: "rgba(51,65,85,0.35)"
  },
  dark: {
    layout: { background: { type: ColorType.Solid, color: "#161b22" }, textColor: "#8b949e" },
    rightPriceScale: { borderColor: "#30363d" },
    timeScale: { borderColor: "#30363d" },
    grid: { vertLines: { color: "#21262d" }, horzLines: { color: "#21262d" } },
    upColor: "#58a6ff",
    downColor: "#8b949e",
    lineColor: "#58a6ff",
    volumeUp: "rgba(88,166,255,0.35)",
    volumeDown: "rgba(139,148,158,0.35)"
  }
};

export function MarketsDashboard() {
  const { mode } = useThemeMode();
  const [selectedSymbol, setSelectedSymbol] = useState("QQQ");
  const [reloadToken, setReloadToken] = useState(0);
  const [range, setRange] = useState<MarketRange>("6m");
  const [styleMode, setStyleMode] = useState<StyleMode>("candles");
  const [data, setData] = useState<MarketPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState<HoverOhlc>(null);

  const chartRootRef = useRef<HTMLDivElement | null>(null);
  const chartTheme = CHART_THEME[mode];
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/market?symbol=${encodeURIComponent(selectedSymbol)}&range=${range}`);
        if (!res.ok) throw new Error("Data temporarily unavailable.");
        const payload = (await res.json()) as MarketPayload;
        setData(payload);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unable to load market data.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedSymbol, range, reloadToken]);

  useEffect(() => {
    const container = chartRootRef.current;
    if (!container) return;
    const t = chartTheme;
    const chart = createChart(container, {
      autoSize: true,
      layout: t.layout,
      rightPriceScale: t.rightPriceScale,
      timeScale: t.timeScale,
      grid: t.grid,
      crosshair: { mode: 0 }
    });
    chartRef.current = chart;
    const candleSeries = chart.addCandlestickSeries({
      upColor: t.upColor,
      downColor: t.downColor,
      borderVisible: false,
      wickUpColor: t.upColor,
      wickDownColor: t.downColor
    });
    const lineSeries = chart.addLineSeries({ color: t.lineColor, lineWidth: 2 });
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume"
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });

    candleSeriesRef.current = candleSeries;
    lineSeriesRef.current = lineSeries;
    volumeSeriesRef.current = volumeSeries;

    chart.subscribeCrosshairMove((param) => {
      const time = param.time;
      if (!data || typeof time !== "number") return setHover(null);
      const match = data.candles.find((c) => c.time === time);
      setHover(match ? { open: match.open, high: match.high, low: match.low, close: match.close } : null);
    });

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      lineSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [data, chartTheme]);

  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !lineSeriesRef.current) return;
    const t = chartTheme;
    chartRef.current.applyOptions({
      layout: t.layout,
      rightPriceScale: t.rightPriceScale,
      timeScale: t.timeScale,
      grid: t.grid
    });
    candleSeriesRef.current.applyOptions({
      upColor: t.upColor,
      downColor: t.downColor,
      wickUpColor: t.upColor,
      wickDownColor: t.downColor
    });
    lineSeriesRef.current.applyOptions({ color: t.lineColor });
  }, [mode, chartTheme]);

  useEffect(() => {
    if (!data || !candleSeriesRef.current || !lineSeriesRef.current || !volumeSeriesRef.current) return;
    candleSeriesRef.current.setData(
      data.candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close }))
    );
    lineSeriesRef.current.setData(data.candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })));
    const t = CHART_THEME[mode];
    volumeSeriesRef.current.setData(
      data.candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? t.volumeUp : t.volumeDown
      }))
    );
    chartRef.current?.timeScale().fitContent();
  }, [data, mode]);

  useEffect(() => {
    candleSeriesRef.current?.applyOptions({ visible: styleMode === "candles" });
    lineSeriesRef.current?.applyOptions({ visible: styleMode === "line" });
  }, [styleMode]);

  const stats = useMemo(() => {
    if (!data?.candles?.length) {
      return { lastClose: "n/a", change: "n/a", dayRange: "n/a", vol20d: "n/a" };
    }
    const first = data.candles[0];
    const last = data.candles[data.candles.length - 1];
    const change = ((last.close - first.close) / first.close) * 100;
    return {
      lastClose: numberFmt(last.close),
      change: pctFmt(change),
      dayRange: `${numberFmt(last.low)} - ${numberFmt(last.high)}`,
      vol20d: `${volatility20d(data.candles).toFixed(2)}%`
    };
  }, [data]);

  const statusDegraded = data?.source === "fallback_proxy";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Badge tone={statusDegraded ? "amber" : "green"}>{statusDegraded ? "Data: Limited" : "Data: Live"}</Badge>
      </div>
      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <Panel title="Watchlist" subtitle="Quick symbols and advanced instruments">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-[var(--meridian-text-secondary)]">Quick</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK.map((symbol) => (
              <button
                key={symbol}
                type="button"
                onClick={() => setSelectedSymbol(symbol)}
                className={`rounded-md border px-3 py-2 text-left text-sm ${
                  selectedSymbol === symbol
                    ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/50 dark:bg-brand-500/20 dark:text-brand-300"
                    : "border-slate-200 text-slate-700 dark:border-[var(--meridian-divider)] dark:text-[var(--meridian-text-primary)] dark:bg-transparent dark:hover:bg-white/5"
                }`}
              >
                {symbol}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-[var(--meridian-text-secondary)]">Advanced</p>
              <Badge tone="gray">beta</Badge>
            </div>
            <select
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-[var(--meridian-divider)] dark:bg-[var(--meridian-bg-paper)] dark:text-[var(--meridian-text-primary)]"
              value={ADVANCED.includes(selectedSymbol as (typeof ADVANCED)[number]) ? selectedSymbol : ADVANCED[0]}
              onChange={(e) => setSelectedSymbol(e.target.value)}
            >
              {ADVANCED.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </div>
        </Panel>

        <Panel
          title="Chart"
          subtitle="Daily candles for review and research."
          right={<Tabs options={STYLE_OPTIONS.map((o) => ({ id: o.id, label: o.label }))} active={styleMode} onChange={(id) => setStyleMode(id as StyleMode)} />}
        >
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
            <StatTile label="Last" value={stats.lastClose} />
            <StatTile label="Change %" value={stats.change} />
            <StatTile label="Day Range" value={stats.dayRange} />
            <StatTile label="20D Volatility" value={stats.vol20d} />
            <StatTile label="Source" value={data ? sourceLabel(data.source) : "n/a"} />
            <StatTile label="Last refreshed (CT)" value={data ? formatChicagoTime(data.refreshedAtUtc) : "n/a"} />
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase ${
                  range === r
                    ? "bg-brand-600 text-white dark:bg-[var(--meridian-primary)] dark:text-[var(--meridian-bg-default)]"
                    : "border border-slate-200 text-slate-700 dark:border-[var(--meridian-divider)] dark:text-[var(--meridian-text-primary)] dark:hover:bg-white/5"
                }`}
              >
                {r}
              </button>
            ))}
            <Badge tone={data?.source === "fallback_proxy" ? "amber" : "gray"}>
              {data ? sourceLabel(data.source) : "Source pending"}
            </Badge>
            {data?.source === "fallback_proxy" ? <Badge tone="amber">Limited (proxy)</Badge> : null}
          </div>
          <div className="h-[480px] rounded-lg border border-slate-200 bg-white overflow-hidden dark:border-[var(--meridian-divider)] dark:bg-[var(--meridian-bg-paper)]">
            {loading ? (
              <ChartSkeleton height={480} />
            ) : error ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <p className="text-sm text-amber-700 dark:text-amber-400">Data temporarily unavailable</p>
                <Button variant="secondary" onClick={() => setReloadToken((v) => v + 1)}>
                  Retry
                </Button>
              </div>
            ) : (
              <div ref={chartRootRef} className="h-full w-full" />
            )}
          </div>
        </Panel>

        <Panel title="Details" subtitle="Symbol context and crosshair OHLC">
          <div className="space-y-3 text-sm text-slate-700 dark:text-[var(--meridian-text-primary)]">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-[var(--meridian-divider)] dark:bg-white/5">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-[var(--meridian-text-secondary)]">Requested</p>
              <p className="tabular font-medium">{data?.requestedSymbol ?? selectedSymbol}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-[var(--meridian-divider)] dark:bg-white/5">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-[var(--meridian-text-secondary)]">Resolved</p>
              <p className="tabular font-medium">{data?.resolvedSymbol ?? "n/a"}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-[var(--meridian-divider)] dark:bg-white/5">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-[var(--meridian-text-secondary)]">OHLC at crosshair</p>
              <p className="tabular text-xs">
                {hover
                  ? `Open ${numberFmt(hover.open)} · High ${numberFmt(hover.high)} · Low ${numberFmt(hover.low)} · Close ${numberFmt(hover.close)}`
                  : "Hover over the chart to see values"}
              </p>
            </div>
            {data?.note ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
                {data.note}
              </div>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
