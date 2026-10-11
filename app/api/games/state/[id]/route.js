import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authenticateRequest } from '@/lib/telegram-auth'
import { serializeForViewer } from '@/lib/game-serializer'
import { applyServerTimeout } from '@/lib/game-persist'

// ============================================================================
// GET /api/games/state/:id?userId=<id>&initData=<telegram initData>
// ============================================================================
// Отдаёт игровое состояние игроку, сидящему за столом, СКРЫВАЯ секретные данные:
//   • колода — только количество (deck_count), порядок карт не покидает сервер;
//   • руки других игроков — только количество карт.
// Перед отдачей выполняется «ленивая» проверка просрочки: если время хода
// вышло, сервер сам применит авто-действие/AFK-вылет и только потом ответит.
// Это делает партию устойчивой к потерянным пакетам на мобильной сети.
// ============================================================================

export async function GET(request, context) {
  try {
    const params = await context.params
    const tableId = params?.id
    const { searchParams } = new URL(request.url)
    const initData = searchParams.get('initData') || ''
    const fallbackUserId = searchParams.get('userId')

    if (!tableId) {
      return NextResponse.json({ error: 'tableId is required' }, { status: 400 })
    }

    const auth = authenticateRequest(initData, fallbackUserId)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    // Состояние видят только игроки за этим столом
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

    if (error) throw error
    if (!gameState) return NextResponse.json({ gameState: null })

    // «Ленивая» проверка просрочки: сервер сам применит таймаут, если время вышло
    const { gameState: fresh } = await applyServerTimeout(tableId, gameState)

    return NextResponse.json({ gameState: serializeForViewer(fresh, auth.userId) })
  } catch (err) {
    console.error('[GAME STATE ERROR]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
