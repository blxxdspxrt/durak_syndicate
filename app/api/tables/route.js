import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authenticateRequest } from '@/lib/telegram-auth'

// GET: публичный список активных столов и агрегированной статистики.
// Секретных данных здесь нет — только метаданные лобби.
export async function GET() {
  try {
    const { data: tablesList, error } = await supabaseAdmin
      .from('tables')
      .select('*')
      .in('status', ['waiting', 'playing', 'in_game'])
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

// POST: создание нового стола. Требует валидный Telegram initData —
// userId из тела больше не является источником доверия.
export async function POST(request) {
  try {
    const body = await request.json()
    const { userId, initData, bet, maxPlayers, mode, deck, turnTime } = body

    const auth = authenticateRequest(initData, userId)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }
    const numericUserId = auth.userId

    const gameMode = mode || 'Переводной'
    const players = Number(maxPlayers) || 4

    // Валидация состава
    if (gameMode === 'Синдикат') {
      if (![4, 6].includes(players)) {
        return NextResponse.json({ error: 'Синдикат: только 4 или 6 игроков' }, { status: 400 })
      }
    } else if (![2, 3, 4, 6].includes(players)) {
      return NextResponse.json({ error: 'Недопустимое число игроков' }, { status: 400 })
    }

    const betValue = Math.max(0, Math.floor(Number(bet) || 1000))

    // 1. Создаём стол
    const { data: newTable, error: tableError } = await supabaseAdmin
      .from('tables')
      .insert({
        creator_id: numericUserId,
        bet: betValue,
        max_players: players,
        current_players: 1,
        mode: gameMode,
        deck: deck || '36 карт',
        turn_time: Number(turnTime) || 30,
        status: 'waiting',
      })
      .select()
      .single()

    if (tableError) throw tableError

    // 2. Создатель садится за 1-е место (для Синдиката — команда 1)
    const { error: tpError } = await supabaseAdmin.from('table_players').insert({
      table_id: newTable.id,
      user_id: numericUserId,
      seat_number: 1,
      team: 1,
    })

    if (tpError) {
      console.error('[TABLE_PLAYERS CREATOR INSERT ERROR]:', tpError.message)
      // Откатываем стол, чтобы не осталось «пустого» лобби
      await supabaseAdmin.from('tables').delete().eq('id', newTable.id)
      return NextResponse.json({ error: tpError.message }, { status: 500 })
    }

    return NextResponse.json({ table: newTable })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
