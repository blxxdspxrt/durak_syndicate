import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request) {
  try {
    const body = await request.json()
    const { tableId, userId, isCreator } = body

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

    try {
      await supabase
        .from('table_players')
        .delete()
        .eq('table_id', tableId)
        .eq('user_id', userId)
    } catch (tpErr) {
      console.warn('table_players delete skipped:', tpErr.message)
    }

    if (isCreator || currentTable.current_players <= 1) {
      const { error: deleteError } = await supabase
        .from('tables')
        .delete()
        .eq('id', tableId)

      if (deleteError) throw deleteError
      return NextResponse.json({ table: null, deleted: true })
    }

    const newCount = Math.max(currentTable.current_players - 1, 0)

    const { data: updatedTable, error: updateError } = await supabase
      .from('tables')
      .update({
        current_players: newCount,
        status: 'waiting',
      })
      .eq('id', tableId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ table: updatedTable, deleted: false })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
