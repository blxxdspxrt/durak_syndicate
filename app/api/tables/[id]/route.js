import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(_request, context) {
  try {
    // В Next.js App Router params нужно раскрывать через await
    const params = await context.params
    const id = params?.id

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Valid table UUID is required' }, { status: 400 })
    }

    // 1. Достаем стол из Supabase
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (tableError) {
      console.error('[TABLE FETCH ERROR]:', tableError.message)
      return NextResponse.json({ error: tableError.message }, { status: 500 })
    }

    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    // 2. Достаем игроков из table_players и делаем JOIN с users
    const { data: tpData, error: tpErr } = await supabase
      .from('table_players')
      .select('*, user:users(id, username, first_name, last_name, photo_url, dollars, elo, influence)')
      .eq('table_id', id)
      .order('seat_number', { ascending: true })

    if (tpErr) {
      console.error('[TABLE_PLAYERS FETCH ERROR]:', tpErr.message)
    }

    const players = tpData || []

    return NextResponse.json({ table, players })
  } catch (err) {
    console.error('[GET TABLE DETAILS CRITICAL ERROR]:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}