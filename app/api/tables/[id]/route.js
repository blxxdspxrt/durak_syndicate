import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(_request, { params }) {
  try {
    const { id } = params

    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (tableError) throw tableError
    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    let players = []
    try {
      const { data: tpData } = await supabase
        .from('table_players')
        .select('*, user:users(id, username, first_name, last_name, photo_url, dollars, elo, influence)')
        .eq('table_id', id)
        .order('seat_number', { ascending: true })

      players = tpData || []
    } catch (tpErr) {
      console.warn('table_players fetch skipped:', tpErr.message)
    }

    return NextResponse.json({ table, players })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
