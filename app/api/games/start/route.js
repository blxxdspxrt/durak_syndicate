import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const SUITS = ['s', 'h', 'd', 'c'] // ♠️, ♥️, ♦️, ♣️
const RANKS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

function createDeck() {
  const deck = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}${suit}`, rank, suit })
    }
  }
  // Перемешивание (Fisher-Yates)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

export async function POST(request) {
  try {
    const { tableId, userId } = await request.json()

    // 1. Получаем участников стола
    const { data: players } = await supabase
      .from('table_players')
      .select('user_id, seat_number')
      .eq('table_id', tableId)
      .order('seat_number', { ascending: true })

    if (!players || players.length < 2) {
      return NextResponse.json({ error: 'Недостаточно игроков' }, { status: 400 })
    }

    // 2. Генерируем колоду и раздаём по 6 карт
    let deck = createDeck()
    const hands = {}

    for (const p of players) {
      hands[p.user_id] = deck.splice(0, 6)
    }

    // Козырь — последняя карта в колоде
    const trumpCard = deck[deck.length - 1]
    const attackerId = players[0].user_id
    const defenderId = players[1].user_id

    // 3. Сохраняем состояние игры
    const { error: gameErr } = await supabase.from('game_states').upsert({
      table_id: tableId,
      deck,
      trump_card: trumpCard,
      attacker_id: attackerId,
      defender_id: defenderId,
      table_cards: [],
      hands,
      status: 'playing',
    })

    if (gameErr) throw gameErr

    // 4. Переводим стол в статус 'in_game'
    await supabase.from('tables').update({ status: 'in_game' }).eq('id', tableId)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}