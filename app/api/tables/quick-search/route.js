import { NextResponse } from 'next/server'
import { sweepAndLoadLobby } from '@/lib/presence'
import { authenticateRequest } from '@/lib/telegram-auth'
import { checkBan } from '@/lib/penalties'

// POST /api/tables/quick-search — подобрать стол с реальными свободными местами.
// Используем актуальную (пересчитанную) сводку, а не «раздутые» счётчики.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { bet, mode, deck, userId, initData } = body

    const auth = authenticateRequest(initData, userId)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const ban = await checkBan(auth.userId)
    if (ban) return NextResponse.json({ error: ban.error }, { status: 403 })

    const { tables } = await sweepAndLoadLobby()

    const candidates = (tables || []).filter((t) => {
      if (t.status !== 'waiting') return false
      if (mode && t.mode !== mode) return false
      if (deck && t.deck !== deck) return false
      return Number(t.current_players) < Number(t.max_players)
    })

    // Сначала стол с подходящей ставкой, иначе — просто первый свободный.
    const byBet = bet == null ? [] : candidates.filter((t) => Number(t.bet) === Number(bet))

    return NextResponse.json({ table: byBet[0] || candidates[0] || null })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}