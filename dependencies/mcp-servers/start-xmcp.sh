#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
XMCP_DIR="$ROOT_DIR/xmcp"

if [[ ! -d "$XMCP_DIR" ]]; then
  echo "xmcp folder not found at $XMCP_DIR"
  exit 1
fi

if [[ ! -f "$XMCP_DIR/.venv/bin/activate" ]]; then
  echo "xmcp virtualenv missing; run setup first"
  exit 1
fi

if [[ ! -f "$XMCP_DIR/.env" ]]; then
  echo "xmcp .env missing; copy env.example to .env and fill credentials"
  exit 1
fi

cd "$XMCP_DIR"
# shellcheck disable=SC1091
source .venv/bin/activate
python server.py
