import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authenticateRequest } from '@/lib/telegram-auth'
import { sweepAndLoadLobby, evictUserFromOtherTables, seatPlayer } from '@/lib/presence'
import { checkBan } from '@/lib/penalties'

// GET: публичный список активных столов и АКТУАЛЬНОЙ статистики.
// Секретных данных здесь нет — только метаданные лобби.
// Перед выдачей чистим «призраков» (игроки без свежего пульса) и пересчитываем
// счётчики из реальных мест: столы с 0 игроков самоликвидируются.
export async function GET() {
  try {
    const { tables, stats } = await sweepAndLoadLobby()
    return NextResponse.json({ tables, stats })
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

    // Бан за нарушения: у каждого режима СВОЙ (провинился в Синдикате —
    // Классика остаётся доступной, и наоборот)
    const ban = await checkBan(numericUserId, gameMode)
    if (ban) return NextResponse.json({ error: ban.error }, { status: 403 })
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

    // Время хода — только из разрешённого набора (см. TURN_OPTIONS в движке)
    const TURN_OPTIONS = [15, 30, 45, 60]
    const turnTimeValue = TURN_OPTIONS.includes(Number(turnTime)) ? Number(turnTime) : 30

    // Бай-ин должен быть обеспечен балансом — иначе экономика станет убыточной.
    const { data: creatorWallet } = await supabaseAdmin
      .from('users')
      .select('dollars')
      .eq('id', numericUserId)
      .maybeSingle()

    if (creatorWallet && Number(creatorWallet.dollars || 0) < betValue) {
      return NextResponse.json({ error: 'Недостаточно средств для этой ставки' }, { status: 400 })
    }

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
        turn_time: turnTimeValue,
        status: 'waiting',
      })
      .select()
      .single()

    if (tableError) throw tableError

    // 2. Создатель садится за 1-е место (для Синдиката — команда 1)
    const { error: tpError } = await seatPlayer({
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

    // 3. Один игрок — один стол: убираем его из всех прежних столов
    //    (кроме только что созданного), иначе он «висит» сразу в нескольких.
    await evictUserFromOtherTables(numericUserId, newTable.id)

    return NextResponse.json({ table: newTable })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
