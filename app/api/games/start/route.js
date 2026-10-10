import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { initGameState, MODE_SYNDICATE, MODE_CLASSIC, MODE_TRANSFER } from '@/lib/game-engine'
import { authenticateRequest } from '@/lib/telegram-auth'

// ============================================================================
// POST /api/games/start — старт игры (только создатель стола).
// ============================================================================
// Сервер перемешивает колоду, раздаёт карты и выбирает первого игрока —
// клиент не участвует в раздаче и не может её подделать.
// ============================================================================

const BASE_COLUMNS = ['table_id', 'deck', 'trump_card', 'attacker_id', 'defender_id', 'table_cards', 'hands', 'status', 'updated_at']

const PERSIST_FIELDS = [
  'table_id',
  'mode',
  'teams',
  'deck',
  'trump_card',
  'trump_suit',
  'hands',
  'table_cards',
  'discard',
  'attacker_id',
  'defender_id',
  'turn_order',
  'phase',
  'status',
  'turn_deadline',
  'winner_id',
  'loser_id',
  'winner_ids',
  'loser_ids',
  'updated_at',
  'first_player_id',
  'roulette_started_at',
  'finish_order',
  'placement',
  'even_split',
  'settled_at',
]

function migrationHint(err) {
  const msg = err?.message || ''
  if (/column .* does not exist/i.test(msg) || err?.code === 'PGRST204' || err?.code === '42703') {
    return 'Схема БД устарела. Примените supabase/migrations/001_game_states.sql, 002_security.sql и 003_game_state_modes.sql в Supabase → SQL Editor.'
  }
  return msg
}

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

    // 1. Стол
    const { data: table, error: tableErr } = await supabaseAdmin
      .from('tables')
      .select('*')
      .eq('id', tableId)
      .maybeSingle()

    if (tableErr || !table) {
      return NextResponse.json({ error: 'Стол не найден' }, { status: 404 })
    }

    // 2. Только создатель может начать игру
    if (Number(table.creator_id) !== auth.userId) {
      return NextResponse.json({ error: 'Начать игру может только создатель стола' }, { status: 403 })
    }

    if (table.status === 'playing') {
      return NextResponse.json({ error: 'Игра уже началась' }, { status: 400 })
    }

    // 3. Игроки за столом (по порядку мест)
    const { data: players, error: playersErr } = await supabaseAdmin
      .from('table_players')
      .select('user_id, seat_number, team')
      .eq('table_id', tableId)
      .order('seat_number', { ascending: true })

    if (playersErr || !players || players.length < 2) {
      return NextResponse.json({ error: 'Нужно минимум 2 игрока для старта' }, { status: 400 })
    }

    const mode = table.mode || MODE_TRANSFER
    if (mode === MODE_SYNDICATE && (players.length < 4 || players.length % 2 !== 0)) {
      return NextResponse.json(
        { error: 'Для Синдиката нужно чётное число игроков (4 или 6)' },
        { status: 400 }
      )
    }

    // 4. Рулетка: сервер выбирает первого игрока случайно
    const firstPlayer = players[Math.floor(Math.random() * players.length)]
    const rouletteStartedAt = new Date().toISOString()

    // 5. Инициализируем состояние (команды только для Синдиката)
    const state = initGameState({
      tableId,
      players: players.map((p) => p.user_id),
      deckType: table.deck || '36 карт',
      firstPlayerId: firstPlayer.user_id,
      mode,
      teams: mode === MODE_SYNDICATE ? players.map((p) => p.team) : [],
    })

    const payload = {}
    for (const field of PERSIST_FIELDS) {
      if (field === 'first_player_id') payload[field] = firstPlayer.user_id
      else if (field === 'roulette_started_at') payload[field] = rouletteStartedAt
      else if (field === 'settled_at') payload[field] = null // новая партия — расчёт ещё не сделан
      else payload[field] = state[field]
    }

    let upsertPayload = payload

    let { error: gameErr } = await supabaseAdmin
      .from('game_states')
      .upsert(upsertPayload, { onConflict: 'table_id' })

    // Откат на базовые колонки, если миграции ещё не применены
    if (gameErr) {
      const minimal = {}
      for (const field of BASE_COLUMNS) minimal[field] = payload[field]
      const retry = await supabaseAdmin
        .from('game_states')
        .upsert(minimal, { onConflict: 'table_id' })
      if (retry.error) {
        return NextResponse.json({ error: migrationHint(gameErr) }, { status: 500 })
      }
    }

    // 6. Обновляем статус стола (единый статус «playing»)
    const { data: updatedTable, error: updErr } = await supabaseAdmin
      .from('tables')
      .update({ status: 'playing' })
      .eq('id', tableId)
      .select()
      .single()

    if (updErr) {
      return NextResponse.json({ error: migrationHint(updErr) }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      table: updatedTable,
      firstPlayerId: firstPlayer.user_id,
      rouletteStartedAt,
    })
  } catch (err) {
    console.error('[GAME START CRITICAL ERROR]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
