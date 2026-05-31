# Инструкция «для чайника»: игра в интернете + PWA на телефоне

От **нуля** до «открыл на телефоне из любого места» и «сделал `git push` — сайт обновился».

Репозиторий игры: [github.com/Psheno24/RusGame](https://github.com/Psheno24/RusGame)

---

## Что вы в итоге получите

1. Сайт вида `https://game.ваш-домен.ru` — туда заходят с компьютера и телефона.
2. Иконка на главном экране телефона (PWA), как приложение.
3. База игроков на сервере (файл `game.db`, не пропадает при обновлениях).
4. Вы меняете код на ПК → `git push` → через пару минут на сайте новая версия.

```text
  [Ваш ПК]  ──git push──►  [GitHub]  ──автоматически──►  [VPS сервер]
                                                              │
  [Телефон] ◄──────────── HTTPS ────────────────────────────┘
```

---

## Словарь (2 минуты)

| Слово | Простыми словами |
|--------|------------------|
| **VPS** | Арендованный компьютер в интернете, который работает 24/7 |
| **Домен** | Адрес сайта, например `game.mysite.ru` |
| **GitHub** | Хранилище кода в облаке |
| **SSH** | Удалённое управление сервером через чёрное окно (терминал) |
| **Docker** | Запуск игры «в коробке», без ручной установки Node.js на сервер |
| **HTTPS** | Замочек в браузере; **без него PWA на телефон не поставится** |

---

## Что купить / подготовить

- [ ] VPS с **Ubuntu 22.04** (или 24.04), от **1 GB RAM** (хватит с запасом).
- [ ] **Домен** (или поддомен, если домен уже есть).
- [ ] Аккаунт **GitHub** (у вас уже есть репозиторий RusGame).
- [ ] На ПК: **Git** и **Node.js** (для локальной разработки; на сервер Node ставить не нужно — есть Docker).

Провайдеры VPS (примеры): Timeweb, Selectel, Aeza, Hetzner.  
Домен можно купить там же или отдельно (Reg.ru, Timeweb и т.д.).

---

# ЧАСТЬ A. Код на GitHub (на вашем ПК)

### A1. Откройте PowerShell

`Win + X` → **Терминал** или **PowerShell**.

### A2. Перейдите в папку проекта

```powershell
cd C:\Users\pshen\Desktop\Devel\RussiaGame
```

(если путь другой — подставьте свой)

### A3. Проверьте, что Git видит проект

```powershell
git status
```

Если пишет «not a git repository» — напишите в чат, поможем инициализировать.

### A4. Залейте всё на GitHub

```powershell
git add .
git commit -m "Подготовка к деплою на сервер"
git push origin main
```

При первом `push` может спросить логин GitHub. Используйте **Personal Access Token** вместо пароля (в GitHub: Settings → Developer settings → Tokens).

**Проверка:** откройте в браузере [github.com/Psheno24/RusGame](https://github.com/Psheno24/RusGame) — должны быть файлы `Dockerfile`, папка `deploy`, `.github/workflows/deploy.yml`.

---

# ЧАСТЬ B. Настройка VPS (сервер)

## B1. Узнайте IP сервера

В панели хостинга VPS найдите **IPv4**, например `185.12.34.56`. Запишите.

## B2. Привяжите домен к серверу

В панели домена создайте запись:

| Тип | Имя | Значение |
|-----|-----|----------|
| **A** | `game` (или `@` для корня) | IP вашего VPS |

Пример: хотите адрес `game.mysite.ru` → имя `game`, значение = IP VPS.  
Подождите **5–30 минут** (иногда до 2 часов), пока DNS обновится.

Проверка с ПК (PowerShell):

```powershell
nslookup game.ваш-домен.ru
```

Должен показать IP вашего VPS.

## B3. Подключитесь к серверу по SSH

В панели VPS при создании вам дали **логин** (часто `root`) и **пароль** (или SSH-ключ).

**Windows 10/11** — в PowerShell:

```powershell
ssh root@185.12.34.56
```

(замените IP на свой)

При первом подключении спросит `yes/no` — введите `yes`.  
Введите пароль (символы **не отображаются** — это нормально).

Вы внутри сервера, если видите приглашение вроде `root@server:~#`.

---

## B4. Установите Docker на сервере

Копируйте команды **по одной**, Enter после каждой:

```bash
apt-get update
apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sh
```

Проверка:

```bash
docker --version
docker compose version
```

Должны показать версии без ошибки.

---

## B5. Скачайте игру на сервер

```bash
mkdir -p /opt/rusgame
cd /opt/rusgame
git clone https://github.com/Psheno24/RusGame.git .
```

Точка в конце важна — клонирует **в текущую папку**.

Если папка не пустая и ошибка — используйте только:

```bash
cd /opt/rusgame
git pull origin main
```

---

## B6. Создайте файл настроек `.env`

```bash
cd /opt/rusgame
cp .env.example .env
nano .env
```

Откроется редактор. **Сотрите пример и вставьте** (подставьте свой домен и пароли):

```env
SITE_DOMAIN=game.ваш-домен.ru
PORT=3001
LOCAL_DEV=false
JWT_SECRET=ЗАМЕНИТЕ_НА_СЛУЧАЙНУЮ_ДЛИННУЮ_СТРОКУ
COOKIE_SECURE=true
TRUST_PROXY=true
ADMIN_LOGIN=admin
ADMIN_PASSWORD=ЗАМЕНИТЕ_НА_СВОЙ_ПАРОЛЬ_АДМИНА
```

**JWT_SECRET** — любая длинная случайная строка. Сгенерировать на сервере:

```bash
openssl rand -base64 32
```

Скопируйте результат в `JWT_SECRET=...`.

**Сохранить в nano:** `Ctrl+O`, Enter, потом `Ctrl+X`.

> `SITE_DOMAIN` — **без** `https://`, только имя: `game.mysite.ru`

---

## B7. Запустите сайт

```bash
cd /opt/rusgame
docker compose up -d --build
```

Первый раз займёт **5–15 минут** (скачивание и сборка). Ждите, пока команда завершится.

Проверка:

```bash
docker compose ps
```

Оба сервиса `app` и `caddy` должны быть **Up**.

### B8. Откройте в браузере

На ПК откройте: `https://game.ваш-домен.ru`

- Должна открыться игра (регистрация / вход).
- Замочек HTTPS в адресной строке.

**Если не открывается:**

1. Подождите DNS (часть B2).
2. На VPS откройте порты **80** и **443** в файрволе панели хостинга.
3. Логи: `docker compose logs -f app` (выход: `Ctrl+C`).

**База данных:** после первого входа игрока появится файл `/opt/rusgame/data/game.db`.

---

# ЧАСТЬ C. PWA на телефоне

1. На телефоне откройте **Chrome** (Android) или **Safari** (iPhone).
2. Введите тот же адрес: `https://game.ваш-домен.ru`
3. Зарегистрируйтесь / войдите.
4. **Android (Chrome):** меню ⋮ → «Установить приложение» / «Добавить на главный экран».
5. **iPhone (Safari):** «Поделиться» → «На экран Домой».

Готово — иконка на рабочем столе, работает из мобильного интернета, не только Wi‑Fi.

---

# ЧАСТЬ D. Автообновление с GitHub (push → сайт меняется)

Чтобы **не заходить на сервер** после каждой правки — настраиваем GitHub Actions один раз.

## D1. Создайте SSH-ключ на ПК (для GitHub → сервер)

В **PowerShell на Windows**:

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\rusgame_deploy -N '""'
```

Появятся два файла:

- `C:\Users\ВАШ_ЛОГИН\.ssh\rusgame_deploy` — **секретный** (никому не давать)
- `C:\Users\ВАШ_ЛОГИН\.ssh\rusgame_deploy.pub` — **публичный**

## D2. Публичный ключ — на сервер

Показать публичный ключ на ПК:

```powershell
Get-Content $env:USERPROFILE\.ssh\rusgame_deploy.pub
```

Скопируйте **всю строку** (начинается с `ssh-ed25519`).

На **сервере** (вы подключены по SSH):

```bash
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
```

Вставьте строку ключа в **новую строку**, сохраните (`Ctrl+O`, Enter, `Ctrl+X`):

```bash
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

Проверка с ПК (должен войти **без пароля**):

```powershell
ssh -i $env:USERPROFILE\.ssh\rusgame_deploy root@ВАШ_IP
```

## D3. Секреты в GitHub

Откройте: [github.com/Psheno24/RusGame/settings/secrets/actions](https://github.com/Psheno24/RusGame/settings/secrets/actions)

**New repository secret** — создайте **четыре** штуки:

| Имя секрета | Что вписать |
|-------------|-------------|
| `SSH_HOST` | IP сервера, например `185.12.34.56` |
| `SSH_USER` | `root` (или тот логин, под которым ставили игру) |
| `DEPLOY_PATH` | `/opt/rusgame` |
| `SSH_PRIVATE_KEY` | **Весь** файл секретного ключа |

Для `SSH_PRIVATE_KEY` на ПК:

```powershell
Get-Content $env:USERPROFILE\.ssh\rusgame_deploy
```

Скопируйте **всё**, включая строки `-----BEGIN ... KEY-----` и `-----END ... KEY-----`.

## D4. Проверка автодеплоя

1. На ПК что-нибудь поменяйте в проекте (или пустой коммит).
2. В PowerShell:

```powershell
cd C:\Users\pshen\Desktop\Devel\RussiaGame
git add .
git commit -m "Проверка автодеплоя"
git push origin main
```

3. На GitHub: вкладка **Actions** → workflow **Deploy to VPS** → зелёная галочка = успех.
4. Через 1–3 мин обновите сайт на телефоне (закройте PWA и откройте снова).

Ручной запуск деплоя: **Actions** → **Deploy to VPS** → **Run workflow**.

---

# ЧАСТЬ E. Как жить дальше (каждый день)

### Локально тестируете на ПК

**Терминал 1:**

```powershell
cd C:\Users\pshen\Desktop\Devel\RussiaGame
npm run dev:api
```

**Терминал 2:**

```powershell
cd C:\Users\pshen\Desktop\Devel\RussiaGame
npm run dev:web
```

Браузер: `http://localhost:5173`

### Выкладываете на сайт

```powershell
git add .
git commit -m "Кратко: что изменили"
git push origin main
```

Ждёте зелёный Actions — готово.

### Обновить вручную без GitHub (если Actions сломался)

На сервере по SSH:

```bash
cd /opt/rusgame
git pull origin main
docker compose up -d --build
```

---

# ЧАСТЬ F. Полезное и страховка

### Бэкап базы (раз в неделю)

На сервере:

```bash
cd /opt/rusgame
cp data/game.db data/game.db.backup-$(date +%F)
ls -la data/*.backup*
```

### Посмотреть логи, если «не работает»

```bash
cd /opt/rusgame
docker compose logs -f app
```

`Ctrl+C` — выход.

### Перезапуск

```bash
cd /opt/rusgame
docker compose restart
```

### Админ (один раз, по желанию)

С ПК (подставьте домен и пароль из `.env`):

```powershell
curl -X POST https://game.ваш-домен.ru/api/admin/seed `
  -H "Content-Type: application/json" `
  -d '{\"login\":\"admin\",\"password\":\"ВАШ_ADMIN_PASSWORD\"}'
```

---

# Частые проблемы

| Симптом | Что сделать |
|---------|-------------|
| Сайт не открывается | DNS (B2), порты 80/443, `docker compose ps` |
| «Не авторизован» на сайте | Выйти / войти снова; проверить `COOKIE_SECURE=true` и HTTPS |
| Actions красный | Проверить 4 секрета; ключ в `authorized_keys`; `DEPLOY_PATH=/opt/rusgame` |
| PWA не ставится на телефон | Только **https://**, не IP и не `http://` |
| После push старая версия | Подождать 3 мин; на телефоне закрыть приложение полностью и открыть снова |
| `git pull` конфликт на сервере | `cd /opt/rusgame && git fetch && git reset --hard origin/main && docker compose up -d --build` |

---

# Краткий чеклист «всё сделал»

- [ ] Код на GitHub (часть A)
- [ ] VPS + домен → A-запись (B1–B2)
- [ ] SSH заходит (B3)
- [ ] Docker установлен (B4)
- [ ] `/opt/rusgame` + `.env` (B5–B6)
- [ ] `docker compose up -d --build` (B7)
- [ ] `https://домен` открывается (B8)
- [ ] PWA на телефоне (C)
- [ ] 4 секрета GitHub + зелёный Actions (D)
- [ ] `git push` обновляет сайт (D4)

---

Если застрянете на **конкретном шаге** — напишите номер шага (например «B7, ошибка …») и текст ошибки, разберём точечно.

Техническая версия без «воды»: [DEPLOY.md](./DEPLOY.md)
