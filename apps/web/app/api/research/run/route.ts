import { spawn } from "node:child_process";
import path from "node:path";

export const dynamic = "force-dynamic";

function sse(event: string, payload: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function POST() {
  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const outDir = path.join(repoRoot, "apps", "web", "public", "research", "latest");
  const pythonPath = path.join(repoRoot, "packages", "engine", "src");
  const venvPython = path.join(repoRoot, "packages", "engine", ".venv", "bin", "python");
  const fs = await import("node:fs");

  if (!fs.existsSync(path.join(repoRoot, "packages", "engine", "src"))) {
    return Response.json(
      { ok: false, message: "Engine package not found. Run from repo root or set correct cwd." },
      { status: 500 }
    );
  }

  const pythonCmd = fs.existsSync(venvPython) ? venvPython : "python3";

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const child = spawn(
        pythonCmd,
        ["-m", "engine.scripts.demo", "--out", outDir],
        {
          cwd: repoRoot,
          env: {
            ...process.env,
            PYTHONPATH: process.env.PYTHONPATH ? `${pythonPath}:${process.env.PYTHONPATH}` : pythonPath
          }
        }
      );

      controller.enqueue(encoder.encode(sse("start", { ok: true, outDir })));
      child.stdout.on("data", (chunk) => {
        controller.enqueue(encoder.encode(sse("log", { stream: "stdout", message: chunk.toString() })));
      });
      child.stderr.on("data", (chunk) => {
        controller.enqueue(encoder.encode(sse("log", { stream: "stderr", message: chunk.toString() })));
      });
      child.on("error", (error) => {
        controller.enqueue(encoder.encode(sse("end", { ok: false, message: error.message })));
        controller.close();
      });
      child.on("close", (code) => {
        controller.enqueue(
          encoder.encode(
            sse("end", {
              ok: code === 0,
              code,
              message: code === 0 ? "Engine run completed." : "Engine run failed."
            })
          )
        );
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
