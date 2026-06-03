#!/usr/bin/env bash
# На сервере:  rusgame-update   или   bash update.sh
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

fail() {
	local msg="$1"
	echo ""
	echo "[FAIL] $msg"
	if [ -f "$LOG" ]; then
		local hint
		hint="$(grep -iE 'error TS|error:|failed|ERR!' "$LOG" | tail -n 3 | sed 's/^[[:space:]]*//' || true)"
		if [ -n "$hint" ]; then
			echo "Причина:"
			echo "$hint" | sed 's/^/  /'
		fi
		echo "Подробности: data/deploy-last.log"
	fi
	exit 1
}

wait_app_healthy() {
	local i
	for i in $(seq 1 40); do
		if docker compose exec -T app node -e \
			"fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
			>/dev/null 2>&1; then
			return 0
		fi
		sleep 2
	done
	return 1
}

echo "RusGame: git pull..."
git fetch origin main >/dev/null 2>&1 || fail "нет связи с GitHub"
git pull --ff-only origin main >/dev/null 2>&1 || git reset --hard origin/main >/dev/null 2>&1 || fail "не удалось обновить код"

echo "RusGame: docker build (1–3 мин, тихо; лог: data/deploy-last.log)..."
export COMPOSE_ANSI=never
if ! docker compose up -d --build >"$LOG" 2>&1; then
	fail "сборка Docker упала (npm run check на ПК)"
fi

if ! wait_app_healthy; then
	fail "app не отвечает на /api/health — см. docker compose logs app"
fi

URL="$(site_url || true)"
echo ""
if [ -n "$URL" ]; then
	echo "[OK] $URL"
else
	echo "[OK] Сервер обновлён."
fi
