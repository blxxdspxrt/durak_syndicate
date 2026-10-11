import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authenticateRequest } from '@/lib/telegram-auth'

// ============================================================================
// GET  /api/notifications?userId&initData — список уведомлений игрока
// POST /api/notifications                — отметить все прочитанными
// ============================================================================
// Уведомления хранятся в БД и не удаляются, пока игрок сам их не снесёт (DELETE).
// ============================================================================

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const auth = authenticateRequest(searchParams.get('initData') || '', searchParams.get('userId'))
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('id, kind, title, body, is_read, created_at')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const list = data || []
    return NextResponse.json({
      notifications: list,
      unread: list.filter((n) => !n.is_read).length,
    })
  } catch (err) {
    console.error('[NOTIFICATIONS GET ERROR]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const auth = authenticateRequest(body.initData, body.userId)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', auth.userId)
      .eq('is_read', false)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[NOTIFICATIONS POST ERROR]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
