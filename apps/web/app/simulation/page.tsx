"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

type SymbolOption = { value: string; label: string };
const INSTRUMENT_GROUPS: { label: string; symbols: SymbolOption[] }[] = [
  {
    label: "Equity / Index",
    symbols: [
      { value: "^NDX", label: "NAS100 (^NDX)" },
      { value: "^GSPC", label: "S&P 500 (^GSPC)" },
      { value: "^DJI", label: "Dow (^DJI)" },
      { value: "SPY", label: "SPY" },
      { value: "QQQ", label: "QQQ" },
      { value: "IWM", label: "IWM (Russell 2000)" },
    ],
  },
  {
    label: "Futures",
    symbols: [
      { value: "NQ=F", label: "NQ (Nasdaq E-mini)" },
      { value: "ES=F", label: "ES (S&P E-mini)" },
      { value: "GC=F", label: "Gold" },
      { value: "CL=F", label: "Crude Oil" },
      { value: "ZB=F", label: "T-Bonds" },
    ],
  },
  {
    label: "Forex",
    symbols: [
      { value: "EURUSD=X", label: "EUR/USD" },
      { value: "GBPUSD=X", label: "GBP/USD" },
      { value: "USDJPY=X", label: "USD/JPY" },
      { value: "AUDUSD=X", label: "AUD/USD" },
    ],
  },
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

export default function SimulationPage() {
  const [instrumentGroup, setInstrumentGroup] = useState(0);
  const [symbol, setSymbol] = useState("^NDX");
  const [customSymbol, setCustomSymbol] = useState("");
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

  const effectiveSymbol = customSymbol.trim() || symbol;
  const symbols = INSTRUMENT_GROUPS[instrumentGroup]?.symbols ?? [];

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
      if (tradesRes.ok) setTradesRows(parseCsv(await tradesRes.text()));
      else setTradesRows([]);
      if (rejRes.ok) setRejectionsRows(parseCsv(await rejRes.text()));
      else setRejectionsRows([]);
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
      body: JSON.stringify({
        symbol: effectiveSymbol,
        interval,
        period,
        strategy: { name: strategy, qty: 1 },
      }),
    });

    if (res.headers.get("content-type")?.includes("application/json")) {
      const payload = (await res.json()) as { message?: string };
      setMessage(payload.message ?? "Simulation service isn’t available. Try again in a moment.");
      setRunning(false);
      return;
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let success = false;
    const logLines: string[] = [];

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
            const payload = JSON.parse(dataLine) as {
              stream?: string;
              message?: string;
              ok?: boolean;
              error?: string;
            };
            const msg = payload.message ?? "";
            if (msg) {
              logLines.push(msg.trimEnd());
              setLogs((prev) => [...prev, msg.trimEnd()]);
            }
            if (payload.ok === true || payload.ok === false) {
              success = payload.ok;
              setMessage(payload.message ?? "");
              if (!success && payload.error) setMessage(`Run failed: ${payload.error}`);
            }
          } catch {
            /* skip */
          }
        }
      }
    }
    if (!success && logLines.length > 0) {
      for (let i = logLines.length - 1; i >= 0; i--) {
        try {
          const parsed = JSON.parse(logLines[i]) as { ok?: boolean; error?: string };
          if (parsed.ok === false && typeof parsed.error === "string") {
            setMessage(`Run failed: ${parsed.error}`);
            break;
          }
        } catch {
          /* not JSON */
        }
      }
    }
    setRunning(false);
    if (success) {
      await fetchSummary();
      await fetchOutputs();
    }
  }, [effectiveSymbol, interval, period, strategy, fetchSummary, fetchOutputs]);

  useEffect(() => {
    if (summary) fetchOutputs();
  }, [summary?.run_id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Stack spacing={{ xs: 3, md: 4 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="flex-start" gap={2}>
        <Box sx={{ flex: "1 1 auto", minWidth: 0 }}>
          <Typography variant="h4" fontWeight={600} gutterBottom>
            Simulation
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Run a backtest with your choice of instrument, timeframe, and strategy. Results appear in Research.
          </Typography>
        </Box>
        <Button component={Link} href="/research" variant="outlined" size="large">
          View Research
        </Button>
      </Stack>

      <Card variant="outlined">
        <CardHeader title="Parameters" subheader="Choose symbol, timeframe, and strategy" />
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            flexWrap="wrap"
            gap={2}
            sx={{ mb: 2, "& .MuiFormControl-root, & .MuiTextField-root": { width: { xs: "100%", md: "auto" }, minWidth: { xs: 0, md: 160 } } }}
          >
            <FormControl size="small" sx={{ minWidth: { xs: 0, md: 160 } }}>
              <InputLabel>Instrument</InputLabel>
              <Select
                value={instrumentGroup}
                label="Instrument"
                onChange={(e) => {
                  const i = Number(e.target.value);
                  setInstrumentGroup(i);
                  setSymbol(INSTRUMENT_GROUPS[i]?.symbols[0]?.value ?? "^NDX");
                  setCustomSymbol("");
                }}
              >
                {INSTRUMENT_GROUPS.map((g, i) => (
                  <MenuItem key={i} value={i}>
                    {g.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: { xs: 0, md: 180 } }} disabled={!!customSymbol.trim()}>
              <InputLabel>Symbol</InputLabel>
              <Select
                value={symbol}
                label="Symbol"
                onChange={(e) => {
                  setSymbol(e.target.value);
                  setCustomSymbol("");
                }}
              >
                {symbols.map((s) => (
                  <MenuItem key={s.value} value={s.value}>
                    {s.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Custom symbol"
              placeholder="e.g. AAPL, NQ=F"
              value={customSymbol}
              onChange={(e) => setCustomSymbol(e.target.value)}
              sx={{ minWidth: { xs: 0, md: 160 } }}
            />
            <FormControl size="small" sx={{ minWidth: { xs: 0, md: 100 } }}>
              <InputLabel>Interval</InputLabel>
              <Select value={interval} label="Interval" onChange={(e) => setInterval(e.target.value)}>
                {INTERVALS.map((i) => (
                  <MenuItem key={i} value={i}>
                    {i}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: { xs: 0, md: 90 } }}>
              <InputLabel>Period</InputLabel>
              <Select value={period} label="Period" onChange={(e) => setPeriod(e.target.value)}>
                {PERIODS.map((p) => (
                  <MenuItem key={p} value={p}>
                    {p}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: { xs: 0, md: 160 } }}>
              <InputLabel>Strategy</InputLabel>
              <Select value={strategy} label="Strategy" onChange={(e) => setStrategy(e.target.value)}>
                {STRATEGIES.map((s) => (
                  <MenuItem key={s.value} value={s.value}>
                    {s.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
          <Tooltip title="Runs the backtest with your choices. Results show below and in Research.">
            <Button
              variant="contained"
              onClick={runSimulation}
              disabled={running}
              size="large"
              fullWidth
              sx={{ width: { md: "auto" }, minHeight: 44 }}
            >
              {running ? "Running…" : "Run simulation"}
            </Button>
          </Tooltip>
        </CardContent>
      </Card>

      {message && (
        <Alert severity={message.startsWith("Run failed") ? "error" : "info"}>
          {message}
        </Alert>
      )}

      <Card variant="outlined">
        <CardHeader title="Logs" subheader="Run log" />
        <CardContent>
          <Box
            component="pre"
            sx={{
              maxHeight: 320,
              overflow: "auto",
              p: 2,
              borderRadius: 1,
              bgcolor: "action.hover",
              fontSize: "0.8125rem",
              lineHeight: 1.5,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {logs.length ? logs.join("\n") : "No log output yet. Run a simulation."}
          </Box>
        </CardContent>
      </Card>

      {summary && (
        <>
          <Card variant="outlined">
            <CardHeader title="Latest run" subheader="Summary from last successful run" />
            <CardContent>
              <Stack direction="row" flexWrap="wrap" gap={3} useFlexGap sx={{ "& > .MuiBox-root": { minWidth: 0 } }}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}><Typography variant="caption" color="text.secondary">Instrument</Typography><Typography variant="body2" fontWeight={500} className="tabular">{summary.instrument}</Typography></Box>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}><Typography variant="caption" color="text.secondary">Timeframe</Typography><Typography variant="body2" fontWeight={500}>{summary.timeframe}</Typography></Box>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}><Typography variant="caption" color="text.secondary">Trades</Typography><Typography variant="body2" fontWeight={500} className="tabular">{summary.trades}</Typography></Box>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}><Typography variant="caption" color="text.secondary">Win rate</Typography><Typography variant="body2" fontWeight={500} className="tabular">{summary.win_rate != null ? `${(summary.win_rate * 100).toFixed(1)}%` : "—"}</Typography></Box>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}><Typography variant="caption" color="text.secondary">Profit factor</Typography><Typography variant="body2" fontWeight={500} className="tabular">{summary.profit_factor?.toFixed(2) ?? "—"}</Typography></Box>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}><Typography variant="caption" color="text.secondary">Max drawdown</Typography><Typography variant="body2" fontWeight={500} color="error.main" className="tabular">{summary.max_drawdown_pct?.toFixed(2) ?? "—"}%</Typography></Box>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}><Typography variant="caption" color="text.secondary">Total return</Typography><Typography variant="body2" fontWeight={500} color="success.main" className="tabular">{summary.total_return_pct?.toFixed(2) ?? "—"}%</Typography></Box>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader title="Charts" subheader="Equity and drawdown" />
            <CardContent>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>Equity curve</Typography>
                  <Box component="img" src={`${ARTIFACT_BASE}/equity_curve.png?t=${artifactsTs}`} alt="Equity" sx={{ width: "100%", borderRadius: 1, border: 1, borderColor: "divider" }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>Drawdown</Typography>
                  <Box component="img" src={`${ARTIFACT_BASE}/drawdown.png?t=${artifactsTs}`} alt="Drawdown" sx={{ width: "100%", borderRadius: 1, border: 1, borderColor: "divider" }} />
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {metrics && Object.keys(metrics).length > 0 && (
            <Card variant="outlined">
              <CardHeader title="Metrics" subheader="Key metrics from this run" />
              <CardContent>
                <Stack direction="row" flexWrap="wrap" gap={2}>
                  {Object.entries(metrics).map(([k, v]) => (
                    <Box key={k}>
                      <Typography variant="caption" color="text.secondary">{k}</Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {typeof v === "number" ? (Number.isInteger(v) ? v : (v as number).toFixed(4)) : String(v)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}

          {tradesRows.length > 0 && (
            <Card variant="outlined">
              <CardHeader title="Trades" subheader="First 20 trades" />
              <CardContent>
                <TableContainer sx={{ maxHeight: 340, overflow: "auto", overflowX: "auto", borderRadius: 1, border: 1, borderColor: "divider" }}>
                  <Table size="small" stickyHeader sx={{ minWidth: 420 }}>
                    <TableHead>
                      <TableRow>
                        {tradesRows[0].map((h, i) => (
                          <TableCell key={i}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tradesRows.slice(1, 21).map((row, i) => (
                        <TableRow key={i}>
                          {row.map((cell, j) => (
                            <TableCell key={j}>{cell}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {tradesRows.length > 21 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
                    Showing first 20 trades. Download CSV for the full list.
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}

          <Card variant="outlined">
            <CardHeader title="Risk rejections" subheader="Trades blocked by risk limits" />
            <CardContent>
              {rejectionsRows.length <= 1 ? (
                <Typography variant="body2" color="text.secondary">
                  {rejectionsRows.length === 0 ? "No trades were blocked by risk." : "No rejection rows (header only)."}
                </Typography>
              ) : (
                <>
                  <TableContainer sx={{ maxHeight: 320, overflow: "auto", overflowX: "auto", borderRadius: 1, border: 1, borderColor: "divider" }}>
                    <Table size="small" stickyHeader sx={{ minWidth: 360 }}>
                      <TableHead>
                        <TableRow>
                          {rejectionsRows[0].map((h, i) => (
                            <TableCell key={i}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rejectionsRows.slice(1, 31).map((row, i) => (
                          <TableRow key={i}>
                            {row.map((cell, j) => (
                              <TableCell key={j}>{cell}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {rejectionsRows.length > 31 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
                      Showing first 30. Download CSV for the full list.
                    </Typography>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader title="Downloads" subheader="Export run data" />
            <CardContent>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                {["summary.json", "metrics.json", "trades.csv", "equity_curve.csv", "drawdown.csv", "ohlcv.csv", "annotations.json", "risk_log.json", "risk_rejections.csv", "report.md", "report.html"].map((file) => (
                  <Button
                    key={file}
                    size="small"
                    variant="outlined"
                    href={`${ARTIFACT_BASE}/${file}`}
                    download={file}
                    sx={{ textTransform: "none", minHeight: 44, flex: { xs: "1 1 140px", sm: "0 0 auto" } }}
                  >
                    {file}
                  </Button>
                ))}
              </Stack>
              <Typography variant="body2">
                <Link href="/research" style={{ color: "inherit", fontWeight: 600 }}>
                  View full report and charts in Research →
                </Link>
              </Typography>
            </CardContent>
          </Card>
        </>
      )}
    </Stack>
  );
}
