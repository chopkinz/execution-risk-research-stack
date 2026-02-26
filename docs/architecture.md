# Architecture

```mermaid
flowchart LR
  D[Data Loader] --> F[Feature Pipeline]
  F --> S[Strategy]
  S --> O[OrderIntent]
  O --> R[RiskEngine]
  R -->|Approved| E[Execution Simulator]
  R -->|Rejected| L[Structured Logs]
  E --> FL[Fill]
  FL --> P[Portfolio Accounting]
  P --> M[Metrics + Tear Sheet]
```

## Principles
- Deterministic execution with fixed seeds.
- Risk-first gate: strategy cannot mutate portfolio.
- Execution-aware fills: spread, slippage, latency, fees.
- Separation of concerns by module.
