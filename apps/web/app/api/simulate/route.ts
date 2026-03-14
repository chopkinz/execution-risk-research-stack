import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

function sse(event: string, payload: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

const DEFAULT_CONFIG = {
  seed: 42,
  session: { start: "08:30", end: "10:30" },
  portfolio: { initial_cash: 100000 },
  risk: {
    max_position_size: 1,
    max_trades_per_day: 2,
    max_daily_loss_pct: 0.02,
    max_drawdown_pct: 0.2,
    max_gross_exposure: 500000,
  },
  execution: {
    spread_bps: 1,
    min_spread: 0.01,
    slippage_k: 0.1,
    delay_bars: 0,
    fee_bps: 0.5,
  },
  strategy: { name: "momentum", threshold: 0.0005, qty: 1 },
  montecarlo_paths: 500,
};

export async function POST(request: Request) {
  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const outDir = path.join(process.cwd(), "public", "research", "latest");
  const pythonPath = path.join(repoRoot, "packages", "engine", "src");
  const venvPython = path.join(repoRoot, "packages", "engine", ".venv", "bin", "python");
  const configPath = path.join(outDir, "run_config.json");

  let body: Record<string, unknown> = {};
  try {
    if (request.body) body = (await request.json()) as Record<string, unknown>;
  } catch {
    // use defaults
  }

  const config = {
    ...DEFAULT_CONFIG,
    symbol: (body.symbol as string) ?? "^NDX",
    interval: (body.interval as string) ?? "15m",
    period: (body.period as string) ?? "60d",
    strategy: {
      ...(DEFAULT_CONFIG.strategy as object),
      ...(typeof body.strategy === "object" && body.strategy !== null ? body.strategy : {}),
      name: (body.strategy as { name?: string })?.name ?? "momentum",
      qty: Number((body.strategy as { qty?: number })?.qty) || 1,
    },
  };

  if (!fs.existsSync(path.join(repoRoot, "packages", "engine", "src"))) {
    return Response.json(
      { ok: false, message: "Engine package not found. Run from repo root." },
      { status: 500 }
    );
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

  const pythonCmd = fs.existsSync(venvPython) ? venvPython : "python3";

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const child = spawn(
        pythonCmd,
        ["-m", "engine.scripts.run_config", "--config", configPath, "--out", outDir, "--root", repoRoot],
        {
          cwd: repoRoot,
          env: {
            ...process.env,
            PYTHONPATH: process.env.PYTHONPATH ? `${pythonPath}:${process.env.PYTHONPATH}` : pythonPath,
          },
        }
      );
      controller.enqueue(encoder.encode(sse("start", { ok: true, outDir })));
      child.stdout.on("data", (chunk: Buffer) => {
        controller.enqueue(encoder.encode(sse("log", { stream: "stdout", message: chunk.toString() })));
      });
      child.stderr.on("data", (chunk: Buffer) => {
        controller.enqueue(encoder.encode(sse("log", { stream: "stderr", message: chunk.toString() })));
      });
      child.on("error", (error: Error) => {
        controller.enqueue(encoder.encode(sse("end", { ok: false, message: error.message })));
        controller.close();
      });
      child.on("close", (code: number | null) => {
        controller.enqueue(
          encoder.encode(
            sse("end", {
              ok: code === 0,
              code,
              message: code === 0 ? "Simulation completed." : "Simulation failed.",
            })
          )
        );
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
