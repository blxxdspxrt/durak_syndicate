import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { applyMove } from '@/lib/game-engine'
import { settleGame } from '@/lib/game-settle'
import { authenticateRequest } from '@/lib/telegram-auth'
import { serializeForViewer } from '@/lib/game-serializer'

// Поля игрового состояния, которые сохраняются после хода.
const PERSIST_FIELDS = [
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
]

// Собираем patch только из тех колонок, что реально есть в БД
// (чтобы код не падал, если миграция ещё не применена).
function buildUpdate(newState, template) {
  const patch = { updated_at: new Date().toISOString() }
  for (const field of PERSIST_FIELDS) {
    if (field in template) patch[field] = newState[field]
  }
  return patch
}

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

    // 4. Применяем ход через движок. Движок сам проверяет:
    //    очередь хода, наличие карты в руке, правила атаки/защиты/перевода и т.д.
    const { state: newState, error: moveError } = applyMove(gameState, {
      userId: auth.userId,
      action,
      card,
      targetPairIndex: Number(targetPairIndex) || 0,
    })

    if (moveError) {
      return NextResponse.json({ error: moveError }, { status: 400 })
    }

    // 5. Сохраняем обновлённое состояние
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('game_states')
      .update(buildUpdate(newState, gameState))
      .eq('table_id', tableId)
      .select()
      .single()

    if (updateErr) throw updateErr

    // 6. Если игра завершена — рассчитываем ставку (защита от двойного начисления в settleGame)
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
