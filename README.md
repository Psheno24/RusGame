# Россия — жизнь

PWA-игра по городам России.

## Ежедневная работа (2 шага)

### 1. Локально — тест

```powershell
cd C:\Users\pshen\Desktop\Devel\RussiaGame
npm run dev
```

Откройте **http://localhost:5173** — фронт обновляется мгновенно (Vite), API перезапускается при сохранении (tsx watch).

В Cursor: **Terminal → Run Task → Dev: localhost** (или `Ctrl+Shift+B`).

### 2. На сервер — GitHub Desktop → Push

Commit → **Push origin** → GitHub Actions собирает и деплоит на VPS (~2–3 мин).

Секреты один раз: [deploy/GITHUB-ACTIONS.md](deploy/GITHUB-ACTIONS.md)

---

## Первый раз на ПК

[Node.js 20+](https://nodejs.org/).

```powershell
npm run setup
```

(установка зависимостей, `.env`, запуск dev)

Если API падает с `better-sqlite3` / `NODE_MODULE_VERSION` — вы обновили Node.js:

```powershell
npm run dev:clean
```

Или вручную: закройте все терминалы с `npm run dev`, затем `npm rebuild better-sqlite3 -w @russia-game/api` и `npm run dev`.

---

## Полезное

| Команда | Зачем |
|---------|--------|
| `npm run dev:clean` | Остановить старые dev-процессы и запустить заново |
| `npm run check` | Сборка + тесты (как в CI) перед push |
| `npm run build` | Production-сборка |
| `npm run docker:up` | Локально через Docker |

## Документация

- [deploy/GITHUB-ACTIONS.md](deploy/GITHUB-ACTIONS.md) — автодеплой (Secrets)
- [deploy/INSTRUKCIYA.md](deploy/INSTRUKCIYA.md) — VPS с нуля
- [deploy/DEPLOY.md](deploy/DEPLOY.md) — краткий тех. деплой

## Структура

- `apps/api` — Fastify, SQLite
- `apps/web` — React, PWA
- `data/` — конфиги и `game.db` локально
