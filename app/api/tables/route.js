import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET: Получение списка активных столов и агрегированной статистики
export async function GET() {
  try {
    const { data: tablesList, error } = await supabase
      .from('tables')
      .select('*')
      .in('status', ['waiting', 'playing'])
      .order('created_at', { ascending: false })

    if (error) throw error

    const activeTablesCount = tablesList ? tablesList.length : 0
    const totalOnlinePlayers = tablesList
      ? tablesList.reduce((acc, t) => acc + (t.current_players || 1), 0)
      : 0

    return NextResponse.json({
      tables: tablesList || [],
      stats: {
        onlinePlayers: totalOnlinePlayers || 1,
        activeTables: activeTablesCount,
        avgTurn: '30с',
        multiplier: 'x2.4',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST: Создание нового стола
export async function POST(request) {
  try {
    const body = await request.json()
    const { userId, bet, maxPlayers, mode, deck, turnTime } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const numericUserId = Number(userId)

    // 1. Создаем стол
    const { data: newTable, error: tableError } = await supabase
      .from('tables')
      .insert({
        creator_id: numericUserId,
        bet: Number(bet) || 1000,
        max_players: Number(maxPlayers) || 4,
        current_players: 1,
        mode: mode || 'Переводной',
        deck: deck || '36 карт',
        turn_time: Number(turnTime) || 30,
        status: 'waiting',
      })
      .select()
      .single()

    if (tableError) throw tableError

    // 2. Вставляем создателя в table_players (seat_number: 1)
    let team = 1
    if (newTable.mode === 'Синдикат') {
      team = 1
    }

    const { error: tpError } = await supabase
      .from('table_players')
      .upsert({
        table_id: newTable.id,
        user_id: numericUserId,
        seat_number: 1,
        team,
      }, { onConflict: 'table_id, seat_number' })

    if (tpError) {
      console.error('[TABLE_PLAYERS CREATOR INSERT ERROR]:', tpError.message)
    }

    return NextResponse.json({ table: newTable })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}