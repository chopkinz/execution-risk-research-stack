"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  const logsEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (logs.length) logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

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
          try {
            const payload = JSON.parse(dataLine) as { ok?: boolean; message?: string };
            const event = chunk.match(/^event:\s*(.+)$/m)?.[1];
            if (event === "start" && payload.message) setRunMessage(payload.message);
            if (event === "log" && payload.message) setLogs((prev) => [...prev, payload.message!.trimEnd()]);
            if (event === "end") {
              success = Boolean(payload.ok);
              setRunMessage(payload.message ?? "");
            }
          } catch {
            // ignore parse errors for partial chunks
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
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: { xs: 2, md: 3 },
        minHeight: 0,
        flex: 1,
        overflow: "auto",
      }}
    >
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="flex-start" gap={2} flexShrink={0}>
        <Box sx={{ flex: "1 1 auto", minWidth: 0 }}>
          <Typography variant="h4" fontWeight={600} gutterBottom>
            Research
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            View the latest run: equity, drawdown, trades, risk rejections, and report.
          </Typography>
          <Typography variant="caption" display="block" color="text.secondary">
            Run a backtest with live data (default: ^NDX, 15m, 60d). For custom symbol, interval, and risk, use{" "}
            <Link href="/simulation" style={{ fontWeight: 600 }}>Simulation</Link>.
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" gap={1} flexShrink={0} flexWrap="wrap">
          <Button component={Link} href="/simulation" variant="outlined" size="large" sx={{ minHeight: 44 }}>
            Customize run (Simulation)
          </Button>
          <Tooltip title="Runs a backtest with live market data. Results appear in Charts and Report below.">
            <Button
              variant="contained"
              onClick={runEngine}
              disabled={running}
              size="large"
              sx={{ minHeight: 44 }}
            >
              {running ? "Running…" : "Run backtest"}
            </Button>
          </Tooltip>
        </Stack>
      </Stack>

      {runMessage && (
        <Card variant="outlined" sx={{ flexShrink: 0 }}>
          <CardHeader
            title="Last run status"
            subheader={running ? "Live run in progress" : "What happened when you ran the backtest"}
            action={running ? <Chip label="Live" color="primary" size="small" /> : null}
          />
          <CardContent>
            <Typography variant="body2">{runMessage}</Typography>
          </CardContent>
        </Card>
      )}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", xl: "300px 1fr" },
          minHeight: 0,
          flex: 1,
        }}
      >
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
                    Run a backtest above or run a simulation with your chosen symbol and settings.
                  </>
                ) : null}
              </Typography>
            )}
          </CardContent>
        </Card>

        <Stack spacing={2} sx={{ minHeight: 0 }}>
          <Card variant="outlined" sx={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
            <CardHeader title="Charts" subheader="Equity · Drawdown · Risk rejections · Robustness" />
            <CardContent sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              {status === null ? (
                <ChartSkeleton height={280} />
              ) : (
                <Box sx={{ minHeight: 0, flex: 1 }}>
                  <ResearchArtifactTabs urls={urls} />
                </Box>
              )}
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ flexShrink: 0 }}>
            <CardHeader
              title="Logs"
              subheader={running ? "Streaming output…" : "Run log"}
              action={running ? <Chip label="Live" color="primary" size="small" /> : null}
            />
            <CardContent>
              <Box
                component="pre"
                sx={{
                  maxHeight: 200,
                  overflow: "auto",
                  p: 2,
                  borderRadius: 1,
                  bgcolor: "action.hover",
                  fontSize: "0.8125rem",
                  lineHeight: 1.5,
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {logs.length ? logs.join("\n") : "No log output yet. Click Run backtest to start."}
                <div ref={logsEndRef} />
              </Box>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ flexShrink: 0 }}>
            <CardHeader title="Report" subheader="Summary report" />
            <CardContent>
              <Box
                sx={{
                  maxHeight: 320,
                  overflow: "auto",
                  "& p": { mb: 1.5 },
                  "& ul": { pl: 2.5, mb: 1 },
                  "& h2": { mt: 2, mb: 1 },
                  "& h1": { mb: 1 },
                }}
              >
                <Typography component="div" variant="body2">
                  <ReactMarkdown>{report || "_No report yet. Run a backtest or simulation to generate results._"}</ReactMarkdown>
                </Typography>
              </Box>
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
