import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authenticateRequest } from '@/lib/telegram-auth'
import { serializeForViewer } from '@/lib/game-serializer'
import { applyServerTimeout } from '@/lib/game-persist'

// ============================================================================
// POST /api/games/timeout — «ускоритель» проверки времени хода.
// ============================================================================
// Клиент лишь СООБЩАЕТ серверу, что пора проверить время. Все решения принимает
// сервер (см. applyServerTimeout → reconcileTimeout): если дедлайн не прошёл —
// ничего не меняется, если прошёл — применяется авто-действие или AFK-вылет.
// Поэтому запрос идемпотентен: его можно слать повторно (ретраи) без риска
// задвоить действие.
// ============================================================================
export async function POST(request) {
  try {
    const body = await request.json()
    const { tableId, userId, initData } = body

    if (!tableId) {
      return NextResponse.json({ error: 'tableId is required' }, { status: 400 })
    }

    const auth = authenticateRequest(initData, userId)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { data: seated } = await supabaseAdmin
      .from('table_players')
      .select('user_id')
      .eq('table_id', tableId)
      .eq('user_id', auth.userId)
      .maybeSingle()

    if (!seated) {
      return NextResponse.json({ error: 'Вы не за этим столом' }, { status: 403 })
    }

    const { data: gameState, error } = await supabaseAdmin
      .from('game_states')
      .select('*')
      .eq('table_id', tableId)
      .maybeSingle()

    if (error || !gameState) {
      return NextResponse.json({ error: 'Игра не найдена' }, { status: 404 })
    }

    if (gameState.status === 'finished') {
      return NextResponse.json({ success: true, skipped: true })
    }

    const { gameState: fresh, changed } = await applyServerTimeout(tableId, gameState)

    return NextResponse.json({
      success: true,
      applied: changed,
      gameState: serializeForViewer(fresh, auth.userId),
    })
  } catch (err) {
    console.error('[GAME TIMEOUT ERROR]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
