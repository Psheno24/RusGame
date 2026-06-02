#!/bin/sh
# Генерирует Caddyfile из SITE_DOMAIN — надёжнее, чем {$SITE_DOMAIN} в статическом файле.
set -eu

if [ -z "${SITE_DOMAIN:-}" ]; then
	echo "Ошибка: SITE_DOMAIN не задан (добавьте в .env)" >&2
	exit 1
fi

cat > /tmp/Caddyfile <<EOF
${SITE_DOMAIN} {
	encode gzip
	reverse_proxy app:3001
}
EOF

exec caddy run --config /tmp/Caddyfile --adapter caddyfile
