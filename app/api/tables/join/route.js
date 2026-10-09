import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request) {
  try {
    const body = await request.json()
    const { tableId, userId } = body

    console.log('[JOIN ATTEMPT]', { tableId, userId })

    if (!tableId || !userId || Number(userId) === 0) {
      console.error('[JOIN ERROR] Invalid parameters:', { tableId, userId })
      return NextResponse.json({ error: 'Valid tableId and userId are required' }, { status: 400 })
    }

    const numericUserId = Number(userId)

    // 1. Проверяем существование пользователя в базе
    const { data: dbUser, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('id', numericUserId)
      .maybeSingle()

    if (userErr || !dbUser) {
      console.error('[JOIN ERROR] User not found in DB:', numericUserId)
      return NextResponse.json({ error: 'User does not exist in DB' }, { status: 400 })
    }

    // 2. Получаем стол
    const { data: currentTable, error: fetchError } = await supabase
      .from('tables')
      .select('*')
      .eq('id', tableId)
      .maybeSingle()

    if (fetchError || !currentTable) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    // 3. Проверяем, сидит ли уже игрок
    const { data: existingPlayer } = await supabase
      .from('table_players')
      .select('*')
      .eq('table_id', tableId)
      .eq('user_id', numericUserId)
      .maybeSingle()

    if (existingPlayer) {
      console.log('[JOIN INFO] User already seated:', numericUserId)
      return NextResponse.json({ table: currentTable })
    }

    // 4. Находим свободное место
    const { data: existingPlayers } = await supabase
      .from('table_players')
      .select('seat_number')
      .eq('table_id', tableId)

    const takenSeats = (existingPlayers || []).map((p) => p.seat_number)
    let seatNumber = 1
    while (takenSeats.includes(seatNumber) && seatNumber <= currentTable.max_players) {
      seatNumber++
    }

    let team = 1
    if (currentTable.mode === 'Синдикат') {
      team = seatNumber % 2 === 1 ? 1 : 2
    }

    // 5. Вставляем в table_players
    const { data: insertedPlayer, error: insertError } = await supabase
      .from('table_players')
      .insert({
        table_id: tableId,
        user_id: numericUserId,
        seat_number: seatNumber,
        team,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[JOIN INSERT ERROR TO TABLE_PLAYERS]:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    console.log('[JOIN SUCCESS] Player seated:', insertedPlayer)

    // 6. Обновляем счётчик в tables
    const newCount = takenSeats.length + 1
    const { data: updatedTable } = await supabase
      .from('tables')
      .update({
        current_players: newCount,
        status: newCount >= currentTable.max_players ? 'playing' : 'waiting',
      })
      .eq('id', tableId)
      .select()
      .single()

    return NextResponse.json({ table: updatedTable })
  } catch (err) {
    console.error('[JOIN CRITICAL ERROR]:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}