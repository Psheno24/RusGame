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

---

## Полезное

| Команда | Зачем |
|---------|--------|
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
