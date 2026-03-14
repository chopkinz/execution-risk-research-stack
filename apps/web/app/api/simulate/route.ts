import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { getRepoRoot } from '../../../lib/repo';
import { buildRunConfig } from '../../../lib/run-config';

export const dynamic = 'force-dynamic';

function sse(event: string, payload: unknown): string {
	return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(request: Request) {
	const repoRoot = getRepoRoot();
	if (!repoRoot) {
		return Response.json(
			{ ok: false, message: 'Repo root not found. Run from repo root or apps/web.' },
			{ status: 500 }
		);
	}
	const engineSrc = path.join(repoRoot, 'packages', 'engine', 'src');
	const outDir = path.join(repoRoot, 'apps', 'web', 'public', 'research', 'latest');
	const engineVenvPython = path.join(repoRoot, 'packages', 'engine', '.venv', 'bin', 'python');
	const rootVenvPython = path.join(repoRoot, '.venv', 'bin', 'python');
	const configPath = path.join(outDir, 'run_config.json');

	let body: Record<string, unknown> = {};
	try {
		if (request.body) body = (await request.json()) as Record<string, unknown>;
	} catch {
		// use defaults when body is missing or invalid
	}
	if (!body || typeof body !== 'object') {
		body = {};
	}

	const config = buildRunConfig(body);

	if (!fs.existsSync(engineSrc)) {
		return Response.json(
			{ ok: false, message: 'Engine package not found at packages/engine/src.' },
			{ status: 500 }
		);
	}

	fs.mkdirSync(outDir, { recursive: true });
	fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

	const runSummary = {
		symbol: config.symbol,
		interval: config.interval,
		period: config.period,
		strategy: (config.strategy as { name?: string })?.name ?? 'momentum',
		initial_cash: (config.portfolio as { initial_cash?: number })?.initial_cash,
		risk: {
			max_daily_loss_pct: (config.risk as Record<string, unknown>)?.max_daily_loss_pct,
			max_trades_per_day: (config.risk as Record<string, unknown>)?.max_trades_per_day,
		},
	};

	const pythonCmd = fs.existsSync(engineVenvPython)
		? engineVenvPython
		: fs.existsSync(rootVenvPython)
			? rootVenvPython
			: 'python3';
	const pythonPath = engineSrc;

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			let stderrBuffer = '';
			const child = spawn(
				pythonCmd,
				[
					'-m',
					'engine.scripts.run_config',
					'--config',
					configPath,
					'--out',
					outDir,
					'--root',
					repoRoot,
				],
				{
					cwd: repoRoot,
					env: {
						...process.env,
						PYTHONPATH: process.env.PYTHONPATH
							? `${pythonPath}:${process.env.PYTHONPATH}`
							: pythonPath,
					},
				}
			);
			controller.enqueue(
				encoder.encode(
					sse('start', {
						ok: true,
						outDir,
						message: `Running: ${config.symbol} ${config.interval} ${config.period}`,
						config: runSummary,
					})
				)
			);
			child.stdout.on('data', (chunk: Buffer) => {
				controller.enqueue(
					encoder.encode(sse('log', { stream: 'stdout', message: chunk.toString() }))
				);
			});
			child.stderr.on('data', (chunk: Buffer) => {
				const text = chunk.toString();
				stderrBuffer += text;
				controller.enqueue(encoder.encode(sse('log', { stream: 'stderr', message: text })));
			});
			child.on('error', (error: Error) => {
				controller.enqueue(
					encoder.encode(sse('end', { ok: false, message: error.message, error: error.message }))
				);
				controller.close();
			});
			child.on('close', (code: number | null) => {
				let message = code === 0 ? 'Simulation completed.' : 'Simulation failed.';
				let error: string | undefined;
				if (code !== 0 && stderrBuffer) {
					const lines = stderrBuffer.trim().split(/\r?\n/);
					for (let i = lines.length - 1; i >= 0; i--) {
						try {
							const parsed = JSON.parse(lines[i]) as { ok?: boolean; error?: string };
							if (parsed.ok === false && typeof parsed.error === 'string') {
								error = parsed.error;
								message = `Simulation failed: ${parsed.error}`;
								break;
							}
						} catch {
							/* not JSON */
						}
					}
				}
				controller.enqueue(encoder.encode(sse('end', { ok: code === 0, code, message, error })));
				controller.close();
			});
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream; charset=utf-8',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
		},
	});
}
