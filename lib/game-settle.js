import { supabaseAdmin } from '@/lib/supabase-admin'
import { computeSettlement } from '@/lib/economy'

// ============================================================================
// Расчёт партии: рейк 8%, призовые по местам, ELO и Влияние.
// ============================================================================
// Zero-sum: сколько проигравшие заплатили — столько (за вычетом рейка)
// получили победители; «денег из воздуха» не появляется.
// Идемпотентность: расчёт помечается в game_states.settled_at ОДИН раз
// (атомарный update с условием settled_at is null), поэтому move и timeout
// могут вызывать settleGame параллельно без двойного начисления.
// ============================================================================

/**
 * @param {string} tableId
 * @param {object} state финальное игровое состояние (turn_order, placement, even_split, ...)
 * @returns {Promise<{ settled: boolean, pot?: number, rake?: number, net?: number }>}
 */
export async function settleGame(tableId, state) {
  try {
    if (!state) return { settled: false }

    const { data: table } = await supabaseAdmin
      .from('tables')
      .select('id, bet')
      .eq('id', tableId)
      .maybeSingle()

    if (!table) return { settled: false }

    // Идемпотентность: расчёт «занимается» ровно один раз.
    const claimed = await claimSettlement(tableId)
    if (!claimed) return { settled: false }

    const { pot, rake, net, results } = computeSettlement(state, table.bet)
    if (results.length === 0) return { settled: false }

    await Promise.all(results.map((r) => applyProgress(r)))

    await recordHistory(state, results)

    // Партия окончена — стол возвращается в лобби: оставшиеся игроки ждут
    // новых участников, а владелец может начать следующую игру.
    await supabaseAdmin.from('tables').update({ status: 'waiting' }).eq('id', tableId)

    return { settled: true, pot, rake, net, results }
  } catch (e) {
    console.error('[SETTLE GAME ERROR]', e.message)
    return { settled: false }
  }
}

/**
 * Атомарно «занимает» расчёт партии. true — мы первые (значит начисляем призы).
 * Основной путь — game_states.settled_at; откат на пометку стола, если
 * миграция 003 не применена.
 */
async function claimSettlement(tableId) {
  const claim = await supabaseAdmin
    .from('game_states')
    .update({ settled_at: new Date().toISOString() })
    .eq('table_id', tableId)
    .is('settled_at', null)
    .select('table_id')

  if (!claim.error) return Array.isArray(claim.data) && claim.data.length > 0

  const fallback = await supabaseAdmin
    .from('tables')
    .update({ status: 'finished' })
    .eq('id', tableId)
    .neq('status', 'finished')
    .select('id')

  return Array.isArray(fallback.data) && fallback.data.length > 0
}

/** Применяет к игроку весь результат партии: деньги, ELO, Влияние. */
async function applyProgress(r) {
  const jobs = [applyDollars(r.userId, r.dollars)]
  if (r.elo) jobs.push(applyElo(r.userId, r.elo))
  if (r.influence) jobs.push(applyInfluence(r.userId, r.influence))
  await Promise.all(jobs)
}

// Деньги: прибавить или списать (атомарно через SQL-функции из 002).
async function applyDollars(userId, delta) {
  const amount = Math.round(Number(delta) || 0)
  if (amount === 0) return

  const fn = amount > 0 ? 'increment_user_dollars' : 'decrement_user_dollars'
  const { error } = await supabaseAdmin.rpc(fn, { p_user_id: userId, p_amount: Math.abs(amount) })
  if (!error) return

  // Откат на чтение/запись, если RPC ещё не создан в БД
  const { data: u } = await supabaseAdmin.from('users').select('dollars').eq('id', userId).maybeSingle()
  if (!u) return
  await supabaseAdmin
    .from('users')
    .update({
      dollars: Math.max(0, (Number(u.dollars) || 0) + amount),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
}

// ELO: не опускается ниже нуля.
async function applyElo(userId, delta) {
  const amount = Math.round(Number(delta) || 0)
  if (amount === 0) return

  const { error } = await supabaseAdmin.rpc('increment_user_elo', {
    p_user_id: userId,
    p_amount: amount,
  })
  if (!error) return

  const { data: u } = await supabaseAdmin.from('users').select('elo').eq('id', userId).maybeSingle()
  if (!u) return
  await supabaseAdmin
    .from('users')
    .update({
      elo: Math.max(0, (Number(u.elo) || 1200) + amount),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
}

// Влияние (награда Синдиката).
async function applyInfluence(userId, delta) {
  const amount = Math.round(Number(delta) || 0)
  if (amount === 0) return

  const { error } = await supabaseAdmin.rpc('increment_user_influence', {
    p_user_id: userId,
    p_amount: amount,
  })
  if (!error) return

  const { data: u } = await supabaseAdmin.from('users').select('influence').eq('id', userId).maybeSingle()
  if (!u) return
  await supabaseAdmin
    .from('users')
    .update({
      influence: (Number(u.influence) || 0) + amount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
}

// Пишет строку в game_history для каждого участника (только через сервер).
async function recordHistory(state, results) {
  try {
    const mode = state.mode || 'Классический'
    const rows = results.map((r) => ({
      user_id: r.userId,
      mode,
      result: r.result,
      amount: r.dollars,
      elo_change: r.elo || 0,
    }))
    if (rows.length === 0) return

    // Колонка place добавляется миграцией 005 — при её отсутствии
    // повторяем вставку без места.
    const withPlace = await supabaseAdmin
      .from('game_history')
      .insert(rows.map((row, i) => ({ ...row, place: results[i].place })))

    if (withPlace.error) {
      const retry = await supabaseAdmin.from('game_history').insert(rows)
      if (retry.error) console.warn('[GAME HISTORY INSERT WARN]', retry.error.message)
    }
  } catch (e) {
    console.warn('[GAME HISTORY ERROR]', e.message)
  }
}

