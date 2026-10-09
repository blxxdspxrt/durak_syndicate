import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET: Получение списка активных столов и агрегированной статистики
export async function GET() {
  try {
    // Вытягиваем только столы со статусом waiting или playing
    const { data: tablesList, error } = await supabase
      .from('tables')
      .select('*')
      .in('status', ['waiting', 'playing'])
      .order('created_at', { ascending: false })

    if (error) throw error

    // Динамический расчет статистики онлайн на основе реальных данных из БД
    const activeTablesCount = tablesList ? tablesList.length : 0
    const totalOnlinePlayers = tablesList
      ? tablesList.reduce((acc, t) => acc + (t.current_players || 1), 0)
      : 0

    return NextResponse.json({
      tables: tablesList || [],
      stats: {
        onlinePlayers: totalOnlinePlayers || 1, // Чтобы не показывало 0
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

    const { data: newTable, error } = await supabase
      .from('tables')
      .insert({
        creator_id: userId,
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

    if (error) throw error

    try {
      let team = 1
      if (newTable.mode === 'Синдикат') {
        team = 1
      }

      await supabase
        .from('table_players')
        .insert({
          table_id: newTable.id,
          user_id: userId,
          seat_number: 1,
          team,
        })
    } catch (tpErr) {
      console.warn('table_players creator insert skipped:', tpErr.message)
    }

    return NextResponse.json({ table: newTable })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}