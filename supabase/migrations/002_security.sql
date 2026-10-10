-- ============================================================================
-- МИГРАЦИЯ 002: БЕЗОПАСНОСТЬ (Row Level Security)
-- ============================================================================
-- ПРИМЕНЯТЬ ПОСЛЕ того, как вы добавили SUPABASE_SERVICE_ROLE_KEY в .env.local
-- и в переменные окружения продакшена.
--
-- Идея: серверные роуты (app/api/**) ходят в БД через ключ service_role,
-- который ОБХОДИТ RLS. Клиент (браузер) использует anon-ключ и получает
-- только то, что разрешено ниже. Карты, колода и руки больше никто, кроме
-- сервера, прочитать не может — читерить через devtools невозможно.
--
-- Запустите этот файл в Supabase → SQL Editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. game_states — СЕКРЕТНО (колода, руки, козырь в закрытую и т.д.)
--    Полностью закрываем для anon/authenticated. Политик нет => доступ запрещён.
-- ----------------------------------------------------------------------------
alter table public.game_states enable row level security;

revoke all on public.game_states from anon, authenticated;
grant all on public.game_states to service_role;

drop policy if exists "game_states_all" on public.game_states;
drop policy if exists "game_states_public_read" on public.game_states;

-- ----------------------------------------------------------------------------
-- 2. users — приватные данные (баланс, elo, influence).
--    Прямой доступ из клиента запрещён полностью; профили отдаёт /api/*.
-- ----------------------------------------------------------------------------
alter table public.users enable row level security;

revoke all on public.users from anon, authenticated;
grant all on public.users to service_role;

drop policy if exists "users_all" on public.users;
drop policy if exists "users_public_read" on public.users;

-- ----------------------------------------------------------------------------
-- 3. game_history — история игр, тоже только через сервер.
-- ----------------------------------------------------------------------------
alter table public.game_history enable row level security;

revoke all on public.game_history from anon, authenticated;
grant all on public.game_history to service_role;

-- ----------------------------------------------------------------------------
-- 4. tables — лобби публично (список столов + realtime), запись только сервер.
-- ----------------------------------------------------------------------------
alter table public.tables enable row level security;

drop policy if exists "tables_all" on public.tables;
drop policy if exists "tables_public_read" on public.tables;
create policy "tables_public_read" on public.tables
  for select to anon, authenticated using (true);

grant select on public.tables to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.tables from anon, authenticated;
grant all on public.tables to service_role;

-- ----------------------------------------------------------------------------
-- 5. table_players — публично только чтение (кто за столом), запись сервер.
-- ----------------------------------------------------------------------------
alter table public.table_players enable row level security;

drop policy if exists "table_players_all" on public.table_players;
drop policy if exists "table_players_public_read" on public.table_players;
create policy "table_players_public_read" on public.table_players
  for select to anon, authenticated using (true);

grant select on public.table_players to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.table_players from anon, authenticated;
grant all on public.table_players to service_role;

-- ----------------------------------------------------------------------------
-- 6. Атомарные операции с балансом (используются сервером при расчёте ставки).
--    SECURITY DEFINER + отзыв EXECUTE у anon => клиент вызвать не сможет.
-- ----------------------------------------------------------------------------
create or replace function public.increment_user_dollars(p_user_id bigint, p_amount bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.users
     set dollars = coalesce(dollars, 0) + p_amount,
         updated_at = now()
   where id = p_user_id;
$$;

create or replace function public.decrement_user_dollars(p_user_id bigint, p_amount bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.users
     set dollars = greatest(0, coalesce(dollars, 0) - p_amount),
         updated_at = now()
   where id = p_user_id;
$$;

revoke all on function public.increment_user_dollars(bigint, bigint) from public, anon, authenticated;
revoke all on function public.decrement_user_dollars(bigint, bigint) from public, anon, authenticated;
grant execute on function public.increment_user_dollars(bigint, bigint) to service_role;
grant execute on function public.decrement_user_dollars(bigint, bigint) to service_role;
