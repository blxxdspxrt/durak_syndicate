-- ============================================================================
-- МИГРАЦИЯ 007: РАЗДЕЛЬНЫЕ НАРУШЕНИЯ И БАНЫ ПО РЕЖИМАМ
-- ============================================================================
-- Раньше (006) счётчик нарушений был общим: провинился в Синдикате — не мог
-- играть и в Классике. Теперь у каждого режима своя история, свои штрафные
-- очки и свой бан.
--
-- Храним в одном jsonb-столбце, чтобы не плодить колонки:
--   {
--     "classic":   { "strikes": 2, "at": "2026-…", "warned": true, "bannedUntil": null },
--     "syndicate": { "strikes": 0, "at": null,     "warned": false, "bannedUntil": null }
--   }
-- ============================================================================

alter table public.users
  add column if not exists penalties jsonb default '{}'::jsonb;

-- Переносим уже накопленное (006) в раздел «Классика»
update public.users
   set penalties = jsonb_build_object(
     'classic',
     jsonb_build_object(
       'strikes', coalesce(leave_strikes, 0),
       'at', leave_strikes_at,
       'warned', coalesce(leave_warned, false),
       'bannedUntil', banned_until
     )
   )
 where coalesce(leave_warned, false) = true
    or coalesce(leave_strikes, 0) > 0
    or banned_until is not null;

-- ВАЖНО: столбцы leave_strikes / leave_strikes_at / leave_warned / banned_until
-- из миграции 006 больше кодом не используются — оставлены только как история.
