import { supabaseAdmin } from '@/lib/supabase-admin'
import { createNotification } from '@/lib/notify'
import { LEAVE_WINDOW_MS, leaveSanction } from '@/lib/economy'

// ============================================================================
// ШТРАФЫ ЗА ВЫХОД / AFK (единая лестница санкций).
// ============================================================================
// Логика (за 24 часа без нарушений счётчик обнуляется):
//   • первое нарушение В ЖИЗНИ аккаунта  → только предупреждение;
//   • 1-е нарушение в окне              → половина штрафа «последнего места»;
//   • 2-е нарушение                     → полный штраф «последнего места»;
//   • 3-е и далее                       → +15% к штрафу за каждый шаг
//                                          + бан поиска/создания/посадки
//                                          (15 мин, 30 мин, далее ×2).
// В Синдикате вместо ELO меняется Влияние; напарник афкашера невиновен,
// поэтому получает мягкий штраф (в 2×2 — никакого) и часть бай-ина назад.
// ============================================================================

// Лестница санкций (leaveSanction), PARTNER_* и окно 24 часа живут в
// lib/economy.js — чистом модуле без обращения к БД, поэтому покрыты тестами.
// Здесь остаются только операции, которым нужна БД и уведомления.

/** Текст уведомления игроку о санкции. */
export function sanctionMessage({ sanction, bet }) {
  const lines = []
  if (sanction.level === 'warning') {
    lines.push('Вы покинули матч (две просрочки подряд или явный выход).')
    lines.push('Это предупреждение: в следующий раз будет штраф — потеря банка и очков рейтинга.')
    return lines.join('\n')
  }

  lines.push('Вы снова покинули матч во время игры.')
  const parts = []
  if (bet) parts.push(`потеря ставки: ${Number(bet).toLocaleString('ru-RU')} $`)
  if (sanction.elo) parts.push(`ELO: ${sanction.elo}`)
  if (sanction.influence) parts.push(`Влияние: ${sanction.influence}`)
  if (parts.length) lines.push('Штраф: ' + parts.join(', ') + '.')
  if (sanction.banMinutes) {
    lines.push(`Поиск, посадка и создание столов заблокированы на ${sanction.banMinutes} мин.`)
  }
  lines.push('Следующее нарушение приведёт к более строгим санкциям вплоть до блокировки.')
  return lines.join('\n')
}

/** Короткий заголовок уведомления (с указанием величины штрафа). */
export function sanctionLabel(sanction, mode) {
  if (sanction.level === 'warning') return sanction.title
  const metric = mode === 'Синдикат' ? 'Влияние' : 'ELO'
  const value = mode === 'Синдикат' ? sanction.influence : sanction.elo
  return `${sanction.title} (${metric} ${value})`
}

// ---------------------------------------------------------------------------
// Работа с БД
// ---------------------------------------------------------------------------

/** Эффективный счётчик нарушений с учётом окна 24 часа. */
function effectiveStreak(user, now) {
  const last = user?.leave_strikes_at ? new Date(user.leave_strikes_at).getTime() : 0
  if (!last || now - last > LEAVE_WINDOW_MS) return 0
  return Number(user.leave_strikes) || 0
}

/**
 * Применяет санкцию игроку за выход/AFK: обновляет счётчики, бан,
 * пишет уведомление в мини-апп и в личку Telegram.
 *
 * @returns {Promise<{ elo:number, influence:number, banMinutes:number }>}
 */
export async function applyLeaveSanction(userId, { mode, playerCount, syndicateCount, bet }) {
  const uid = Number(userId)
  const now = Date.now()

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('leave_strikes, leave_strikes_at, leave_warned')
    .eq('id', uid)
    .maybeSingle()

  const warned = !!user?.leave_warned
  const streak = warned ? effectiveStreak(user, now) + 1 : 0

  const sanction = leaveSanction({ mode, playerCount, syndicateCount, warned, streak })

  await supabaseAdmin
    .from('users')
    .update({
      leave_strikes: warned ? streak : 0,
      leave_strikes_at: new Date(now).toISOString(),
      leave_warned: true,
      ...(sanction.banMinutes > 0
        ? { banned_until: new Date(now + sanction.banMinutes * 60000).toISOString() }
        : {}),
    })
    .eq('id', uid)

  await createNotification(uid, {
    kind: sanction.level === 'warning' ? 'warning' : 'sanction',
    title: sanctionLabel(sanction, mode),
    body: sanctionMessage({ sanction, bet }),
  })

  return { elo: sanction.elo, influence: sanction.influence, banMinutes: sanction.banMinutes }
}

/** Уведомляет невиновного напарника афкашера. */
export async function notifyPartner(userId, { refund, influence }) {
  const lines = ['Ваш напарник по Синдикату покинул матч — команде засчитано поражение.']
  if (refund > 0) lines.push(`Вам возвращено 75% ставки: ${Number(refund).toLocaleString('ru-RU')} $.`)
  if (influence === 0) lines.push('По очкам Влияния вы не оштрафованы.')
  else lines.push(`Штраф по Влиянию: ${influence} (мягкий, как пострадавшей стороне).`)

  await createNotification(Number(userId), {
    kind: 'sanction',
    title: 'Ваш напарник покинул матч',
    body: lines.join('\n'),
  })
}

/** Проверка бана перед поиском/созданием/посадкой за стол. */
export async function checkBan(userId) {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('banned_until')
    .eq('id', Number(userId))
    .maybeSingle()

  const until = user?.banned_until ? new Date(user.banned_until).getTime() : 0
  if (!until || until <= Date.now()) return null

  const minutes = Math.ceil((until - Date.now()) / 60000)
  return {
    error: `Вы заблокированы за нарушения: поиск и создание столов недоступны ещё ${minutes} мин.`,
    minutes,
  }
}

