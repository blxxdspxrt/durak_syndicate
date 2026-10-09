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
      console.warn('table_players fetch error:', tpErr.message)
      players = []
    }

    if (!players || players.length === 0) {
      players = []
      const creatorId = table.creator_id
      let creatorInfo = null

      if (creatorId) {
        try {
          const { data: cu } = await supabase
            .from('users')
            .select('id, username, first_name, last_name, photo_url')
            .eq('id', creatorId)
            .maybeSingle()
          if (cu) creatorInfo = cu
        } catch (e) {
          console.warn('creator fetch skipped:', e.message)
        }
      }

      for (let i = 1; i <= table.current_players; i++) {
        const isCreator = i === 1 && creatorId
        const userId = isCreator ? creatorId : null
        const userData = isCreator && creatorInfo ? creatorInfo : null

        let team = 1
        if (table.mode === 'Синдикат') {
          team = i % 2 === 1 ? 1 : 2
        }

        players.push({
          id: `fallback-${i}`,
          table_id: id,
          user_id: userId,
          seat_number: i,
          team,
          user: userData,
        })
      }
    } else {
      let hasCreator = players.some((p) => p.user_id === table.creator_id)
      if (!hasCreator && table.creator_id) {
        let creatorInfo = null
        try {
          const { data: cu } = await supabase
            .from('users')
            .select('id, username, first_name, last_name, photo_url')
            .eq('id', table.creator_id)
            .maybeSingle()
          if (cu) creatorInfo = cu
        } catch (e) {}

        const allSeats = players.map((p) => p.seat_number)
        let freeSeat = 1
        while (allSeats.includes(freeSeat)) freeSeat++

        let team = 1
        if (table.mode === 'Синдикат') {
          team = freeSeat % 2 === 1 ? 1 : 2
        }

        players.unshift({
          id: `fallback-creator-${Date.now()}`,
          table_id: id,
          user_id: table.creator_id,
          seat_number: freeSeat,
          team,
          user: creatorInfo,
        })
      }
    }

    const filledSeatNumbers = new Set(players.map((p) => p.seat_number))
    for (let i = 1; i <= table.max_players; i++) {
      if (!filledSeatNumbers.has(i)) {
        let team = 1
        if (table.mode === 'Синдикат') {
          team = i % 2 === 1 ? 1 : 2
        }
        players.push({
          id: `empty-${i}`,
          table_id: id,
          user_id: null,
          seat_number: i,
          team,
          user: null,
        })
      }
    }

    players.sort((a, b) => a.seat_number - b.seat_number)

    console.log('[TABLE DETAILS] id:', id, 'players returned:', players.length)

    return NextResponse.json({ table, players })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
