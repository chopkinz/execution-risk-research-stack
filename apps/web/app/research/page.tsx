"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { ResearchArtifactTabs } from "../../components/research-artifact-tabs";
import { ChartSkeleton } from "../../components/chart-skeleton";
import type { RunSummary, ResearchStatus } from "../../lib/domain";

const ARTIFACT_BASE = "/research/latest";

export default function ResearchPage() {
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [report, setReport] = useState<string>("");
  const [status, setStatus] = useState<ResearchStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<string>("");

  const fetchArtifacts = useCallback(async () => {
    const statusRes = await fetch("/api/research/status", { cache: "no-store" });
    const statusPayload = (await statusRes.json()) as ResearchStatus;
    setStatus(statusPayload);

    if (statusPayload.ready) {
      const [summaryRes, reportRes] = await Promise.all([
        fetch(`${ARTIFACT_BASE}/summary.json`, { cache: "no-store" }),
        fetch(`${ARTIFACT_BASE}/report.md`, { cache: "no-store" }),
      ]);
      if (summaryRes.ok) setSummary((await summaryRes.json()) as RunSummary);
      else setSummary(null);
      if (reportRes.ok) setReport(await reportRes.text());
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
      setRunMessage(payload.message ?? "Backtest service isn’t available. Try again in a moment.");
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
          const payload = JSON.parse(dataLine) as { ok?: boolean; message?: string };
          const event = chunk.match(/^event:\s*(.+)$/m)?.[1];
          if (event === "log" && payload.message) setLogs((prev) => [...prev, payload.message!.trimEnd()]);
          if (event === "end") {
            success = Boolean(payload.ok);
            setRunMessage(payload.message ?? "");
          }
        }
      }
    }
    setRunning(false);
    if (success) fetchArtifacts();
  }, [fetchArtifacts]);

  const urls = useMemo(() => {
    const t = summary?.timestamp_utc ?? status?.lastRunAtUtc ?? "";
    const q = t ? `?t=${encodeURIComponent(t)}` : "";
    return {
      equity: `${ARTIFACT_BASE}/equity_curve.png${q}`,
      drawdown: `${ARTIFACT_BASE}/drawdown.png${q}`,
      risk: `${ARTIFACT_BASE}/risk_rejections.png${q}`,
      monteCarlo: `${ARTIFACT_BASE}/monte_carlo_dd.png${q}`,
    };
  }, [summary?.timestamp_utc, status?.lastRunAtUtc]);

  const showMetadata = status?.ready && summary;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 3, md: 4 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="flex-start" gap={2}>
        <Box sx={{ flex: "1 1 auto", minWidth: 0 }}>
          <Typography variant="h4" fontWeight={600} gutterBottom>
            Research
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View the latest run: equity, drawdown, trades, risk rejections, and report. Run the demo backtest here, or
            use Simulation with your own symbol.
          </Typography>
        </Box>
        <Tooltip title="Runs a full backtest with sample data. Results appear here and in the charts below.">
          <Button
            variant="contained"
            onClick={runEngine}
            disabled={running}
            size="large"
            fullWidth
            sx={{ width: { sm: "auto" }, minHeight: 44 }}
          >
            {running ? "Running…" : "Run demo backtest"}
          </Button>
        </Tooltip>
      </Stack>

      {runMessage && (
        <Card variant="outlined">
          <CardHeader title="Last run status" subheader="What happened when you ran the backtest" />
          <CardContent>
            <Typography variant="body2">{runMessage}</Typography>
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", xl: "340px 1fr" } }}>
        <Card variant="outlined" sx={{ height: "fit-content" }}>
          <CardHeader title="Run summary" subheader="Key metrics from this run" />
          <CardContent>
            {showMetadata ? (
              <Stack spacing={1.5} divider={<Box sx={{ borderBottom: 1, borderColor: "divider" }} />}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                  <Typography variant="body2" color="text.secondary">Instrument</Typography>
                  <Typography variant="body2" fontWeight={500} className="tabular">{summary!.instrument ?? "—"}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                  <Typography variant="body2" color="text.secondary">Date range</Typography>
                  <Typography variant="body2" fontWeight={500} className="tabular">
                    {summary!.start ?? "—"} – {summary!.end ?? "—"}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                  <Typography variant="body2" color="text.secondary">Trades</Typography>
                  <Typography variant="body2" fontWeight={500} className="tabular">{summary!.trades ?? "—"}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                  <Typography variant="body2" color="text.secondary">Max drawdown</Typography>
                  <Typography variant="body2" fontWeight={500} className="tabular">
                    {summary!.max_drawdown_pct != null ? `${summary!.max_drawdown_pct.toFixed(2)}%` : "—"}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                  <Typography variant="body2" color="text.secondary">Last run</Typography>
                  <Typography variant="caption" fontWeight={500} className="tabular">
                    {status?.lastRunAtUtc ?? summary!.timestamp_utc ?? "—"}
                  </Typography>
                </Stack>
                {summary!.risk && (
                  <Box>
                    <Chip label="Risk limits" size="small" sx={{ mb: 1 }} />
                    <Typography variant="caption" display="block" color="text.secondary">
                      Daily loss {summary!.risk.max_daily_loss_pct ?? "—"}% · Exposure{" "}
                      {summary!.risk.max_exposure_pct ?? summary!.risk.max_gross_exposure ?? "—"} · Kill switch{" "}
                      {summary!.risk.kill_switch_drawdown_pct ?? summary!.risk.max_drawdown_pct ?? "—"}%
                    </Typography>
                  </Box>
                )}
                {summary!.execution && (
                  <Box>
                    <Chip label="Execution" size="small" sx={{ mb: 1 }} />
                    <Typography variant="caption" display="block" color="text.secondary">
                      {summary!.execution.spread_model ?? "—"} · {summary!.execution.slippage_model ?? "—"} ·{" "}
                      {summary!.execution.fees_model ?? "—"}
                    </Typography>
                  </Box>
                )}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {!status?.ready ? (
                  <>
                    No results yet. {status?.missing?.length ? `Missing: ${status.missing.join(", ")}. ` : ""}
                    Run the demo backtest above or run a simulation with your own symbol.
                  </>
                ) : null}
              </Typography>
            )}
          </CardContent>
        </Card>

        <Stack spacing={2}>
          <Card variant="outlined">
            <CardHeader title="Charts" subheader="Equity curve · Drawdown · Risk rejections · Robustness" />
            <CardContent>
              {status === null ? (
                <ChartSkeleton height={320} />
              ) : (
                <ResearchArtifactTabs urls={urls} />
              )}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader title="Logs" subheader="Run log" />
            <CardContent>
              <Box
                component="pre"
                sx={{
                  maxHeight: 280,
                  overflow: "auto",
                  p: 2,
                  borderRadius: 1,
                  bgcolor: "action.hover",
                  fontSize: "0.8125rem",
                  lineHeight: 1.5,
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {logs.length ? logs.join("\n") : "No log output yet."}
              </Box>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader title="Report" subheader="Summary report" />
            <CardContent>
              <Typography component="div" variant="body2" sx={{ "& p": { mb: 1.5 }, "& ul": { pl: 2.5, mb: 1 }, "& h2": { mt: 2, mb: 1 }, "& h1": { mb: 1 } }}>
                <ReactMarkdown>{report || "_No report yet. Run a simulation or the demo backtest._"}</ReactMarkdown>
              </Typography>
            </CardContent>
          </Card>

          {status?.ready && (
            <Card variant="outlined">
              <CardHeader title="Downloads" subheader="Export run data" />
              <CardContent>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {[
                    "summary.json",
                    "metrics.json",
                    "trades.csv",
                    "equity_curve.csv",
                    "drawdown.csv",
                    "ohlcv.csv",
                    "annotations.json",
                    "risk_log.json",
                    "risk_rejections.csv",
                    "report.md",
                    "report.html",
                  ].map((file) => (
                    <Button
                      key={file}
                      size="small"
                      variant="outlined"
                      href={`${ARTIFACT_BASE}/${file}`}
                      download={file}
                      sx={{
                        textTransform: "none",
                        minHeight: 44,
                        flex: { xs: "1 1 140px", sm: "0 0 auto" },
                      }}
                    >
                      {file}
                    </Button>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
