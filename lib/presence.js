import { supabaseAdmin } from '@/lib/supabase-admin'

// ============================================================================
// ПРИСУТСТВИЕ ИГРОКОВ (мониторинг лобби 24/7)
// ============================================================================
// Игрок считается «за столом», пока клиент шлёт heartbeat не реже, чем раз в
// PRESENCE_STALE_MS. Клиент пингует раз в секунду, поэтому даже если он просто
// закрыл мини-апп (запрос /leave не ушёл) — «призрак» исчезает сам:
//   • у всех в списке игрок пропадает;
//   • у стола −1 участник и −1 в счётчике «Играет»;
//   • стол с 0 игроков самоликвидируется.
// ============================================================================

// Сколько секунд без «пульса» считаются уходом. 20 c: с запасом переживает
// кратковременные сетевые сбои и троттлинг таймеров в фоне, но быстро чистит.
export const PRESENCE_STALE_MS = 20_000

// Новому столу даём время посадить создателя (защита от гонки
// «стол создан → строка игрока ещё не вставлена»).
export const NEW_TABLE_GRACE_MS = 5_000

export const ACTIVE_STATUSES = ['waiting', 'playing', 'in_game']

// Тяжёлую часть чистки троттлим, чтобы частые heartbeat не били по БД.
// Сводка (loadLobby) при этом считается на каждый запрос — она дешёвая.
const SWEEP_THROTTLE_MS = 3000
let lastSweepAt = 0

/** Колонка ещё не создана (миграция 004 не применена)? */
function isMissingColumn(err) {
  const msg = err?.message || ''
  return /column .* does not exist/i.test(msg) || err?.code === '42703' || err?.code === 'PGRST204'
}


/** Обновляет «пульс» игрока за столом. true — если отметка сохранена. */
export async function touchPresence(tableId, userId) {
  const res = await supabaseAdmin
    .from('table_players')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('table_id', tableId)
    .eq('user_id', Number(userId))
  if (!res.error) return true
  // Миграция 004 не применена — «пульс» невозможен, но игрока не выкидываем.
  return isMissingColumn(res.error)
}

/**
 * Сажает игрока за стол, проставляя отметку присутствия.
 * Если миграция 004 ещё не применена — повторяет вставку без last_seen_at.
 */
export async function seatPlayer({ table_id, user_id, seat_number, team }) {
  const base = { table_id, user_id, seat_number, team }
  let res = await supabaseAdmin
    .from('table_players')
    .insert({ ...base, last_seen_at: new Date().toISOString() })
    .select()
    .single()
  if (res.error && isMissingColumn(res.error)) {
    res = await supabaseAdmin.from('table_players').insert(base).select().single()
  }
  return res
}

/**
 * Пересчитывает состав стола из реальных мест.
 * Если игроков не осталось — стол (и его игровое состояние) удаляется.
 * @returns {Promise<number>} сколько игроков осталось
 */
export async function refreshTableCount(tableId) {
  const { data: remain } = await supabaseAdmin
    .from('table_players')
    .select('user_id')
    .eq('table_id', tableId)

  const count = (remain || []).length

  if (count === 0) {
    await supabaseAdmin.from('game_states').delete().eq('table_id', tableId)
    await supabaseAdmin.from('tables').delete().eq('id', tableId)
    return 0
  }

  await supabaseAdmin.from('tables').update({ current_players: count }).eq('id', tableId)
  return count
}

/**
 * Правило «один игрок — один стол»: перед посадкой за новый стол игрок
 * автоматически выходит из всех остальных. Столы, оставшиеся пустыми, — сносим.
 */
export async function evictUserFromOtherTables(userId, exceptTableId = null) {
  const uid = Number(userId)
  const { data: rows } = await supabaseAdmin
    .from('table_players')
    .select('table_id')
    .eq('user_id', uid)

  const targets = (rows || []).filter((r) => r.table_id !== exceptTableId)
  for (const r of targets) {
    await supabaseAdmin.from('table_players').delete().eq('table_id', r.table_id).eq('user_id', uid)
    await refreshTableCount(r.table_id)
  }
  return targets.length
}

/**
 * Обслуживает столы:
 *  • стол без игроков — ликвидируется (вместе с его game_states);
 *  • если владелец ушёл, а игроки остались — права переходят случайному
 *    из оставшихся (стол продолжает жить, следующую игру начнёт новый владелец).
 * Новым столам даём грейс-период, чтобы не тронуть стол в момент создания.
 */
export async function liquidateEmptyTables() {
  const { data: tables, error } = await supabaseAdmin
    .from('tables')
    .select('id, created_at, creator_id')
  if (error || !tables || tables.length === 0) return

  const { data: seated } = await supabaseAdmin.from('table_players').select('table_id, user_id')

  const byTable = new Map()
  for (const r of seated || []) {
    if (!byTable.has(r.table_id)) byTable.set(r.table_id, [])
    byTable.get(r.table_id).push(Number(r.user_id))
  }

  const now = Date.now()
  for (const t of tables) {
    const age = t.created_at ? now - new Date(t.created_at).getTime() : Infinity
    if (age < NEW_TABLE_GRACE_MS) continue

    const members = byTable.get(t.id) || []

    // Никого не осталось — сносим стол
    if (members.length === 0) {
      await supabaseAdmin.from('game_states').delete().eq('table_id', t.id)
      await supabaseAdmin.from('tables').delete().eq('id', t.id)
      continue
    }

    // Владелец ушёл — передаём права случайному оставшемуся игроку
    if (t.creator_id != null && !members.includes(Number(t.creator_id))) {
      const newOwner = members[Math.floor(Math.random() * members.length)]
      await supabaseAdmin.from('tables').update({ creator_id: newOwner }).eq('id', t.id)
    }
  }
}

/**
 * Передаёт владение столом СЛУЧАЙНОМУ игроку из оставшихся.
 * @returns {Promise<number|null>} id нового владельца (null — если выбирать не из кого)
 */
export async function reassignOwner(tableId, excludeUserId = null) {
  const { data: rows } = await supabaseAdmin
    .from('table_players')
    .select('user_id')
    .eq('table_id', tableId)

  const candidates = (rows || [])
    .map((r) => Number(r.user_id))
    .filter((uid) => Number.isFinite(uid) && uid !== Number(excludeUserId))

  if (candidates.length === 0) return null

  const newOwner = candidates[Math.floor(Math.random() * candidates.length)]
  await supabaseAdmin.from('tables').update({ creator_id: newOwner }).eq('id', tableId)
  return newOwner
}

/**
 * Убирает «призраков»: игроков без свежего «пульса» и столы без игроков.
 * Безопасно вызывать часто — тяжёлая часть троттлится.
 */
export async function sweepPresence({ force = false } = {}) {
  const now = Date.now()
  if (!force && now - lastSweepAt < SWEEP_THROTTLE_MS) return false
  lastSweepAt = now

  const nowIso = new Date(now).toISOString()
  const cutoffIso = new Date(now - PRESENCE_STALE_MS).toISOString()

  // 1. Строкам без отметки (до миграции) даём один шанс отметиться.
  const adopt = await supabaseAdmin
    .from('table_players')
    .update({ last_seen_at: nowIso })
    .is('last_seen_at', null)
  if (adopt.error && isMissingColumn(adopt.error)) return false

  // 2. Удаляем тех, кто молчит дольше лимита.
  const dead = await supabaseAdmin
    .from('table_players')
    .delete()
    .lt('last_seen_at', cutoffIso)
    .select('table_id')
  if (dead.error && isMissingColumn(dead.error)) return false

  // 3. Столы без игроков самоликвидируются.
  await liquidateEmptyTables()
  return true
}

/**
 * Реальная сводка по лобби:
 *  • tables — только столы, где реально есть игроки (current_players пересчитан);
 *  • stats.onlinePlayers — число УНИКАЛЬНЫХ игроков, сидящих за активными столами
 *    (а не сумма счётчиков, которая «раздувается» призраками).
 */
export async function loadLobby() {
  const { data: tablesList, error } = await supabaseAdmin
    .from('tables')
    .select('*')
    .in('status', ACTIVE_STATUSES)
    .order('created_at', { ascending: false })

  if (error) throw error

  const tables = tablesList || []
  const activeIds = new Set(tables.map((t) => t.id))

  const { data: seated } = await supabaseAdmin.from('table_players').select('table_id, user_id')

  const counts = new Map()
  const online = new Set()
  for (const row of seated || []) {
    if (!activeIds.has(row.table_id)) continue
    counts.set(row.table_id, (counts.get(row.table_id) || 0) + 1)
    online.add(Number(row.user_id))
  }

  const live = []
  for (const t of tables) {
    const count = counts.get(t.id) || 0
    if (count === 0) continue // «призрачный» стол — не показываем (снесёт sweep)
    if (Number(t.current_players) !== count) {
      await supabaseAdmin.from('tables').update({ current_players: count }).eq('id', t.id)
      t.current_players = count
    }
    live.push(t)
  }

  return {
    tables: live,
    stats: {
      onlinePlayers: online.size,
      activeTables: live.length,
      avgTurn: '30с',
      multiplier: 'x2.4',
    },
  }
}

/** Полный цикл для запросов из лобби: чистка «призраков» + актуальная сводка. */
export async function sweepAndLoadLobby() {
  try {
    await sweepPresence()
  } catch (e) {
    console.warn('[PRESENCE SWEEP WARN]', e.message)
  }
  return loadLobby()
}
