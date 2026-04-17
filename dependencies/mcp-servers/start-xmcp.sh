#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
XMCP_DIR="$ROOT_DIR/xmcp"

if [[ ! -d "$XMCP_DIR" ]]; then
  echo "xmcp folder not found at $XMCP_DIR"
  exit 1
fi

if [[ ! -f "$XMCP_DIR/.env" ]]; then
  echo "xmcp .env missing; copy env.example to .env and fill credentials"
  exit 1
fi

cd "$XMCP_DIR"

if [[ ! -f ".venv/bin/activate" ]]; then
  echo "Creating xmcp virtualenv..."
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

if ! python -c "import requests_oauthlib" >/dev/null 2>&1; then
  echo "Installing xmcp dependencies..."
  pip install -r requirements.txt
fi

python server.py
