# Россия — жизнь

PWA-игра для **локальной проверки** на ПК и телефоне в одной Wi‑Fi. Деплой на VPS — позже.

## Что есть

- Регистрация и вход, сессия на 90 дней
- Карта 16 городов (играют **Омск** и **Казань**)
- Подработка и смена, переезд Омск ↔ Казань
- Симка и авто (магазин)

## Запуск (Windows)

Нужен [Node.js 20+](https://nodejs.org/).

```powershell
cd C:\Users\pshen\Desktop\Devel\RussiaGame
npm install
```

**Терминал 1:**

```powershell
npm run dev:api
```

**Терминал 2:**

```powershell
npm run dev:web
```

Откройте **http://localhost:5173** — API проксируется на порт 3001.

На телефоне в той же сети: `http://ВАШ_IP:5173` (`ipconfig` → IPv4).

### PWA на телефоне

Chrome/Safari → «Добавить на главный экран».

## Если что-то не работает

1. Оба терминала (`dev:api` и `dev:web`) должны быть запущены.
2. Выйдите и войдите снова — сбросит сессию.
3. База: `data/game.db` (удалите файл, чтобы начать с нуля).

## Структура

- `apps/api` — сервер, SQLite
- `apps/web` — интерфейс (React + PWA)
- `data/*.json` — города, работы, маршруты

## Позже (сервер)

`npm run build` и `npm run start` — один процесс на :3001. Перед VPS: сменить `JWT_SECRET`, при HTTPS — `LOCAL_DEV=false` и `COOKIE_SECURE=true` в `.env`.
