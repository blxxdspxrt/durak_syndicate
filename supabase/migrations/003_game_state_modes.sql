-- ============================================================================
-- МИГРАЦИЯ 003: режимы игры (подкидной / переводной / синдикат)
-- ============================================================================
-- Для полноценной работы обоих классических режимов и Синдиката (2×2, 2×2×2).
-- ============================================================================

alter table public.game_states
  add column if not exists mode text default 'Классический',
  add column if not exists teams jsonb default '[]'::jsonb,      -- состав команд (по индексу turn_order)
  add column if not exists loser_ids jsonb default '[]'::jsonb,  -- проигравшие (для командного расчёта)
  add column if not exists settled_at timestamptz;               -- когда рассчитана ставка

-- Быстрый поиск незавершённых игр
create index if not exists game_states_status_idx on public.game_states (status);

-- История игр: полезные индексы
create index if not exists game_history_user_idx on public.game_history (user_id);
create index if not exists game_history_created_idx on public.game_history (created_at desc);
