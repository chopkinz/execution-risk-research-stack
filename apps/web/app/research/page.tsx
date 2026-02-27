"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ResearchArtifactTabs } from "../../components/research-artifact-tabs";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Panel } from "../../components/ui/panel";

type Summary = {
  timestamp_utc: string;
  instrument: string;
  start: string;
  end: string;
  trades: number;
  max_drawdown_pct: number;
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

type StatusPayload = {
  ready: boolean;
  lastRunAtUtc: string | null;
  missing: string[];
  readyRiskLab?: boolean;
  readyExecutionLab?: boolean;
};

const ARTIFACT_BASE = "/research/latest";
type RunSource = "unified" | "risk_lab" | "execution_lab";

const RUN_SOURCES: { id: RunSource; label: string; description: string }[] = [
  { id: "unified", label: "Unified", description: "Full stack (execution-risk-research-stack)" },
  { id: "risk_lab", label: "Risk Lab", description: "risk-engine-lab policy demo" },
  { id: "execution_lab", label: "Execution Sim Lab", description: "execution-sim-lab fill demo" },
];

export default function ResearchPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [report, setReport] = useState<string>("");
  const [reportRiskLab, setReportRiskLab] = useState<string>("");
  const [reportExecutionLab, setReportExecutionLab] = useState<string>("");
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [runSource, setRunSource] = useState<RunSource>("unified");
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

    if (statusPayload.readyRiskLab) {
      const res = await fetch(`${ARTIFACT_BASE}/risk_lab/report.md`, { cache: "no-store" });
      if (res.ok) setReportRiskLab(await res.text());
    } else {
      setReportRiskLab("");
    }
    if (statusPayload.readyExecutionLab) {
      const res = await fetch(`${ARTIFACT_BASE}/execution_lab/report.md`, { cache: "no-store" });
      if (res.ok) setReportExecutionLab(await res.text());
    } else {
      setReportExecutionLab("");
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

  const artifactBase = useMemo(() => {
    if (runSource === "risk_lab") return `${ARTIFACT_BASE}/risk_lab`;
    if (runSource === "execution_lab") return `${ARTIFACT_BASE}/execution_lab`;
    return ARTIFACT_BASE;
  }, [runSource]);

  const urls = useMemo(
    () => ({
      equity: `${artifactBase}/equity_curve.png`,
      drawdown: `${artifactBase}/drawdown.png`,
      risk: `${artifactBase}/risk_rejections.png`,
      monteCarlo: runSource === "unified" ? `${ARTIFACT_BASE}/monte_carlo_dd.png` : undefined,
    }),
    [artifactBase, runSource]
  );

  const activeReport =
    runSource === "unified"
      ? report
      : runSource === "risk_lab"
        ? reportRiskLab
        : reportExecutionLab;

  const showMetadata = runSource === "unified" && summary;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">Research</h1>
          <p className="mt-1 text-sm text-slate-600">
            Run and inspect execution-risk-research-stack, risk-engine-lab, and execution-sim-lab artifacts.
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

      <Panel title="Run source" subtitle="Unified stack, Risk Lab, or Execution Sim Lab">
        <div className="flex flex-wrap gap-2">
          {RUN_SOURCES.map((src) => (
            <button
              key={src.id}
              type="button"
              onClick={() => setRunSource(src.id)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                runSource === src.id
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {src.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {RUN_SOURCES.find((s) => s.id === runSource)?.description}
        </p>
        {runSource === "risk_lab" && !status?.readyRiskLab && (
          <p className="mt-2 text-xs text-amber-600">Run the engine to generate Risk Lab artifacts.</p>
        )}
        {runSource === "execution_lab" && !status?.readyExecutionLab && (
          <p className="mt-2 text-xs text-amber-600">Run the engine to generate Execution Sim Lab artifacts.</p>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Panel title="Run Metadata" subtitle={runSource === "unified" ? "Loaded from summary.json" : "Lab demo"}>
          {showMetadata ? (
            <div className="space-y-3 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>Instrument</span>
                <span className="tabular font-medium">{summary.instrument}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Date Range</span>
                <span className="tabular font-medium">
                  {summary.start} to {summary.end}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Trades</span>
                <span className="tabular font-medium">{summary.trades}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Max Drawdown</span>
                <span className="tabular font-medium">{summary.max_drawdown_pct.toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Last Run</span>
                <span className="tabular text-xs font-medium">
                  {status?.lastRunAtUtc ?? summary.timestamp_utc ?? "n/a"}
                </span>
              </div>
              <div className="pt-2">
                <Badge tone="gray">Risk Constraints</Badge>
                <p className="mt-2 text-xs">
                  Daily Loss {summary.risk.max_daily_loss_pct}% • Exposure {summary.risk.max_exposure_pct}% • Kill
                  Switch {summary.risk.kill_switch_drawdown_pct}%
                </p>
              </div>
              <div className="pt-2">
                <Badge tone="gray">Execution Assumptions</Badge>
                <p className="mt-2 text-xs">
                  {summary.execution.spread_model} • {summary.execution.slippage_model} •{" "}
                  {summary.execution.fees_model}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm text-slate-600">
              {runSource === "unified" && !status?.ready && (
                <>
                  <p>Artifacts not ready.</p>
                  {status?.missing?.length ? <p>Missing: {status.missing.join(", ")}</p> : null}
                </>
              )}
              {runSource === "risk_lab" && (
                <p>Policy-driven risk limits and rejection audit from risk-engine-lab.</p>
              )}
              {runSource === "execution_lab" && (
                <p>Fill simulation with spread, slippage, and latency from execution-sim-lab.</p>
              )}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Artifact Viewer" subtitle="Overview / Risk / Execution / Robustness">
            <ResearchArtifactTabs urls={urls} />
          </Panel>

          <Panel title="Streaming Logs" subtitle="Live output from engine run">
            <pre className="max-h-64 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
              {logs.length ? logs.join("\n") : "No logs yet."}
            </pre>
          </Panel>

          <Panel
            title="Report"
            subtitle={
              runSource === "unified"
                ? "Markdown from unified run"
                : runSource === "risk_lab"
                  ? "risk-engine-lab report"
                  : "execution-sim-lab report"
            }
          >
            <article className="prose prose-slate max-w-none text-sm">
              <ReactMarkdown>
                {activeReport || "_Run the engine to generate reports for all run sources._"}
              </ReactMarkdown>
            </article>
          </Panel>
        </div>
      </div>
    </div>
  );
}
