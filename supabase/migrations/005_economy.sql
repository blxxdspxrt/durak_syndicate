-- ============================================================================
-- МИГРАЦИЯ 005: экономика партии (места, поровну, ELO, Влияние)
-- ============================================================================
-- Запустите в Supabase → SQL Editor (после 001–004).
-- ============================================================================

-- Игровое состояние: порядок выхода, раскладка мест и флаг «делим поровну»
alter table public.game_states
  add column if not exists finish_order jsonb default '[]'::jsonb,
  add column if not exists placement jsonb,
  add column if not exists even_split boolean default false;

-- ----------------------------------------------------------------------------
-- Атомарные изменения прогресса игрока (вызываются только сервером).
-- ----------------------------------------------------------------------------
create or replace function public.increment_user_elo(p_user_id bigint, p_amount int)
returns void
language sql
security definer
set search_path = public
as $$
  update public.users
     set elo = greatest(0, coalesce(elo, 1200) + p_amount),
         updated_at = now()
   where id = p_user_id;
$$;

create or replace function public.increment_user_influence(p_user_id bigint, p_amount int)
returns void
language sql
security definer
set search_path = public
as $$
  update public.users
     set influence = coalesce(influence, 0) + p_amount,
         updated_at = now()
   where id = p_user_id;
$$;

revoke all on function public.increment_user_elo(bigint, int) from public, anon, authenticated;
revoke all on function public.increment_user_influence(bigint, int) from public, anon, authenticated;
grant execute on function public.increment_user_elo(bigint, int) to service_role;
grant execute on function public.increment_user_influence(bigint, int) to service_role;

-- История игр: место и участие в раздаче призов
alter table public.game_history
  add column if not exists place int;
