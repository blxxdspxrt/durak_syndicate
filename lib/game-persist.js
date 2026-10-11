import { supabaseAdmin } from '@/lib/supabase-admin'
import { reconcileTimeout } from '@/lib/game-engine'
import { settleGame } from '@/lib/game-settle'

// ============================================================================
// ЕДИНАЯ ТОЧКА СОХРАНЕНИЯ ПАРТИИ + «ЛЕНИВАЯ» ПРОВЕРКА ПРОСРОЧКИ.
// ============================================================================
// Сервер НЕ доверяет клиентскому сабмиту таймаута: любой запрос к столу
// (состояние, ход, таймаут) сначала прогоняет reconcileTimeout и, если дедлайн
// уже прошёл, сам применяет авто-действие или AFK-вылет. Даже если клиент
// потерял пакет и не отправил /timeout — партия не зависнет.
// ============================================================================

// Все поля игрового состояния, которые сохраняются в БД.
export const PERSIST_FIELDS = [
  'deck',
  'hands',
  'table_cards',
  'discard',
  'attacker_id',
  'defender_id',
  'phase',
  'status',
  'winner_id',
  'loser_id',
  'winner_ids',
  'loser_ids',
  'turn_deadline',
  'mode',
  'teams',
  'finish_order',
  'placement',
  'even_split',
  'turn_seconds',
  'timeout_streak',
  'afk_ids',
  'folded_ids',
]

// Собираем patch только из тех колонок, что реально есть в БД
// (чтобы код не падал, если миграция ещё не применена).
export function buildGamePatch(newState, template) {
  const patch = { updated_at: new Date().toISOString() }
  for (const field of PERSIST_FIELDS) {
    if (field in template) patch[field] = newState[field]
  }
  return patch
}

/** Сохраняет состояние партии (только существующие колонки). */
export async function persistGameState(tableId, newState, template) {
  const { error } = await supabaseAdmin
    .from('game_states')
    .update(buildGamePatch(newState, template))
    .eq('table_id', tableId)
  if (error) throw error
}

/** Убирает выбывших (AFK) игроков из стола — «кик» из комнаты. */
export async function kickPlayersFromTable(tableId, userIds) {
  for (const uid of userIds) {
    await supabaseAdmin
      .from('table_players')
      .delete()
      .eq('table_id', tableId)
      .eq('user_id', Number(uid))
  }
}

/**
 * «Ленивая» серверная валидация просрочки: если дедлайн прошёл, сервер САМ
 * применяет просрочку (авто-действие или AFK-вылет), сохраняет состояние,
 * кикает выбывших и, если партия завершилась, рассчитывает ставку.
 *
 * @returns {Promise<{ gameState: object, changed: boolean }>}
 */
export async function applyServerTimeout(tableId, gameState) {
  const { state: next, changed } = reconcileTimeout(gameState)
  if (!changed) return { gameState, changed: false }

  await persistGameState(tableId, next, gameState)

  const prevAfk = (gameState.afk_ids || []).map(Number)
  const kicked = (next.afk_ids || []).map(Number).filter((uid) => !prevAfk.includes(uid))
  if (kicked.length) await kickPlayersFromTable(tableId, kicked)

  if (next.status === 'finished') {
    await settleGame(tableId, next)
  }

  return { gameState: next, changed: true }
}
