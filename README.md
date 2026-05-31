# Россия — жизнь

PWA-игра по городам России: регистрация, карта, работа, магазин, лента города.

- Репозиторий: [github.com/Psheno24/RusGame](https://github.com/Psheno24/RusGame)
- **Инструкция для чайника (от А до Я):** [deploy/INSTRUKCIYA.md](deploy/INSTRUKCIYA.md)
- **Краткий тех. деплой:** [deploy/DEPLOY.md](deploy/DEPLOY.md)

## Что есть

- Регистрация и вход, сессия (refresh cookie)
- Карта 16 городов (играют **Омск** и **Казань**)
- Подработка и смена, переезд, симка, авто
- Разные места (шиномонтаж, полиция и др.)
- Лента активности города

## Локально (Windows)

[Node.js 20+](https://nodejs.org/).

```powershell
cd C:\Users\pshen\Desktop\Devel\RussiaGame
npm install
```

**Терминал 1:** `npm run dev:api`  
**Терминал 2:** `npm run dev:web`

Откройте **http://localhost:5173**

На телефоне в той же Wi‑Fi: `http://ВАШ_IP:5173` (`ipconfig` → IPv4). PWA: «Добавить на главный экран».

### Проверка production-сборки локально

```powershell
npm run build
$env:LOCAL_DEV="true"; npm run start
```

Откройте **http://localhost:3001** (API + собранный фронт).

## База данных

SQLite: `data/game.db` (создаётся при первом запуске API).  
На сервере файл лежит в `data/` и **сохраняется** при `git pull` / деплое.

Удалить `data/game.db` — начать игру с нуля.

## На сайт (кратко)

1. VPS + домен → A-запись на IP.
2. На сервере: `git clone` + `.env` → `docker compose up -d --build`.
3. В GitHub Secrets: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `DEPLOY_PATH`.
4. `git push origin main` — сайт обновится сам.

Подробно: **[deploy/INSTRUKCIYA.md](deploy/INSTRUKCIYA.md)** (пошагово) или [deploy/DEPLOY.md](deploy/DEPLOY.md) (кратко)

## Структура

- `apps/api` — Fastify, SQLite, API
- `apps/web` — React, PWA
- `data/*.json` — города, работы, телефоны
- `docker-compose.yml` — app + Caddy (HTTPS)
