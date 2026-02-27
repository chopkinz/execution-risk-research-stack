# Meridian Terminal UI

Institutional-grade markets and research terminal built with Next.js App Router + TypeScript + Tailwind.

## Run with Bun

```bash
bun install
bun run dev
bun run lint
bun run build
bun run verify
```

## Pages

- `/markets` interactive market review terminal using `lightweight-charts`
- `/research` artifact viewer backed by Python-generated research outputs
- `/about` professional profile and links

## Data Layer

- `/api/market?symbol=...&range=1m|3m|6m|1y`
- Primary source: Yahoo Finance (server-side)
- Secondary source: Stooq (server-side)
- Proxy fallback path for advanced instruments
- If data providers fail: clean unavailable state with retry

## Resume Placeholder

Place your current PDF at:

`apps/web/public/resume.pdf`

## Deploy to Vercel

Use `apps/web/` as root directory.
