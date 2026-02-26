# Assumptions

- Yahoo Finance bars are used as canonical market data source.
- Market fills are approximated using bar close as mid-price reference.
- Latency is modeled as bar delay, not millisecond microstructure.
- Position accounting uses average-cost basis.
- Session defaults: 08:30-10:30 America/Chicago.
