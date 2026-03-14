"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ResearchArtifactTabs } from "../../components/research-artifact-tabs";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Panel } from "../../components/ui/panel";

type Summary = {
  timestamp_utc?: string;
  instrument?: string;
  start?: string;
  end?: string;
  trades?: number;
  max_drawdown_pct?: number;
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

type StatusPayload = {
  ready: boolean;
  lastRunAtUtc: string | null;
  missing: string[];
  readyRiskLab?: boolean;
  readyExecutionLab?: boolean;
};

const ARTIFACT_BASE = "/research/latest";

export default function ResearchPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [report, setReport] = useState<string>("");
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<string>("");

  const fetchArtifacts = useCallback(async () => {
    const statusRes = await fetch("/api/research/status", { cache: "no-store" });
    const statusPayload = (await statusRes.json()) as StatusPayload;
    setStatus(statusPayload);

    if (statusPayload.ready) {
      const [summaryRes, reportRes] = await Promise.all([
        fetch(`${ARTIFACT_BASE}/summary.json`, { cache: "no-store" }),
        fetch(`${ARTIFACT_BASE}/report.md`, { cache: "no-store" }),
      ]);
      if (summaryRes.ok) {
        setSummary((await summaryRes.json()) as Summary);
      }
      if (reportRes.ok) {
        setReport(await reportRes.text());
      }
    } else {
      setSummary(null);
      setReport("");
    }
  }, []);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  const runEngine = useCallback(async () => {
    setLogs([]);
    setRunMessage("");
    setRunning(true);
    const res = await fetch("/api/research/run", { method: "POST" });

    if (res.headers.get("content-type")?.includes("application/json")) {
      const payload = (await res.json()) as { message?: string };
      setRunMessage(payload.message ?? "Engine run unavailable.");
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
          const event = chunk.match(/^event:\s*(.+)$/m)?.[1];
          const dataLine = chunk.match(/^data:\s*(.+)$/m)?.[1];
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine) as {
            ok?: boolean;
            message?: string;
            stream?: string;
          };
          const message = payload.message ?? "";
          if (event === "log" && message) {
            setLogs((prev) => [...prev, message.trimEnd()]);
          }
          if (event === "end") {
            success = Boolean(payload.ok);
            setRunMessage(message);
          }
        }
      }
    }

    setRunning(false);
    if (success) {
      await fetchArtifacts();
    }
  }, [fetchArtifacts]);

  const urls = useMemo(
    () => ({
      equity: `${ARTIFACT_BASE}/equity_curve.png`,
      drawdown: `${ARTIFACT_BASE}/drawdown.png`,
      risk: `${ARTIFACT_BASE}/risk_rejections.png`,
      monteCarlo: `${ARTIFACT_BASE}/monte_carlo_dd.png`,
    }),
    []
  );

  const showMetadata = status?.ready && summary;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">Research</h1>
          <p className="mt-1 text-sm text-slate-600">
            Inspect the latest run: equity, drawdown, trades, risk rejections, and report. Run from Simulation Lab (configurable) or &quot;Run Latest Backtest&quot; (demo pipeline).
          </p>
        </div>
        <Button onClick={runEngine} disabled={running}>
          {running ? "Running..." : "Run Latest Backtest"}
        </Button>
      </header>

      {runMessage ? (
        <Panel title="Run Status" subtitle="Engine execution gate and latest response">
          <p className="text-sm text-slate-700">{runMessage}</p>
        </Panel>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Panel title="Run Metadata" subtitle="Loaded from summary.json">
          {showMetadata ? (
            <div className="space-y-3 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>Instrument</span>
                <span className="tabular font-medium">{summary.instrument ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Date Range</span>
                <span className="tabular font-medium">
                  {summary.start ?? "—"} to {summary.end ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Trades</span>
                <span className="tabular font-medium">{summary.trades ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Max Drawdown</span>
                <span className="tabular font-medium">{summary.max_drawdown_pct != null ? `${summary.max_drawdown_pct.toFixed(2)}%` : "n/a"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Last Run</span>
                <span className="tabular text-xs font-medium">
                  {status?.lastRunAtUtc ?? summary.timestamp_utc ?? "n/a"}
                </span>
              </div>
              {summary.risk && (
                <div className="pt-2">
                  <Badge tone="gray">Risk Constraints</Badge>
                  <p className="mt-2 text-xs">
                    Daily Loss {summary.risk.max_daily_loss_pct ?? "—"}% • Exposure {summary.risk.max_exposure_pct ?? summary.risk.max_gross_exposure ?? "—"} • Kill
                    Switch {summary.risk.kill_switch_drawdown_pct ?? summary.risk.max_drawdown_pct ?? "—"}%
                  </p>
                </div>
              )}
              {summary.execution && (
                <div className="pt-2">
                  <Badge tone="gray">Execution Assumptions</Badge>
                  <p className="mt-2 text-xs">
                    {summary.execution.spread_model ?? "—"} • {summary.execution.slippage_model ?? "—"} •{" "}
                    {summary.execution.fees_model ?? "—"}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 text-sm text-slate-600">
              {!status?.ready && (
                <>
                  <p>Artifacts not ready.</p>
                  {status?.missing?.length ? <p>Missing: {status.missing.join(", ")}</p> : null}
                  <p>Run a simulation from Simulation Lab or run the demo via &quot;Run Latest Backtest&quot;.</p>
                </>
              )}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Artifact Viewer" subtitle="Equity, drawdown, risk rejections, Monte Carlo">
            <ResearchArtifactTabs urls={urls} />
          </Panel>

          <Panel title="Streaming Logs" subtitle="Live output from engine run">
            <pre className="max-h-64 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
              {logs.length ? logs.join("\n") : "No logs yet."}
            </pre>
          </Panel>

          <Panel title="Report" subtitle="Markdown tear sheet from run">
            <article className="prose prose-slate max-w-none text-sm">
              <ReactMarkdown>
                {report || "_No report yet. Run a simulation or Run Latest Backtest._"}
              </ReactMarkdown>
            </article>
          </Panel>

          {status?.ready && (
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
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
