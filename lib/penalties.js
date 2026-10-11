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

// ============================================================================
// РЕЖИМЫ: у Классики и Синдиката СВОИ нарушения, очки и баны.
// ============================================================================
// Классической (подкидной/переводной) игре соответствует ключ 'classic',
// Синдикату — 'syndicate'. Данные лежат в users.penalties (jsonb).
// ============================================================================

const MODE_META = {
  classic: { label: 'Классика', metric: 'ELO' },
  syndicate: { label: 'Синдикат', metric: 'Влияние' },
}

/** Ключ режима по названию игры ('Синдикат' | 'Классический' | 'Переводной'). */
export function modeKey(mode) {
  return mode === 'Синдикат' ? 'syndicate' : 'classic'
}

/** Человекочитаемое название режима для уведомлений. */
export function modeLabel(mode) {
  return MODE_META[modeKey(mode)].label
}

/** Текст уведомления игроку о санкции (с указанием, ГДЕ он наказан). */
export function sanctionMessage({ sanction, bet, label }) {
  const lines = [`Режим: «${label}».`]

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
    lines.push(
      `Поиск, посадка и создание столов в режиме «${label}» заблокированы на ${sanction.banMinutes} мин.`
    )
  }
  lines.push(
    `Следующее нарушение в режиме «${label}» приведёт к более строгим санкциям вплоть до блокировки.`
  )
  return lines.join('\n')
}

/** Короткий заголовок уведомления (режим + величина штрафа). */
export function sanctionLabel(sanction, mode) {
  const key = modeKey(mode)
  const label = MODE_META[key].label
  if (sanction.level === 'warning') return `${sanction.title} — «${label}»`

  const metric = MODE_META[key].metric
  const value = metric === 'Влияние' ? sanction.influence : sanction.elo
  return `${sanction.title}: «${label}», ${metric} ${value}`
}

// ---------------------------------------------------------------------------
// Работа с БД
// ---------------------------------------------------------------------------

/** Данные режима из users.penalties (jsonb). */
function readModePenalty(penalties, key) {
  const raw = penalties && typeof penalties === 'object' ? penalties[key] : null
  return {
    strikes: Number(raw?.strikes) || 0,
    at: raw?.at ? new Date(raw.at).getTime() : 0,
    warned: !!raw?.warned,
    bannedUntil: raw?.bannedUntil ? new Date(raw.bannedUntil).getTime() : 0,
  }
}

/**
 * Применяет санкцию игроку за выход/AFK В КОНКРЕТНОМ РЕЖИМЕ: обновляет его
 * счётчики и бан, пишет уведомление в мини-апп и в личку Telegram.
 *
 * @returns {Promise<{ elo:number, influence:number, banMinutes:number }>}
 */
export async function applyLeaveSanction(userId, { mode, playerCount, syndicateCount, bet }) {
  const uid = Number(userId)
  const now = Date.now()
  const key = modeKey(mode)
  const label = MODE_META[key].label

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('penalties')
    .eq('id', uid)
    .maybeSingle()

  const penalties = user?.penalties && typeof user.penalties === 'object' ? { ...user.penalties } : {}
  const prev = readModePenalty(penalties, key)

  // Счётчик нарушений В ЭТОМ РЕЖИМЕ; окно 24 часа без нарушений обнуляет его
  const inWindow = prev.at && now - prev.at <= LEAVE_WINDOW_MS
  const streak = prev.warned ? (inWindow ? prev.strikes + 1 : 1) : 0

  const sanction = leaveSanction({ mode, playerCount, syndicateCount, warned: prev.warned, streak })

  // Ранее выданный бан не стираем, если нового нет
  const bannedUntil = sanction.banMinutes > 0 ? now + sanction.banMinutes * 60000 : prev.bannedUntil

  penalties[key] = { strikes: prev.warned ? streak : 0, at: now, warned: true, bannedUntil }

  const { error: saveError } = await supabaseAdmin.from('users').update({ penalties }).eq('id', uid)
  if (saveError) console.warn('[PENALTY SAVE WARN]', saveError.message)

  await createNotification(uid, {
    kind: sanction.level === 'warning' ? 'warning' : 'sanction',
    title: sanctionLabel(sanction, mode),
    body: sanctionMessage({ sanction, bet, label }),
  })

  return { elo: sanction.elo, influence: sanction.influence, banMinutes: sanction.banMinutes }
}

/** Уведомляет невиновного напарника афкашера (режим Синдикат). */
export async function notifyPartner(userId, { refund, influence }) {
  const lines = ['Ваш напарник по Синдикату покинул матч — команде засчитано поражение.']
  if (refund > 0) lines.push(`Вам возвращено 75% ставки: ${Number(refund).toLocaleString('ru-RU')} $.`)
  if (influence === 0) lines.push('По очкам Влияния вы не оштрафованы.')
  else lines.push(`Штраф по Влиянию: ${influence} (мягкий, как пострадавшей стороне).`)

  await createNotification(Number(userId), {
    kind: 'sanction',
    title: 'Ваш напарник покинул матч («Синдикат»)',
    body: lines.join('\n'),
  })
}

/**
 * Проверка бана перед поиском/созданием/посадкой за стол.
 * Бан у каждого режима СВОЙ: провинившийся в Синдикате сможет играть Классику.
 */
export async function checkBan(userId, mode) {
  const key = modeKey(mode)
  const label = MODE_META[key].label

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('penalties')
    .eq('id', Number(userId))
    .maybeSingle()

  const p = readModePenalty(user?.penalties, key)
  if (!p.bannedUntil || p.bannedUntil <= Date.now()) return null

  const minutes = Math.ceil((p.bannedUntil - Date.now()) / 60000)
  return {
    error: `Вы заблокированы за нарушения в режиме «${label}»: поиск и создание столов недоступны ещё ${minutes} мин.`,
    minutes,
    mode: key,
  }
}

