import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authenticateRequest } from '@/lib/telegram-auth'
import { refreshTableCount, reassignOwner } from '@/lib/presence'
import { abortGame } from '@/lib/game-engine'
import { settleGame } from '@/lib/game-settle'

// POST /api/tables/leave — выйти из-за стола.
// Флаг isCreator из тела НЕ используется — владелец определяется по creator_id в БД.
//
// Правила:
//  • если выходит игрок, который ещё В ИГРЕ (у него есть карты) — партия
//    досрочно завершается, а он признаётся проигравшим (приз поровну остальным);
//  • если выходит уже победивший наблюдатель — партия продолжается;
//  • владелец ушёл, а игроки остались — права переходят случайному игроку;
//  • владелец был один за столом — стол ликвидируется.
export async function POST(request) {
  try {
    const body = await request.json()
    const { tableId, userId, initData } = body

    const auth = authenticateRequest(initData, userId)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }
    const numericUserId = auth.userId

    if (!tableId) {
      return NextResponse.json({ error: 'tableId is required' }, { status: 400 })
    }

    const { data: currentTable, error: fetchError } = await supabaseAdmin
      .from('tables')
      .select('*')
      .eq('id', tableId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!currentTable) {
      return NextResponse.json({ table: null, deleted: true })
    }

    const isOwner = Number(currentTable.creator_id) === numericUserId

    // 1. Досрочное завершение партии, если выходит «живой» игрок
    const { data: gameState } = await supabaseAdmin
      .from('game_states')
      .select('*')
      .eq('table_id', tableId)
      .maybeSingle()

    let aborted = false
    if (gameState && gameState.status === 'playing') {
      const hand = (gameState.hands || {})[String(numericUserId)] || []
      const inGame = (gameState.turn_order || []).map(Number).includes(numericUserId)

      // Наблюдатель (уже вышел из партии) просто покидает стол — игра идёт дальше.
      if (inGame && hand.length > 0) {
        const { state: abortedState } = abortGame(gameState, { loserIds: [numericUserId] })

        await supabaseAdmin
          .from('game_states')
          .update({
            status: 'finished',
            loser_id: abortedState.loser_id,
            loser_ids: abortedState.loser_ids,
            winner_id: abortedState.winner_id,
            winner_ids: abortedState.winner_ids,
            placement: null,
            even_split: true,
            turn_deadline: null,
            updated_at: new Date().toISOString(),
          })
          .eq('table_id', tableId)

        await settleGame(tableId, abortedState)
        aborted = true
      }
    }

    // 2. Убираем место игрока
    const { error: delPlayerErr } = await supabaseAdmin
      .from('table_players')
      .delete()
      .eq('table_id', tableId)
      .eq('user_id', numericUserId)

    if (delPlayerErr) {
      console.warn('[LEAVE] table_players delete warning:', delPlayerErr.message)
    }

    // 3. Пересчитываем состав. Стол без игроков удаляется целиком.
    const remaining = await refreshTableCount(tableId)
    if (remaining === 0) {
      return NextResponse.json({ table: null, deleted: true })
    }

    // 4. Владелец ушёл → права переходят СЛУЧАЙНОМУ оставшемуся игроку
    let newOwnerId = null
    if (isOwner) {
      newOwnerId = await reassignOwner(tableId, numericUserId)
    }

    // 5. Если партия больше не идёт — стол возвращается в лобби, а оставшиеся
    //    игроки ждут новых участников, чтобы начать следующую игру.
    const gameStillRunning = gameState && gameState.status === 'playing' && !aborted

    let updatedTable = {
      ...currentTable,
      creator_id: newOwnerId != null ? newOwnerId : currentTable.creator_id,
    }

    if (!gameStillRunning) {
      const { data: upd, error: updateError } = await supabaseAdmin
        .from('tables')
        .update({ status: 'waiting' })
        .eq('id', tableId)
        .select()
        .single()

      if (updateError) throw updateError
      updatedTable = upd
    }

    return NextResponse.json({ table: updatedTable, deleted: false, newOwnerId, aborted })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
