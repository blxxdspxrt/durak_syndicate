import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request) {
  try {
    const body = await request.json()
    const { tableId, userId } = body

    if (!tableId || !userId) {
      return NextResponse.json({ error: 'tableId and userId are required' }, { status: 400 })
    }

    const numericUserId = Number(userId)

    // 1. Получаем текущее состояние стола
    const { data: currentTable, error: fetchError } = await supabase
      .from('tables')
      .select('*')
      .eq('id', tableId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!currentTable) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    // 2. Проверяем, сидит ли игрок уже за этим столом
    const { data: existingPlayer } = await supabase
      .from('table_players')
      .select('*')
      .eq('table_id', tableId)
      .eq('user_id', numericUserId)
      .maybeSingle()

    // Если игрок УЖЕ сидит за этим столом — просто возвращаем стол без повторного инсерта
    if (existingPlayer) {
      return NextResponse.json({ table: currentTable })
    }

    // 3. Если места нет
    if (currentTable.current_players >= currentTable.max_players) {
      return NextResponse.json({ error: 'Table is full' }, { status: 400 })
    }

    // 4. Достаем все занятые стулья
    const { data: existingPlayers } = await supabase
      .from('table_players')
      .select('seat_number')
      .eq('table_id', tableId)
      .order('seat_number', { ascending: true })

    const takenSeats = existingPlayers?.map((p) => p.seat_number) || []
    let seatNumber = 1
    while (takenSeats.includes(seatNumber) && seatNumber <= currentTable.max_players) {
      seatNumber++
    }

    let team = 1
    if (currentTable.mode === 'Синдикат') {
      team = seatNumber % 2 === 1 ? 1 : 2
    }

    // 5. Вставляем игрока
    const { error: insertError } = await supabase
      .from('table_players')
      .insert({
        table_id: tableId,
        user_id: numericUserId,
        seat_number: seatNumber,
        team,
      })

    if (insertError) {
      console.error('[TABLE_PLAYERS JOIN INSERT ERROR]:', insertError.message)
      return NextResponse.json({ error: 'Failed to sit down: ' + insertError.message }, { status: 500 })
    }

    // 6. Обновляем количество игроков и статус стола
    const newCount = takenSeats.length + 1
    const newStatus = newCount >= currentTable.max_players ? 'playing' : 'waiting'

    const { data: updatedTable, error: updateError } = await supabase
      .from('tables')
      .update({
        current_players: newCount,
        status: newStatus,
      })
      .eq('id', tableId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ table: updatedTable })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}