#!/usr/bin/env bash
# Обновление на сервере одной командой (удобно из Termius):
#   cd /opt/rusgame && bash deploy/update.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== RusGame: обновление ==="
git fetch origin main
git reset --hard origin/main

docker compose up -d --build

echo ""
echo "=== Статус ==="
docker compose ps

echo ""
echo "=== Последние строки логов Caddy ==="
docker compose logs --tail=15 caddy 2>/dev/null || true

if [ -f .env ] && grep -q '^SITE_DOMAIN=' .env; then
	DOM="$(grep '^SITE_DOMAIN=' .env | cut -d= -f2- | tr -d '\r\"' | xargs)"
	echo ""
	echo "Сайт: https://${DOM}"
fi
