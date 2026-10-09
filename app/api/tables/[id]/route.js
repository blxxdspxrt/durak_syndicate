import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(_request, { params }) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json({ error: 'Table ID is required' }, { status: 400 })
    }

    // 1. Запрашиваем информацию о столе
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (tableError) throw tableError
    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    // 2. Достаем реальных игроков из table_players + JOIN с users
    const { data: tpData, error: tpErr } = await supabase
      .from('table_players')
      .select('*, user:users(id, username, first_name, last_name, photo_url, dollars, elo, influence)')
      .eq('table_id', id)
      .order('seat_number', { ascending: true })

    if (tpErr) {
      console.error('[TABLE_PLAYERS FETCH ERROR]:', tpErr.message)
    }

    // Честный массив игроков без синтетических заглушек
    const players = tpData || []

    return NextResponse.json({ table, players })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}