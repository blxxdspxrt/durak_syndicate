import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request) {
  try {
    const { tableId, userId, action, card, targetPairIndex } = await request.json()

    // 1. Получаем текущее состояние игры
    const { data: gameState, error: fetchErr } = await supabase
      .from('game_states')
      .select('*')
      .eq('table_id', tableId)
      .single()

    if (fetchErr || !gameState) {
      return NextResponse.json({ error: 'Игра не найдена' }, { status: 404 })
    }

    let { hands, table_cards, attacker_id, defender_id, deck, trump_card } = gameState
    const userHand = hands[userId] || []

    // -------------------------------------------------------------
    // СЦЕНАРИЙ 1: АТАКА / ПОДКИДЫВАНИЕ (ATTACK)
    // -------------------------------------------------------------
    if (action === 'attack') {
      if (userId !== attacker_id) {
        // Проверка: подкидывать могут только атакующие
        return NextResponse.json({ error: 'Сейчас не ваш ход атаки' }, { status: 400 })
      }

      // Удаляем карту из руки игрока
      const updatedHand = userHand.filter((c) => c.id !== card.id)
      hands[userId] = updatedHand

      // Добавляем карту на стол
      table_cards.push({ attack: card, defend: null })
    }

    // -------------------------------------------------------------
    // СЦЕНАРИЙ 2: ЗАЩИТА / БИТЬЕ КАРТЫ (DEFEND)
    // -------------------------------------------------------------
    else if (action === 'defend') {
      if (userId !== defender_id) {
        return NextResponse.json({ error: 'Вы не защищающийся игрок' }, { status: 400 })
      }

      // Удаляем карту из руки
      const updatedHand = userHand.filter((c) => c.id !== card.id)
      hands[userId] = updatedHand

      // Закрываем атаку карту в паре
      if (table_cards[targetPairIndex]) {
        table_cards[targetPairIndex].defend = card
      }
    }

    // -------------------------------------------------------------
    // СЦЕНАРИЙ 3: ВЗЯТЬ КАРТЫ (TAKE)
    // -------------------------------------------------------------
    else if (action === 'take') {
      if (userId !== defender_id) {
        return NextResponse.json({ error: 'Забрать карты может только защищающийся' }, { status: 400 })
      }

      // Забираем все карты со стола себе в руку
      const cardsOnTable = table_cards.flatMap((p) => [p.attack, p.defend].filter(Boolean))
      hands[userId] = [...userHand, ...cardsOnTable]
      table_cards = []
    }

    // -------------------------------------------------------------
    // СЦЕНАРИЙ 4: БИТО (BITO)
    // -------------------------------------------------------------
    else if (action === 'bito') {
      table_cards = []
      // Очищаем стол и добираем карты из колоды до 6 всем игрокам
      // (Логика добора из deck...)
    }

    // 2. Сохраняем обновленное состояние в Supabase
    const { data: updatedGameState, error: updateErr } = await supabase
      .from('game_states')
      .update({
        hands,
        table_cards,
        updated_at: new Date().toISOString(),
      })
      .eq('table_id', tableId)
      .select()
      .single()

    if (updateErr) throw updateErr

    return NextResponse.json({ success: true, gameState: updatedGameState })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}