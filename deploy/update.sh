#!/usr/bin/env bash
# Обновление на сервере одной командой:
#   cd /opt/rusgame && bash deploy/update.sh
# или (после setup-server-command.sh):  rusgame-update
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== RusGame: обновление ==="
git fetch origin main
if git pull --ff-only origin main; then
  echo "Код обновлён (fast-forward)."
else
  echo "git pull не прошёл — сбрасываем к origin/main (локальные правки на сервере будут потеряны)."
  git reset --hard origin/main
fi

echo "=== Сборка Docker (как в CI) ==="
if ! docker compose up -d --build; then
  echo ""
  echo "ОШИБКА: сборка упала. Исправьте на ПК: npm run check, затем push в main."
  exit 1
fi

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
