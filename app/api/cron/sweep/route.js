import { NextResponse } from 'next/server'
import { sweepPresence } from '@/lib/presence'

// ============================================================================
// GET /api/cron/sweep — фоновый «дворник» присутствия.
// ============================================================================
// Вызывается внешним планировщиком (Vercel Cron на плане Pro, cron-job.org и т.п.)
// чтобы чистить «призраков» даже когда в приложении никого нет (24/7).
// Если задан CRON_SECRET — обязателен заголовок `Authorization: Bearer <secret>`.
// ============================================================================

export async function GET(request) {
  const secret = process.env.CRON_SECRET

  if (secret) {
    const auth = request.headers.get('authorization') || ''
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const swept = await sweepPresence({ force: true })
  return NextResponse.json({ ok: true, swept })
}
