-- ============================================================================
-- МИГРАЦИЯ: расширение game_states для полноценной игры «Дурак» + Синдикат
-- Выполните этот SQL в Supabase → SQL Editor.
-- ============================================================================

-- Новые колонки игрового состояния
alter table public.game_states
  add column if not exists trump_suit text,
  add column if not exists discard jsonb default '[]'::jsonb,
  add column if not exists turn_order jsonb default '[]'::jsonb,
  add column if not exists phase text default 'attack',
  add column if not exists turn_deadline timestamptz,
  add column if not exists winner_id bigint,
  add column if not exists loser_id bigint,
  add column if not exists winner_ids jsonb default '[]'::jsonb,
  add column if not exists first_player_id bigint,
  add column if not exists roulette_started_at timestamptz,
  add column if not exists team_turn_order jsonb default '[]'::jsonb,  -- порядок команд для Синдиката
  add column if not exists current_team_turn int4;                     -- чья очередь команды

-- Индекс для быстрого поиска состояния по столу
create index if not exists game_states_table_id_idx on public.game_states (table_id);

-- ============================================================================
-- RLS (безопасность). Включите RLS и разрешите чтение/запись через anon-ключ.
-- ============================================================================
alter table public.game_states enable row level security;
alter table public.tables enable row level security;
alter table public.table_players enable row level security;
alter table public.users enable row level security;

-- Политики (разрешить всё для anon — подходит для разработки)
drop policy if exists "game_states_all" on public.game_states;
create policy "game_states_all" on public.game_states for all using (true) with check (true);

drop policy if exists "tables_all" on public.tables;
create policy "tables_all" on public.tables for all using (true) with check (true);

drop policy if exists "table_players_all" on public.table_players;
create policy "table_players_all" on public.table_players for all using (true) with check (true);

drop policy if exists "users_all" on public.users;
create policy "users_all" on public.users for all using (true) with check (true);
