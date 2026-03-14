/**
 * Shared backtest run config. Used by Simulation and Research APIs.
 * All runs use live market data (Yahoo) and engine.scripts.run_config — no demo/synthetic data.
 */

export const DEFAULT_RUN_CONFIG = {
  seed: 42,
  session: { start: "08:30", end: "10:30" },
  portfolio: { initial_cash: 100000 },
  risk: {
    max_position_size: 1,
    max_trades_per_day: 20,
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
} as const;

export function buildRunConfig(body: Record<string, unknown>) {
  const strat =
    typeof body.strategy === "object" && body.strategy !== null
      ? (body.strategy as Record<string, unknown>)
      : {};
  const bodyRisk =
    typeof body.risk === "object" && body.risk !== null ? (body.risk as Record<string, unknown>) : {};
  const bodyExecution =
    typeof body.execution === "object" && body.execution !== null
      ? (body.execution as Record<string, unknown>)
      : {};
  const bodyPortfolio =
    typeof body.portfolio === "object" && body.portfolio !== null
      ? (body.portfolio as Record<string, unknown>)
      : {};

  return {
    ...DEFAULT_RUN_CONFIG,
    symbol: String((body.symbol as string) ?? "^NDX").trim() || "^NDX",
    interval: (body.interval as string) ?? "15m",
    period: (body.period as string) ?? "60d",
    portfolio: {
      initial_cash:
        bodyPortfolio.initial_cash != null
          ? Number(bodyPortfolio.initial_cash)
          : DEFAULT_RUN_CONFIG.portfolio.initial_cash,
    },
    risk: {
      max_position_size:
        bodyRisk.max_position_size != null
          ? Number(bodyRisk.max_position_size)
          : DEFAULT_RUN_CONFIG.risk.max_position_size,
      max_trades_per_day:
        bodyRisk.max_trades_per_day != null
          ? Number(bodyRisk.max_trades_per_day)
          : DEFAULT_RUN_CONFIG.risk.max_trades_per_day,
      max_daily_loss_pct:
        bodyRisk.max_daily_loss_pct != null
          ? Number(bodyRisk.max_daily_loss_pct)
          : DEFAULT_RUN_CONFIG.risk.max_daily_loss_pct,
      max_drawdown_pct:
        bodyRisk.max_drawdown_pct != null
          ? Number(bodyRisk.max_drawdown_pct)
          : DEFAULT_RUN_CONFIG.risk.max_drawdown_pct,
      max_gross_exposure:
        bodyRisk.max_gross_exposure != null
          ? Number(bodyRisk.max_gross_exposure)
          : DEFAULT_RUN_CONFIG.risk.max_gross_exposure,
      ...(bodyRisk.max_weekly_loss_pct != null &&
        Number.isFinite(Number(bodyRisk.max_weekly_loss_pct)) && {
          max_weekly_loss_pct: Number(bodyRisk.max_weekly_loss_pct),
        }),
      ...(bodyRisk.max_open_positions != null &&
        Number.isFinite(Number(bodyRisk.max_open_positions)) && {
          max_open_positions: Number(bodyRisk.max_open_positions),
        }),
    },
    execution: {
      spread_bps:
        bodyExecution.spread_bps != null
          ? Number(bodyExecution.spread_bps)
          : DEFAULT_RUN_CONFIG.execution.spread_bps,
      min_spread:
        bodyExecution.min_spread != null
          ? Number(bodyExecution.min_spread)
          : DEFAULT_RUN_CONFIG.execution.min_spread,
      slippage_k:
        bodyExecution.slippage_k != null
          ? Number(bodyExecution.slippage_k)
          : DEFAULT_RUN_CONFIG.execution.slippage_k,
      delay_bars:
        bodyExecution.delay_bars != null
          ? Number(bodyExecution.delay_bars)
          : DEFAULT_RUN_CONFIG.execution.delay_bars,
      fee_bps:
        bodyExecution.fee_bps != null
          ? Number(bodyExecution.fee_bps)
          : DEFAULT_RUN_CONFIG.execution.fee_bps,
    },
    strategy: {
      name: (strat.name as string) ?? "momentum",
      qty: Number(strat.qty) || 1,
      threshold: Number(strat.threshold) || 0.0005,
      buffer_pct: Number(strat.buffer_pct) || 0,
      only_in_session: strat.only_in_session !== false,
      use_bullish: strat.use_bullish !== false,
      use_bearish: strat.use_bearish !== false,
    },
  };
}
