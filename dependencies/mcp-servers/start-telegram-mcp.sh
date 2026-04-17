#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TG_DIR="$ROOT_DIR/telegram-mcp"

if [[ ! -d "$TG_DIR" ]]; then
  echo "telegram-mcp folder not found at $TG_DIR"
  exit 1
fi

if [[ ! -f "$TG_DIR/.venv/bin/activate" ]]; then
  echo "telegram-mcp virtualenv missing; run setup first"
  exit 1
fi

if [[ ! -f "$TG_DIR/.env" ]]; then
  echo "telegram-mcp .env missing; copy .env.example to .env and fill credentials"
  exit 1
fi

cd "$TG_DIR"
# shellcheck disable=SC1091
source .venv/bin/activate
python main.py
