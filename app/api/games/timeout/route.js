import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { applyTimeout } from '@/lib/game-engine'
import { settleGame } from '@/lib/game-settle'
import { authenticateRequest } from '@/lib/telegram-auth'
import { serializeForViewer } from '@/lib/game-serializer'

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
]

function buildUpdate(newState, template) {
  const patch = { updated_at: new Date().toISOString() }
  for (const field of PERSIST_FIELDS) {
    if (field in template) patch[field] = newState[field]
  }
  return patch
}

// POST: проверка таймера хода. Вызывается только игроком за столом.
// Если время вышло — применяется авто-действие и, при завершении, расчёт ставки.
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

    const deadline = gameState.turn_deadline ? new Date(gameState.turn_deadline).getTime() : 0
    if (!deadline || Date.now() < deadline) {
      return NextResponse.json({ success: true, skipped: true })
    }

    // Время вышло — применяем авто-действие
    const { state: newState } = applyTimeout(gameState)

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('game_states')
      .update(buildUpdate(newState, gameState))
      .eq('table_id', tableId)
      .select()
      .single()

    if (updErr) throw updErr

    if (newState.status === 'finished') {
      await settleGame(tableId, newState)
    }

    return NextResponse.json({
      success: true,
      gameState: serializeForViewer(updated, auth.userId),
    })
  } catch (err) {
    console.error('[GAME TIMEOUT ERROR]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
