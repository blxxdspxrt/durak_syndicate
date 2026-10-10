import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authenticateRequest } from '@/lib/telegram-auth'

// POST /api/tables/leave — выйти из-за стола.
// Флаг isCreator из тела НЕ используется — создатель определяется по creator_id в БД.
export async function POST(request) {
  try {
    const body = await request.json()
    const { tableId, userId, initData } = body

    const auth = authenticateRequest(initData, userId)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }
    const numericUserId = auth.userId

    if (!tableId) {
      return NextResponse.json({ error: 'tableId is required' }, { status: 400 })
    }

    const { data: currentTable, error: fetchError } = await supabaseAdmin
      .from('tables')
      .select('*')
      .eq('id', tableId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!currentTable) {
      return NextResponse.json({ table: null, deleted: true })
    }

    // Создатель — только тот, кто реально создал стол
    const isCreator = Number(currentTable.creator_id) === numericUserId

    // Убираем место игрока
    const { error: delPlayerErr } = await supabaseAdmin
      .from('table_players')
      .delete()
      .eq('table_id', tableId)
      .eq('user_id', numericUserId)

    if (delPlayerErr) {
      console.warn('[LEAVE] table_players delete warning:', delPlayerErr.message)
    }

    // Создатель уходит — удаляем стол целиком (вместе с игровым состоянием)
    if (isCreator) {
      await supabaseAdmin.from('game_states').delete().eq('table_id', tableId)
      await supabaseAdmin.from('table_players').delete().eq('table_id', tableId)
      const { error: deleteError } = await supabaseAdmin.from('tables').delete().eq('id', tableId)
      if (deleteError) throw deleteError
      return NextResponse.json({ table: null, deleted: true })
    }

    // Остальные места
    const { data: remaining } = await supabaseAdmin
      .from('table_players')
      .select('user_id')
      .eq('table_id', tableId)

    const newCount = (remaining || []).length

    if (newCount === 0) {
      await supabaseAdmin.from('game_states').delete().eq('table_id', tableId)
      await supabaseAdmin.from('tables').delete().eq('id', tableId)
      return NextResponse.json({ table: null, deleted: true })
    }

    const { data: updatedTable, error: updateError } = await supabaseAdmin
      .from('tables')
      .update({ current_players: newCount, status: 'waiting' })
      .eq('id', tableId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ table: updatedTable, deleted: false })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
