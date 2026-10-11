import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authenticateRequest } from '@/lib/telegram-auth'

// DELETE /api/notifications/:id?userId&initData — удалить СВОЁ уведомление.
export async function DELETE(request, context) {
  try {
    const params = await context.params
    const id = params?.id
    const { searchParams } = new URL(request.url)

    const auth = authenticateRequest(searchParams.get('initData') || '', searchParams.get('userId'))
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.userId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[NOTIFICATIONS DELETE ERROR]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
