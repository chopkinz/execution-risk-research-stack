import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getRepoRoot } from "../../../../lib/repo";
import { buildRunConfig } from "../../../../lib/run-config";

export const dynamic = "force-dynamic";

function sse(event: string, payload: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

/**
 * POST /api/research/run — Run a backtest with live data (same engine as Simulation).
 * Body is optional; defaults: ^NDX, 15m, 60d, momentum, backtest-friendly risk.
 * No demo or synthetic data; uses engine.scripts.run_config and Yahoo data.
 */
export async function POST(request: Request) {
  const repoRoot = getRepoRoot();
  if (!repoRoot) {
    return Response.json(
      { ok: false, message: "Repo root not found (expected packages/engine/src). Run from repo root or apps/web." },
      { status: 500 }
    );
  }

  const engineSrc = path.join(repoRoot, "packages", "engine", "src");
  const outDir = path.join(repoRoot, "apps", "web", "public", "research", "latest");
  const engineVenvPython = path.join(repoRoot, "packages", "engine", ".venv", "bin", "python");
  const rootVenvPython = path.join(repoRoot, ".venv", "bin", "python");
  const configPath = path.join(outDir, "run_config.json");

  let body: Record<string, unknown> = {};
  try {
    if (request.body) body = (await request.json()) as Record<string, unknown>;
  } catch {
    // use defaults
  }
  if (!body || typeof body !== "object") {
    body = {};
  }

  const config = buildRunConfig(body);

  if (!fs.existsSync(engineSrc)) {
    return Response.json(
      { ok: false, message: "Engine package not found at packages/engine/src." },
      { status: 500 }
    );
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

  const pythonCmd = fs.existsSync(engineVenvPython)
    ? engineVenvPython
    : fs.existsSync(rootVenvPython)
      ? rootVenvPython
      : "python3";
  const pythonPath = engineSrc;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let stderrBuffer = "";
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

      controller.enqueue(
        encoder.encode(
          sse("start", {
            ok: true,
            outDir,
            message: `Running backtest: ${config.symbol} ${config.interval} ${config.period}`,
          })
        )
      );
      child.stdout.on("data", (chunk) => {
        controller.enqueue(encoder.encode(sse("log", { stream: "stdout", message: chunk.toString() })));
      });
      child.stderr.on("data", (chunk) => {
        stderrBuffer += chunk.toString();
        controller.enqueue(encoder.encode(sse("log", { stream: "stderr", message: chunk.toString() })));
      });
      child.on("error", (error) => {
        controller.enqueue(encoder.encode(sse("end", { ok: false, message: error.message })));
        controller.close();
      });
      child.on("close", (code) => {
        let message = code === 0 ? "Backtest completed." : "Backtest failed.";
        if (code !== 0 && stderrBuffer) {
          const lines = stderrBuffer.trim().split(/\r?\n/);
          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              const parsed = JSON.parse(lines[i]) as { ok?: boolean; error?: string };
              if (parsed.ok === false && typeof parsed.error === "string") {
                message = `Backtest failed: ${parsed.error}`;
                break;
              }
            } catch {
              /* not JSON */
            }
          }
        }
        controller.enqueue(encoder.encode(sse("end", { ok: code === 0, code, message })));
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
