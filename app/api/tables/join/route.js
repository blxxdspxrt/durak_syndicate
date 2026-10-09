import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request) {
  try {
    const body = await request.json()
    const { tableId, userId } = body

    if (!tableId || !userId) {
      return NextResponse.json({ error: 'tableId and userId are required' }, { status: 400 })
    }

    const { data: currentTable, error: fetchError } = await supabase
      .from('tables')
      .select('*')
      .eq('id', tableId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!currentTable) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    if (currentTable.current_players >= currentTable.max_players) {
      return NextResponse.json({ error: 'Table is full' }, { status: 400 })
    }

    const newCount = currentTable.current_players + 1
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

    try {
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

      await supabase
        .from('table_players')
        .insert({
          table_id: tableId,
          user_id: userId,
          seat_number: seatNumber,
          team,
        })
    } catch (tpErr) {
      console.warn('table_players insert skipped:', tpErr.message)
    }

    return NextResponse.json({ table: updatedTable })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
