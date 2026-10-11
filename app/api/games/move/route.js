import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { applyMove } from '@/lib/game-engine'
import { settleGame } from '@/lib/game-settle'
import { authenticateRequest } from '@/lib/telegram-auth'
import { serializeForViewer } from '@/lib/game-serializer'
import { buildGamePatch, applyServerTimeout } from '@/lib/game-persist'

// POST: обработка хода игрока (attack / defend / transfer / take / bito).
// Вся валидация правил выполняется в game-engine (чистые функции).
export async function POST(request) {
  try {
    const body = await request.json()
    const { tableId, userId, action, card, targetPairIndex, initData } = body

    if (!tableId || !action) {
      return NextResponse.json({ error: 'tableId и action обязательны' }, { status: 400 })
    }

    // 1. Проверяем, что запрос действительно от этого пользователя Telegram
    const auth = authenticateRequest(initData, userId)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    // 2. Текущее состояние игры
    const { data: gameState, error: fetchErr } = await supabaseAdmin
      .from('game_states')
      .select('*')
      .eq('table_id', tableId)
      .maybeSingle()

    if (fetchErr || !gameState) {
      return NextResponse.json({ error: 'Игра не найдена' }, { status: 404 })
    }

    if (gameState.status === 'finished') {
      return NextResponse.json({ error: 'Игра уже завершена' }, { status: 403 })
    }

    // 3. Игрок должен сидеть за этим столом
    const { data: seated } = await supabaseAdmin
      .from('table_players')
      .select('user_id')
      .eq('table_id', tableId)
      .eq('user_id', auth.userId)
      .maybeSingle()

    if (!seated) {
      return NextResponse.json({ error: 'Вы не за этим столом' }, { status: 403 })
    }

    // 4. Сначала «ленивая» проверка просрочки: если время хода уже истекло,
    //    сервер сам применит авто-действие или AFK-вылет.
    const { gameState: fresh } = await applyServerTimeout(tableId, gameState)

    if (fresh.status === 'finished') {
      return NextResponse.json({
        success: true,
        gameState: serializeForViewer(fresh, auth.userId),
        note: 'Партия завершена: время хода истекло',
      })
    }

    // 5. Применяем ход через движок. Движок сам проверяет:
    //    очередь хода, наличие карты в руке, правила атаки/защиты/перевода и т.д.
    const { state: newState, error: moveError } = applyMove(fresh, {
      userId: auth.userId,
      action,
      card,
      targetPairIndex: Number(targetPairIndex) || 0,
    })

    if (moveError) {
      return NextResponse.json({ error: moveError }, { status: 400 })
    }

    // 6. Сохраняем обновлённое состояние
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('game_states')
      .update(buildGamePatch(newState, gameState))
      .eq('table_id', tableId)
      .select()
      .single()

    if (updateErr) throw updateErr

    // 7. Если игра завершена — рассчитываем ставку (защита от двойного начисления в settleGame)
    if (newState.status === 'finished') {
      await settleGame(tableId, newState)
    }

    return NextResponse.json({
      success: true,
      gameState: serializeForViewer(updated, auth.userId),
    })
  } catch (err) {
    console.error('[GAME MOVE ERROR]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
