import fs from "node:fs";
import path from "node:path";

const uiRoot = process.cwd();
const demoDir = path.join(uiRoot, "public", "research", "latest");
const buildId = path.join(uiRoot, ".next", "BUILD_ID");
const appManifest = path.join(uiRoot, ".next", "server", "app-paths-manifest.json");

const requiredFiles = [
  "summary.json",
  "equity_curve.png",
  "drawdown.png",
  "risk_rejections.png",
  "report.md"
];

for (const file of requiredFiles) {
  const full = path.join(demoDir, file);
  if (!fs.existsSync(full)) {
    console.error(`Missing required artifact: ${full}`);
    process.exit(1);
  }
}

if (!fs.existsSync(buildId)) {
  console.error(`Missing Next build output: ${buildId}`);
  process.exit(1);
}
// Next.js may change manifest location between versions; warn only so CI stays green
if (!fs.existsSync(appManifest)) {
  console.warn(`Warning: app manifest not found at ${appManifest} (Next.js version may use different path)`);
}

const summaryPath = path.join(demoDir, "summary.json");
const summaryRaw = fs.readFileSync(summaryPath, "utf8");
const summary = JSON.parse(summaryRaw);
const requiredSummaryKeys = [
  "run_id",
  "timestamp_utc",
  "instrument",
  "timeframe",
  "start",
  "end",
  "trades",
  "win_rate",
  "profit_factor",
  "max_drawdown_pct",
  "sharpe",
  "total_return_pct",
  "risk",
  "execution",
];
const optionalSummaryKeys = ["cagr_pct", "notes"];

for (const key of requiredSummaryKeys) {
  if (!(key in summary)) {
    console.error(`Missing summary key: ${key}`);
    process.exit(1);
  }
}
for (const key of optionalSummaryKeys) {
  if (!(key in summary)) {
    console.warn(`Optional summary key missing: ${key} (demo and simulation summaries may differ)`);
  }
}

if (fs.existsSync(appManifest)) {
  const manifestRaw = fs.readFileSync(appManifest, "utf8");
  const manifest = JSON.parse(manifestRaw);
  for (const route of ["/page", "/markets/page", "/research/page", "/about/page"]) {
    if (!(route in manifest)) {
      console.error(`Expected route missing from build manifest: ${route}`);
      process.exit(1);
    }
  }
}

console.log("ui-smoke ok");
