# Деплой RusGame на VPS + GitHub

Цель: **HTTPS-сайт** с PWA на телефоне, **SQLite** на сервере, обновление командой `git push` (через GitHub Actions).

## Что нужно

| Что | Зачем |
|-----|--------|
| VPS (Ubuntu 22.04+, 1 GB RAM достаточно) | Сервер |
| Домен (A-запись → IP VPS) | HTTPS и PWA на телефоне |
| Репозиторий [RusGame](https://github.com/Psheno24/RusGame) | Код и автодеплой |

Без домена PWA на телефоне **не установится** (нужен HTTPS). Можно взять дешёвый домен или поддомен.

---

## 1. Первый раз на сервере

Подключитесь по SSH:

```bash
ssh user@ВАШ_IP
```

Склонируйте и подготовьте окружение:

```bash
export DEPLOY_PATH=/opt/rusgame
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Psheno24/RusGame/main/deploy/install-vps.sh)"
```

Или вручную:

```bash
sudo mkdir -p /opt/rusgame && sudo chown $USER:$USER /opt/rusgame
git clone https://github.com/Psheno24/RusGame.git /opt/rusgame
cd /opt/rusgame
cp .env.example .env
nano .env
```

### `.env` на сервере (пример)

```env
SITE_DOMAIN=game.ваш-домен.ru
PORT=3001
LOCAL_DEV=false
JWT_SECRET=случайная-длинная-строка-минимум-32-символа
COOKIE_SECURE=true
ADMIN_LOGIN=admin
ADMIN_PASSWORD=надёжный-пароль
```

Сгенерировать секрет: `openssl rand -base64 32`

Запуск:

```bash
cd /opt/rusgame
docker compose up -d --build
```

Проверка: `https://game.ваш-домен.ru` — игра и API на одном домене.

**База данных:** файл `data/game.db` на диске VPS (том Docker `./data`). При обновлении не удаляется.

---

## 2. GitHub Actions — push → обновление сайта

В репозитории GitHub: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Пример |
|--------|--------|
| `SSH_HOST` | IP или домен VPS |
| `SSH_USER` | `root` или `ubuntu` |
| `SSH_PRIVATE_KEY` | приватный ключ SSH (весь файл `id_ed25519`) |
| `DEPLOY_PATH` | `/opt/rusgame` |

На сервере должен быть настроен **доступ по ключу** для `SSH_USER`.

### Если в GitHub красный крестик «Deploy to VPS»

Чаще всего **не заданы секреты** (в логах: `missing server host`, `cd ""`). Пока секреты не добавлены, workflow **пропускает деплой** и не блокирует merge; проверка **CI** (сборка и тесты) должна быть зелёной.

Чтобы сайт обновлялся сам после merge в `main`, добавьте все четыре секрета из таблицы выше.

**Обновить сервер вручную** (пока нет Actions):

```bash
ssh user@ВАШ_IP
cd /opt/rusgame
bash deploy/update.sh
```

---

После каждого `git push` в ветку `main` Actions выполнит на сервере:

```bash
cd /opt/rusgame
git pull
docker compose up -d --build
```

Ручной деплой: **Actions → Deploy to VPS → Run workflow**.

### Локально у себя

```powershell
cd C:\Users\pshen\Desktop\Devel\RussiaGame
git add .
git commit -m "описание изменений"
git push origin main
```

Через 1–3 минуты сайт обновится. На телефоне PWA подтянет новую версию при следующем открытии (Service Worker `autoUpdate`).

---

## 3. PWA на телефоне

1. Откройте **https://ваш-домен** в Chrome (Android) или Safari (iOS).
2. Войдите / зарегистрируйтесь.
3. **Добавить на главный экран** — иконка как приложение.
4. Работает из любой сети (не только домашний Wi‑Fi).

---

## 4. Админ (один раз)

```bash
curl -X POST https://game.ваш-домен.ru/api/admin/seed \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"как в ADMIN_PASSWORD"}'
```

(если seed ещё не вызывали; см. README)

---

## 5. Полезные команды на VPS

```bash
cd /opt/rusgame
docker compose logs -f app      # логи
docker compose ps
docker compose restart app
# бэкап БД:
cp data/game.db data/game.db.backup-$(date +%F)
```

---

## 6. Обновление без GitHub Actions

На сервере:

```bash
cd /opt/rusgame
git pull origin main
docker compose up -d --build
```

---

## Схема

```text
Телефон (PWA) ──HTTPS──► Caddy (:443)
                              │
                              ▼
                         Node app (:3001)
                         ├── API /api/*
                         ├── React dist
                         └── SQLite data/game.db

GitHub push main ──► Actions SSH ──► git pull + docker compose build
```
