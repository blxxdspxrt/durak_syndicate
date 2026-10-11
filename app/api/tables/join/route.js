import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authenticateRequest } from '@/lib/telegram-auth'
import { evictUserFromOtherTables, seatPlayer } from '@/lib/presence'
import { checkBan } from '@/lib/penalties'

// POST /api/tables/join — посадить игрока за стол.
// userId берётся из подписанного Telegram initData, а не из тела запроса.
export async function POST(request) {
  try {
    const body = await request.json()
    const { tableId, userId, initData } = body

    const auth = authenticateRequest(initData, userId)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }
    const numericUserId = auth.userId

    // Бан за нарушения (выходы/AFK)
    const ban = await checkBan(numericUserId)
    if (ban) return NextResponse.json({ error: ban.error }, { status: 403 })

    if (!tableId) {
      return NextResponse.json({ error: 'tableId is required' }, { status: 400 })
    }

    // 1. Игрок должен существовать в БД
    const { data: dbUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', numericUserId)
      .maybeSingle()

    if (!dbUser) {
      return NextResponse.json({ error: 'User does not exist in DB' }, { status: 400 })
    }

    // 2. Стол
    const { data: currentTable, error: fetchError } = await supabaseAdmin
      .from('tables')
      .select('*')
      .eq('id', tableId)
      .maybeSingle()

    if (fetchError || !currentTable) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    // 3. Нельзя подсесть к идущей или завершённой игре
    if (currentTable.status !== 'waiting') {
      return NextResponse.json({ error: 'Игра уже началась' }, { status: 403 })
    }

    // 3.1. Бай-ин должен быть обеспечен балансом
    const bet = Number(currentTable.bet) || 0
    const { data: wallet } = await supabaseAdmin
      .from('users')
      .select('dollars')
      .eq('id', numericUserId)
      .maybeSingle()

    if (wallet && Number(wallet.dollars || 0) < bet) {
      return NextResponse.json({ error: 'Недостаточно средств для этой ставки' }, { status: 400 })
    }

    // 4. Уже сидит?
    const { data: existingPlayer } = await supabaseAdmin
      .from('table_players')
      .select('*')
      .eq('table_id', tableId)
      .eq('user_id', numericUserId)
      .maybeSingle()

    if (existingPlayer) {
      return NextResponse.json({ table: currentTable, alreadySeated: true })
    }

    // 4.1. Один игрок — один стол: выходим из всех прежних столов.
    await evictUserFromOtherTables(numericUserId, tableId)

    // 5. Свободные места
    const { data: existingPlayers } = await supabaseAdmin
      .from('table_players')
      .select('seat_number')
      .eq('table_id', tableId)

    const takenSeats = (existingPlayers || []).map((p) => p.seat_number)
    let seatNumber = 1
    const maxPlayers = Number(currentTable.max_players) || 4
    while (takenSeats.includes(seatNumber) && seatNumber <= maxPlayers) {
      seatNumber++
    }

    if (seatNumber > maxPlayers) {
      return NextResponse.json({ error: 'Стол заполнен' }, { status: 400 })
    }

    // 6. Команды Синдиката: места 1-2 = команда 1, 3-4 = команда 2, 5-6 = команда 3.
    //    В классике «команда» = номер места (индивидуальная игра).
    let team = seatNumber
    if (currentTable.mode === 'Синдикат') {
      if (seatNumber <= 2) team = 1
      else if (seatNumber <= 4) team = 2
      else team = 3
    }

    // 7. Сажаем игрока
    const { data: insertedPlayer, error: insertError } = await seatPlayer({
      table_id: tableId,
      user_id: numericUserId,
      seat_number: seatNumber,
      team,
    })

    if (insertError) {
      console.error('[JOIN INSERT ERROR]:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // 8. Обновляем счётчик. Статус остаётся 'waiting' — игру начинает создатель.
    const newCount = (existingPlayers || []).length + 1
    const { data: updatedTable, error: updateError } = await supabaseAdmin
      .from('tables')
      .update({ current_players: newCount })
      .eq('id', tableId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ table: updatedTable, player: insertedPlayer })
  } catch (err) {
    console.error('[JOIN CRITICAL ERROR]:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
