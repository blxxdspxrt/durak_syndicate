import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const SUITS = ['s', 'h', 'd', 'c']
const RANKS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

function createDeck() {
  const deck = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}${suit}`, rank, suit })
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

export async function POST(request) {
  try {
    const { tableId, userId } = await request.json()

    if (!tableId) {
      return NextResponse.json({ error: 'tableId is required' }, { status: 400 })
    }

    // 1. Достаем всех игроков за столом
    const { data: players, error: playersErr } = await supabase
      .from('table_players')
      .select('user_id, seat_number')
      .eq('table_id', tableId)
      .order('seat_number', { ascending: true })

    if (playersErr || !players || players.length < 2) {
      return NextResponse.json({ error: 'Нужно минимум 2 игрока для старта' }, { status: 400 })
    }

    // 2. Генерируем колоду и раздаем по 6 карт
    let deck = createDeck()
    const hands = {}

    for (const p of players) {
      hands[p.user_id] = deck.splice(0, 6)
    }

    const trumpCard = deck[deck.length - 1]
    const attackerId = players[0].user_id
    const defenderId = players[1].user_id

    // 3. Создаем или обновляем состояние игры
    const { error: gameErr } = await supabase.from('game_states').upsert({
      table_id: tableId,
      deck,
      trump_card: trumpCard,
      attacker_id: attackerId,
      defender_id: defenderId,
      table_cards: [],
      hands,
      status: 'playing',
      updated_at: new Date().toISOString(),
    })

    if (gameErr) {
      console.error('[GAME START UPSERT ERROR]', gameErr)
      return NextResponse.json({ error: gameErr.message }, { status: 500 })
    }

    // 4. Обновляем статус стола
    const { data: updatedTable, error: tableErr } = await supabase
      .from('tables')
      .update({ status: 'in_game' })
      .eq('id', tableId)
      .select()
      .single()

    if (tableErr) {
      console.error('[TABLE UPDATE ERROR]', tableErr)
      return NextResponse.json({ error: tableErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, table: updatedTable })
  } catch (err) {
    console.error('[GAME START CRITICAL ERROR]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}