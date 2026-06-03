#!/usr/bin/env bash
# На сервере после push:  cd /opt/rusgame && bash update.sh
# или:  rusgame-update
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOG="${ROOT}/data/deploy-last.log"
mkdir -p "${ROOT}/data"

site_url() {
	if [ -f .env ] && grep -q '^SITE_DOMAIN=' .env; then
		local dom
		dom="$(grep '^SITE_DOMAIN=' .env | cut -d= -f2- | tr -d '\r\"' | xargs)"
		[ -n "$dom" ] && echo "https://${dom}"
	fi
}

container_ok() {
	local name="$1"
	local st
	st="$(docker compose ps "$name" --format '{{.State}}' 2>/dev/null | head -1 || true)"
	[ "$st" = "running" ]
}

fail() {
	local msg="$1"
	echo ""
	echo "[FAIL] $msg"
	if [ -f "$LOG" ]; then
		echo "Последние строки лога:"
		tail -n 6 "$LOG" | sed 's/^/  /'
		echo "Полный лог: data/deploy-last.log"
	fi
	exit 1
}

echo "RusGame: git pull..."
git fetch origin main >/dev/null 2>&1 || fail "не удалось связаться с GitHub (git fetch)"
if git pull --ff-only origin main >/dev/null 2>&1; then
	:
else
	git reset --hard origin/main >/dev/null 2>&1 || fail "не удалось обновить код (git reset)"
fi

echo "RusGame: docker build (подождите 1–3 мин, детали в data/deploy-last.log)..."
if ! docker compose up -d --build >"$LOG" 2>&1; then
	fail "сборка Docker упала — проверьте код на ПК: npm run check"
fi

if ! container_ok app; then
	fail "контейнер app не запущен"
fi

URL="$(site_url || true)"
echo ""
if [ -n "$URL" ]; then
	echo "[OK] Сайт обновлён: $URL"
else
	echo "[OK] Сервер обновлён, контейнер app работает."
fi

if ! container_ok caddy; then
	echo "     Внимание: caddy не running — HTTPS может не работать."
fi
