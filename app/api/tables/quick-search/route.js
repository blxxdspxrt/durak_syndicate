import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request) {
  try {
    const body = await request.json()
    const { bet, mode, deck } = body

    // Ищем подходящий открытый стол с имеющимися свободными местами
    let query = supabase
      .from('tables')
      .select('*')
      .eq('status', 'waiting')

    if (mode) query = query.eq('mode', mode)
    if (deck) query = query.eq('deck', deck)

    const { data: foundTables, error } = await query

    if (error) throw error

    // Фильтруем те, где current_players < max_players
    const availableTable = foundTables?.find((t) => t.current_players < t.max_players)

    if (availableTable) {
      return NextResponse.json({ table: availableTable })
    }

    // Если ничего не нашли — отдаем первый попавшийся или null
    return NextResponse.json({ table: foundTables?.[0] || null })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}