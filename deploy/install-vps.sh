#!/usr/bin/env bash
# Первичная установка на Ubuntu 22.04+ (VPS).
# Запуск на сервере: bash deploy/install-vps.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/rusgame}"
REPO_URL="${REPO_URL:-https://github.com/Psheno24/RusGame.git}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Установка Docker..."
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl git
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
  echo "Если Docker только что установлен — перелогиньтесь (ssh заново) и запустите скрипт снова."
fi

sudo mkdir -p "$DEPLOY_PATH"
sudo chown -R "$USER:$USER" "$DEPLOY_PATH"

if [ ! -d "$DEPLOY_PATH/.git" ]; then
  git clone "$REPO_URL" "$DEPLOY_PATH"
else
  echo "Репозиторий уже есть в $DEPLOY_PATH"
fi

cd "$DEPLOY_PATH"

if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "=== Создан .env — отредактируйте перед запуском ==="
  echo "  nano $DEPLOY_PATH/.env"
  echo "Обязательно: SITE_DOMAIN, JWT_SECRET, ADMIN_PASSWORD"
  exit 0
fi

docker compose up -d --build
echo ""
echo "Готово. Откройте https://\$(grep SITE_DOMAIN .env | cut -d= -f2)"
echo "PWA: «Добавить на главный экран» в браузере телефона."
