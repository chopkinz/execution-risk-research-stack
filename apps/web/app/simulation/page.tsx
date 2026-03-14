"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Panel } from "../../components/ui/panel";

const SYMBOLS = [
  { value: "^NDX", label: "NAS100 (^NDX)" },
  { value: "NQ=F", label: "NQ Futures" },
  { value: "SPY", label: "SPY" },
  { value: "QQQ", label: "QQQ" },
  { value: "GC=F", label: "Gold" },
  { value: "EURUSD=X", label: "EUR/USD" },
];
const INTERVALS = ["1m", "5m", "15m", "1h", "1d"];
const PERIODS = ["5d", "30d", "60d", "90d"];
const STRATEGIES = [
  { value: "momentum", label: "Momentum" },
  { value: "session_breakout", label: "Session Breakout" },
  { value: "fvg_retracement", label: "FVG Retracement" },
];

const ARTIFACT_BASE = "/research/latest";

function parseCsv(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  return lines.map((line) => {
    const row: string[] = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') inQuotes = !inQuotes;
      else if (c === "," && !inQuotes) {
        row.push(cell.trim());
        cell = "";
      } else cell += c;
    }
    row.push(cell.trim());
    return row;
  });
}

type Summary = {
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
};

type Metrics = Record<string, number | string>;

export default function SimulationLabPage() {
  const [symbol, setSymbol] = useState("^NDX");
  const [interval, setInterval] = useState("15m");
  const [period, setPeriod] = useState("60d");
  const [strategy, setStrategy] = useState("momentum");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [tradesRows, setTradesRows] = useState<string[][]>([]);
  const [rejectionsRows, setRejectionsRows] = useState<string[][]>([]);
  const [artifactsTs, setArtifactsTs] = useState(0);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${ARTIFACT_BASE}/summary.json`, { cache: "no-store" });
      if (res.ok) setSummary((await res.json()) as Summary);
      else setSummary(null);
    } catch {
      setSummary(null);
    }
  }, []);

  const fetchOutputs = useCallback(async () => {
    setArtifactsTs(Date.now());
    try {
      const [metricsRes, tradesRes, rejRes] = await Promise.all([
        fetch(`${ARTIFACT_BASE}/metrics.json`, { cache: "no-store" }),
        fetch(`${ARTIFACT_BASE}/trades.csv`, { cache: "no-store" }),
        fetch(`${ARTIFACT_BASE}/risk_rejections.csv`, { cache: "no-store" }),
      ]);
      if (metricsRes.ok) setMetrics((await metricsRes.json()) as Metrics);
      else setMetrics(null);
      if (tradesRes.ok) {
        const text = await tradesRes.text();
        setTradesRows(parseCsv(text));
          } else setTradesRows([]);
      if (rejRes.ok) {
        const text = await rejRes.text();
        setRejectionsRows(parseCsv(text));
      } else setRejectionsRows([]);
    } catch {
      setMetrics(null);
      setTradesRows([]);
      setRejectionsRows([]);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const runSimulation = useCallback(async () => {
    setLogs([]);
    setMessage("");
    setRunning(true);
    const res = await fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, interval, period, strategy: { name: strategy, qty: 1 } }),
    });

    if (res.headers.get("content-type")?.includes("application/json")) {
      const payload = (await res.json()) as { message?: string };
      setMessage(payload.message ?? "Simulate API unavailable.");
      setRunning(false);
      return;
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let success = false;

    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const dataLine = chunk.match(/^data:\s*(.+)$/m)?.[1];
          if (!dataLine) continue;
          try {
            const payload = JSON.parse(dataLine) as { stream?: string; message?: string; ok?: boolean; event?: string };
            const msg = payload.message ?? "";
            if (msg) setLogs((prev) => [...prev, msg.trimEnd()]);
            if (payload.ok === true || payload.ok === false) {
              success = payload.ok;
              setMessage(payload.message ?? "");
            }
          } catch {
            // skip
          }
        }
      }
    }
    setRunning(false);
    if (success) {
      await fetchSummary();
      await fetchOutputs();
    }
  }, [symbol, interval, period, strategy, fetchSummary, fetchOutputs]);

  useEffect(() => {
    if (summary) fetchOutputs();
  }, [summary?.run_id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">Simulation Lab</h1>
          <p className="mt-1 text-sm text-slate-600">
            Choose symbol, interval, date range, and strategy. Run simulation and inspect results.
          </p>
        </div>
        <Link href="/research">
          <Button variant="secondary">View Research</Button>
        </Link>
      </header>

      <Panel title="Run parameters" subtitle="All controls drive backend behavior">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Symbol</label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {SYMBOLS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Interval</label>
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {INTERVALS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Strategy</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={runSimulation} disabled={running}>
            {running ? "Running…" : "Run Simulation"}
          </Button>
        </div>
      </Panel>

      {message && (
        <Panel title="Status">
          <p className="text-sm text-slate-700">{message}</p>
        </Panel>
      )}

      <Panel title="Streaming logs" subtitle="Live engine output">
        <pre className="max-h-72 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
          {logs.length ? logs.join("\n") : "No logs yet. Run a simulation."}
        </pre>
      </Panel>

      {summary && (
        <>
          <Panel title="Latest run summary" subtitle="From last successful simulation">
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><span className="text-slate-500">Instrument </span><span className="font-medium">{summary.instrument}</span></div>
              <div><span className="text-slate-500">Timeframe </span><span className="font-medium">{summary.timeframe}</span></div>
              <div><span className="text-slate-500">Trades </span><span className="font-medium">{summary.trades}</span></div>
              <div><span className="text-slate-500">Win rate </span><span className="font-medium">{summary.win_rate != null ? `${(summary.win_rate * 100).toFixed(1)}%` : "—"}</span></div>
              <div><span className="text-slate-500">Profit factor </span><span className="font-medium">{summary.profit_factor?.toFixed(2) ?? "—"}</span></div>
              <div><span className="text-slate-500">Max DD% </span><span className="font-medium text-red-600">{summary.max_drawdown_pct?.toFixed(2) ?? "—"}%</span></div>
              <div><span className="text-slate-500">Total return% </span><span className="font-medium text-emerald-600">{summary.total_return_pct?.toFixed(2) ?? "—"}%</span></div>
              <div><span className="text-slate-500">Run ID </span><span className="font-mono text-xs">{summary.run_id ?? "—"}</span></div>
            </div>
          </Panel>

          <Panel title="Equity & drawdown" subtitle="Charts from engine output">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Equity curve</p>
                <img src={`${ARTIFACT_BASE}/equity_curve.png?t=${artifactsTs}`} alt="Equity curve" className="w-full rounded border border-slate-200" />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Drawdown</p>
                <img src={`${ARTIFACT_BASE}/drawdown.png?t=${artifactsTs}`} alt="Drawdown" className="w-full rounded border border-slate-200" />
              </div>
            </div>
          </Panel>

          {metrics && Object.keys(metrics).length > 0 && (
            <Panel title="Metrics" subtitle="Full metrics from metrics.json">
              <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(metrics).map(([k, v]) => (
                  <div key={k}><span className="text-slate-500">{k} </span><span className="font-medium">{typeof v === "number" ? (Number.isInteger(v) ? v : (v as number).toFixed(4)) : String(v)}</span></div>
                ))}
              </div>
            </Panel>
          )}

          {tradesRows.length > 0 && (
            <Panel title="Trades" subtitle="From trades.csv">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {tradesRows[0].map((h, i) => (
                        <th key={i} className="px-2 py-1.5 text-left font-medium text-slate-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tradesRows.slice(1, 21).map((row, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        {row.map((cell, j) => (
                          <td key={j} className="px-2 py-1 text-slate-700">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tradesRows.length > 21 && <p className="mt-2 text-xs text-slate-500">Showing first 20 trades. Download CSV for full list.</p>}
              </div>
            </Panel>
          )}

          {(rejectionsRows.length > 0 || rejectionsRows.length === 0) && (
            <Panel title="Risk rejections" subtitle="From risk_rejections.csv">
              {rejectionsRows.length <= 1 ? (
                <p className="text-sm text-slate-600">{rejectionsRows.length === 0 ? "No rejections." : "No rejection rows (header only)."}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[400px] border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        {rejectionsRows[0].map((h, i) => (
                          <th key={i} className="px-2 py-1.5 text-left font-medium text-slate-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rejectionsRows.slice(1, 31).map((row, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          {row.map((cell, j) => (
                            <td key={j} className="px-2 py-1 text-slate-700">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rejectionsRows.length > 31 && <p className="mt-2 text-xs text-slate-500">Showing first 30. Download CSV for full list.</p>}
                </div>
              )}
            </Panel>
          )}

          <Panel title="Download artifacts" subtitle="All run outputs">
            <div className="flex flex-wrap gap-2">
              <a href={`${ARTIFACT_BASE}/summary.json`} download="summary.json" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">summary.json</a>
              <a href={`${ARTIFACT_BASE}/metrics.json`} download="metrics.json" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">metrics.json</a>
              <a href={`${ARTIFACT_BASE}/trades.csv`} download="trades.csv" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">trades.csv</a>
              <a href={`${ARTIFACT_BASE}/equity_curve.csv`} download="equity_curve.csv" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">equity_curve.csv</a>
              <a href={`${ARTIFACT_BASE}/drawdown.csv`} download="drawdown.csv" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">drawdown.csv</a>
              <a href={`${ARTIFACT_BASE}/ohlcv.csv`} download="ohlcv.csv" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">ohlcv.csv</a>
              <a href={`${ARTIFACT_BASE}/annotations.json`} download="annotations.json" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">annotations.json</a>
              <a href={`${ARTIFACT_BASE}/risk_log.json`} download="risk_log.json" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">risk_log.json</a>
              <a href={`${ARTIFACT_BASE}/risk_rejections.csv`} download="risk_rejections.csv" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">risk_rejections.csv</a>
              <a href={`${ARTIFACT_BASE}/report.md`} download="report.md" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">report.md</a>
              <a href={`${ARTIFACT_BASE}/report.html`} download="report.html" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">report.html</a>
            </div>
            <p className="mt-3">
              <Link href="/research" className="text-sm font-medium text-blue-600 hover:underline">
                View in Research (report, tabs) →
              </Link>
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}
