import { supabaseAdmin } from '@/lib/supabase-admin'

// ============================================================================
// Расчёт ставки по итогам игры (zero-sum: сколько проигравшие заплатили —
// столько победители и получили; «денег из воздуха» не появляется).
// ============================================================================
// Защищает от двойного начисления: стол переводится в статус 'finished'
// только один раз (атомарный update с условием status <> 'finished').
// ============================================================================

/**
 * @param {string} tableId
 * @param {object} state финальное игровое состояние (winner_ids, loser_id, loser_ids)
 * @returns {Promise<{ settled: boolean, pot?: number, share?: number }>}
 */
export async function settleGame(tableId, state) {
  try {
    const { data: table } = await supabaseAdmin
      .from('tables')
      .select('id, bet, status')
      .eq('id', tableId)
      .maybeSingle()

    if (!table) return { settled: false }

    const winners = (state.winner_ids || []).map(Number).filter(Boolean)
    const losers =
      (state.loser_ids && state.loser_ids.length
        ? state.loser_ids
        : state.loser_id
        ? [state.loser_id]
        : []
      )
        .map(Number)
        .filter(Boolean)

    if (winners.length === 0 || losers.length === 0) {
      return { settled: false }
    }

    // Атомарно помечаем стол завершённым. Если уже завершён — выходим,
    // чтобы не начислить выигрыш повторно (move и timeout могут гонять).
    const { data: finishedRows } = await supabaseAdmin
      .from('tables')
      .update({ status: 'finished' })
      .eq('id', tableId)
      .neq('status', 'finished')
      .select('id')

    if (!finishedRows || finishedRows.length === 0) {
      return { settled: false }
    }

    const bet = Number(table.bet) || 0
    if (bet <= 0) return { settled: false }

    const pot = bet * losers.length
    const share = Math.floor(pot / winners.length)
    if (share <= 0) return { settled: false }

    await Promise.all([
      ...winners.map((uid) => creditUser(uid, share)),
      ...losers.map((uid) => debitUser(uid, bet)),
    ])

    await recordHistory(state, winners, losers, bet, share)

    return { settled: true, pot, share }
  } catch (e) {
    console.error('[SETTLE GAME ERROR]', e.message)
    return { settled: false }
  }
}

// Прибавляет сумму к балансу (атомарно через SQL-функцию increment).
async function creditUser(userId, amount) {
  const { error } = await supabaseAdmin.rpc('increment_user_dollars', {
    p_user_id: userId,
    p_amount: amount,
  })
  if (error) {
    // Откат на чтение/запись, если RPC ещё не создан в БД
    const { data: u } = await supabaseAdmin.from('users').select('dollars').eq('id', userId).maybeSingle()
    if (u) {
      await supabaseAdmin
        .from('users')
        .update({ dollars: (Number(u.dollars) || 0) + amount, updated_at: new Date().toISOString() })
        .eq('id', userId)
    }
  }
}

// Списывает сумму, но не ниже нуля.
async function debitUser(userId, amount) {
  const { error } = await supabaseAdmin.rpc('decrement_user_dollars', {
    p_user_id: userId,
    p_amount: amount,
  })
  if (error) {
    const { data: u } = await supabaseAdmin.from('users').select('dollars').eq('id', userId).maybeSingle()
    if (u) {
      await supabaseAdmin
        .from('users')
        .update({
          dollars: Math.max(0, (Number(u.dollars) || 0) - amount),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
    }
  }
}

// Пишет строку в game_history для каждого участника (только через сервер).
async function recordHistory(state, winners, losers, bet, share) {
  try {
    const mode = state.mode || 'Классический'
    const rows = [
      ...winners.map((uid) => ({
        user_id: uid,
        mode,
        result: 'win',
        amount: share,
        elo_change: 0,
      })),
      ...losers.map((uid) => ({
        user_id: uid,
        mode,
        result: 'lose',
        amount: -bet,
        elo_change: 0,
      })),
    ]
    if (rows.length === 0) return
    const { error } = await supabaseAdmin.from('game_history').insert(rows)
    if (error) console.warn('[GAME HISTORY INSERT WARN]', error.message)
  } catch (e) {
    console.warn('[GAME HISTORY ERROR]', e.message)
  }
}

