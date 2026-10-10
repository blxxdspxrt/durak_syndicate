import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authenticateRequest } from '@/lib/telegram-auth'
import { touchPresence, sweepAndLoadLobby } from '@/lib/presence'

// ============================================================================
// POST /api/tables/heartbeat — «пульс» клиента (раз в секунду).
// ============================================================================
// 1. Обновляет отметку присутствия игрока за его столом (last_seen_at).
// 2. Прогоняет чистку «призраков» и отдаёт АКТУАЛЬНЫЕ столы + статистику,
//    поэтому клиент видит правдивое «Играет» без отдельного опроса.
// 3. Если место игрока исчезло (стол ликвидирован / игрока вытеснили),
//    возвращает removed: true — клиент автоматически уходит в лобби,
//    как и все остальные за этим столом.
// ============================================================================

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { tableId, userId, initData } = body

    const auth = authenticateRequest(initData, userId)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    let removed = false

    if (tableId) {
      const { data: seat } = await supabaseAdmin
        .from('table_players')
        .select('user_id')
        .eq('table_id', tableId)
        .eq('user_id', auth.userId)
        .maybeSingle()

      if (seat) {
        await touchPresence(tableId, auth.userId)
      } else {
        // Место пропало. Живой клиент всегда держит отметку свежей, поэтому
        // это либо выход, либо самоликвидация стола — уводим игрока в лобби.
        removed = true
      }
    }

    const { tables, stats } = await sweepAndLoadLobby()

    return NextResponse.json({ tables, stats, removed })
  } catch (err) {
    console.error('[PRESENCE HEARTBEAT ERROR]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
