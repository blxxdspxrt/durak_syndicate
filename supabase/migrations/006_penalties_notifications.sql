-- ============================================================================
-- МИГРАЦИЯ 006: динамический таймер, AFK-вылеты, штрафы и уведомления
-- ============================================================================
-- Запустите в Supabase → SQL Editor (после 001–005).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. game_states: таймер из конфига стола, счётчик просрочек, выбывшие
-- ----------------------------------------------------------------------------
alter table public.game_states
  add column if not exists turn_seconds int default 30,
  -- сколько просрочек ПОДРЯД у каждого игрока: {"123": 1}
  add column if not exists timeout_streak jsonb default '{}'::jsonb,
  -- игроки, вылетевшие за 2 просрочки подряд (бай-ин сгорает)
  add column if not exists afk_ids jsonb default '[]'::jsonb,
  -- напарники по Синдикату, выбывшие вместе с афкашером (мягкий штраф)
  add column if not exists folded_ids jsonb default '[]'::jsonb;

-- ----------------------------------------------------------------------------
-- 2. users: история нарушений и бан на поиск/создание/посадку
-- ----------------------------------------------------------------------------
alter table public.users
  add column if not exists leave_strikes int default 0,        -- нарушений в текущем окне
  add column if not exists leave_strikes_at timestamptz,       -- когда было последнее
  add column if not exists leave_warned boolean default false, -- выдано ли «первое в жизни» предупреждение
  add column if not exists banned_until timestamptz;           -- до какого времени нельзя искать столы

create index if not exists users_banned_until_idx on public.users (banned_until);

-- ----------------------------------------------------------------------------
-- 3. notifications: уведомления в мини-апп (живут, пока игрок не удалит)
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id bigserial primary key,
  user_id bigint not null,
  kind text not null default 'system',   -- warning | sanction | system
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant all on public.notifications to service_role;
