-- ============================================================================
-- МИГРАЦИЯ 004: присутствие игроков (мониторинг 24/7)
-- ============================================================================
-- Клиент шлёт «пульс» (POST /api/tables/heartbeat) раз в секунду. Сервер
-- считает игрока ушедшим, если отметка last_seen_at старше лимита, и:
--   • убирает игрока со стола (минус участник и минус «играет»);
--   • самоликвидирует стол, в котором не осталось ни одного игрока.
-- Без этой миграции приложение продолжает работать, но чистка «призраков»
-- недоступна (роуты деградируют в «мягкий» режим).
--
-- Запустите в Supabase → SQL Editor (после 001, 002, 003).
-- ============================================================================

alter table public.table_players
  add column if not exists last_seen_at timestamptz default now();

-- Уже сидящие за столами игроки получают отметку «сейчас», чтобы их не
-- посчитали ушедшими на первом же «дворниковом» проходе.
update public.table_players set last_seen_at = now() where last_seen_at is null;

-- Быстрый поиск устаревших отметок и мест игрока
create index if not exists table_players_last_seen_idx on public.table_players (last_seen_at);
create index if not exists table_players_user_idx on public.table_players (user_id);
create index if not exists table_players_table_idx on public.table_players (table_id);

-- Диагностика по столам
alter table public.tables
  add column if not exists updated_at timestamptz default now();
