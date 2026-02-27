#!/usr/bin/env bash
# Print SSH connection info for Termius. Run from repo root.
set -e
USER=$(whoami)
# macOS Wi-Fi IP (en0)
IP=$(ipconfig getifaddr en0 2>/dev/null) || true
if [ -z "$IP" ]; then
  IP=$(ipconfig getifaddr en1 2>/dev/null) || IP=$(ipconfig getifaddr en2 2>/dev/null) || true
fi
if [ -z "$IP" ]; then
  # Linux / fallback
  IP=$(hostname -I 2>/dev/null | awk '{print $1}') || IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}') || true
fi
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=22
echo ""
echo "=== Termius SSH connection (use these in Termius) ==="
echo ""
echo "  Host:     ${IP:-<could not detect — run: ipconfig getifaddr en0>}"
echo "  Port:     $PORT"
echo "  User:     $USER"
echo ""
echo "  After login, run:"
echo "  cd $REPO_ROOT"
echo "  make session"
echo "  # or: meridian-backtest --out apps/web/public/research/latest"
echo ""
if [ -z "$IP" ]; then
  echo "  (Get your Mac IP: System Settings → Wi‑Fi → Details, or run: ipconfig getifaddr en0)"
  echo ""
fi
