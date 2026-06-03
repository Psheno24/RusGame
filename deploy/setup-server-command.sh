#!/usr/bin/env bash
# Один раз на VPS (после clone в /opt/rusgame):
#   bash deploy/setup-server-command.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

chmod +x update.sh deploy/update.sh deploy/setup-server-command.sh deploy/caddy-entrypoint.sh 2>/dev/null || true

MARK="# RusGame deploy"
LINE="alias rusgame-update='cd ${ROOT} && bash update.sh'"

if ! grep -qF "$MARK" ~/.bashrc 2>/dev/null; then
  {
    echo ""
    echo "$MARK"
    echo "$LINE"
  } >> ~/.bashrc
  echo "Добавлено в ~/.bashrc: rusgame-update"
else
  echo "Алиас уже есть в ~/.bashrc"
fi

echo ""
echo "Готово. После push на сервере:  rusgame-update"
echo "(git pull + docker, в конце будет [OK] или [FAIL])"
