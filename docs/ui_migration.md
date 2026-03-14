# UI Migration Note

The active UI has migrated from Streamlit to Next.js.

- Deprecated UI: `ui_streamlit_deprecated/`
- Active UI: `ui/` (Next.js + Tailwind)
- Python compute pipeline remains unchanged and continues to generate artifacts under `outputs/demo_run/`.
- `scripts/sync_ui_artifacts.py` mirrors artifacts into `ui/public/demo_run/` for deterministic local rendering.
