#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TG_DIR="$ROOT_DIR/telegram-mcp"

if [[ ! -d "$TG_DIR" ]]; then
  echo "telegram-mcp folder not found at $TG_DIR"
  exit 1
fi

if [[ ! -f "$TG_DIR/.env" ]]; then
  echo "telegram-mcp .env missing; copy .env.example to .env and fill credentials"
  exit 1
fi

cd "$TG_DIR"

if [[ ! -f ".venv/bin/activate" ]]; then
  echo "Creating telegram-mcp virtualenv..."
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

if ! python -c "import nest_asyncio" >/dev/null 2>&1; then
  echo "Installing telegram-mcp dependencies..."
  pip install -r requirements.txt
fi

python main.py
