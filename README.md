# Syndicate — «Дурак» в Telegram WebApp

Мини-приложение Telegram: карточная игра «Дурак» с двумя режимами и вторым
командным режимом **Синдикат** (2×2 и 2×2×2).

Стек: Next.js 16 (App Router), React 19, Tailwind v4, Supabase (Postgres + Realtime).

---

## 🚀 Быстрый старт

### 1. Переменные окружения

Скопируйте `.env.example` в `.env.local` и заполните:

```bash
cp .env.example .env.local
```

| Переменная | Назначение |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL проекта Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Публичный ключ (клиент) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Секретный** ключ сервера (обход RLS). Нужен для защиты карт |
| `TELEGRAM_BOT_TOKEN` | Токен бота для проверки подписи `initData` |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` — только сервер. Никогда не добавляйте его в
> `NEXT_PUBLIC_*` и не коммитьте `.env.local`.

### 2. Миграции БД

Выполните по порядку в Supabase → SQL Editor:

1. `supabase/migrations/001_game_states.sql` — базовые игровые поля
2. `supabase/migrations/002_security.sql` — **RLS-защита** (закрывает карты и балансы)
3. `supabase/migrations/003_game_state_modes.sql` — режимы и команды

> Применяйте `002_security.sql` **после** добавления `SUPABASE_SERVICE_ROLE_KEY`,
> иначе сервер потеряет доступ к `game_states`.

### 3. Запуск

```bash
npm install
npm run dev
```

---

## 🔐 Модель безопасности

Игра построена по принципу **server-authoritative**: вся раздача, проверка
правил и расчёт ставок происходят на сервере.

- **Клиент (anon-ключ)** больше не читает `game_states`, `users`, `game_history`.
  Эти таблицы закрыты политиками RLS (`revoke all ... from anon`).
- **Сервер (service_role)** — единственный, кто видит колоду и чужие руки.
- Игровое состояние отдаёт `GET /api/games/state/[id]`, причём:
  - свои карты — полностью;
  - чужие руки — только количество (`{ count }`);
  - колода — только `deck_count` (порядок карт не покидает сервер).
- Все мутирующие ручки (`tables`, `join`, `leave`, `games/*`) требуют
  подписанный Telegram `initData` (`authenticateRequest`). Флаг `isCreator`
  и `userId` из тела запроса больше не считаются доверенными.
- Расчёт ставки идемпотентен (защита от двойного начисления) и zero-sum:
  сколько проигравшие заплатили — столько победители и получили.

---

## 🃏 Режимы игры

| Режим | Описание |
|---|---|
| **Классический** (подкидной) | Подкидывать карты того же ранга может любой, кроме защитника |
| **Переводной** | Дополнительно: защитник может **перевести** ход, подложив карту того же ранга |
| **Синдикат** | Командная игра 2×2 или 2×2×2. Порядок хода перемешан так, чтобы напарники не сидели рядом (2×2 → `[1,3,2,4]`, 2×2×2 → `[1,3,5,2,4,6]`). Команда выигрывает, когда все её игроки вышли |

Ход (`/api/games/move`) принимает действия: `attack`, `defend`, `transfer`,
`take`, `bito`. Вся валидация — в `lib/game-engine.js` (чистые функции).

---

## 📡 API

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/tables` | Список активных столов + статистика (публично) |
| POST | `/api/tables` | Создать стол |
| POST | `/api/tables/join` | Сесть за стол |
| POST | `/api/tables/leave` | Выйти из-за стола |
| GET | `/api/tables/[id]` | Стол + игроки |
| POST | `/api/games/start` | Начать игру (создатель стола) |
| POST | `/api/games/move` | Сделать ход |
| POST | `/api/games/timeout` | Авто-ход по таймеру |
| GET | `/api/games/state/[id]` | Состояние игры (скрывает чужие карты) |
| POST | `/api/auth` | Авторизация по Telegram `initData` |

---

## 🗂 Структура

```
app/api/            серверные ручки (Next Route Handlers)
components/         UI (screens/, ui/)
lib/game-engine.js  правила игры (чистые функции)
lib/game-settle.js  расчёт ставки по итогам
lib/game-serializer.js  скрытие карт при отдаче клиенту
lib/supabase.js     клиентский Supabase (anon)
lib/supabase-admin.js серверный Supabase (service_role)
supabase/migrations/ SQL-миграции
types/index.ts      общие типы
```
