import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authenticateRequest } from '@/lib/telegram-auth'
import { refreshTableCount, reassignOwner } from '@/lib/presence'
import { forceAfk } from '@/lib/game-engine'
import { persistGameState } from '@/lib/game-persist'
import { settleGame } from '@/lib/game-settle'

// POST /api/tables/leave — выйти из-за стола.
// Флаг isCreator из тела НЕ используется — владелец определяется по creator_id в БД.
//
// Правила:
//  • явный выход во время партии ПРИРАВНЕН к AFK-вылету (2 просрочки): карты в
//    отбой, бай-ин сгорает, штраф по лестнице санкций, остальные доигрывают
//    (в 1v1 и 2×2 партия завершается сразу);
//  • выход уже победившего наблюдателя партию не завершает;
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

    // 1. Явный выход во время партии = AFK-вылет (та же лестница санкций)
    const { data: gameState } = await supabaseAdmin
      .from('game_states')
      .select('*')
      .eq('table_id', tableId)
      .maybeSingle()

    let afk = false
    let gameStatus = gameState?.status || null

    if (gameState && gameState.status === 'playing') {
      const hand = (gameState.hands || {})[String(numericUserId)] || []
      const inGame = (gameState.turn_order || []).map(Number).includes(numericUserId)
      const alreadyOut = [...(gameState.afk_ids || []), ...(gameState.folded_ids || [])]
        .map(Number)
        .includes(numericUserId)

      // Наблюдатель (уже вышел из партии) просто покидает стол — игра идёт дальше.
      if (inGame && hand.length > 0 && !alreadyOut) {
        const { state: afkState } = forceAfk(gameState, numericUserId)

        await persistGameState(tableId, afkState, gameState)

        if (afkState.status === 'finished') await settleGame(tableId, afkState)

        gameStatus = afkState.status
        afk = true
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
    const gameStillRunning = gameStatus === 'playing'

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

    return NextResponse.json({ table: updatedTable, deleted: false, newOwnerId, afk })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
