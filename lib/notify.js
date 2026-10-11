import { supabaseAdmin } from '@/lib/supabase-admin'

// ============================================================================
// УВЕДОМЛЕНИЯ: хранятся в БД и живут, пока игрок сам их не удалит.
// ============================================================================
// Каждое уведомление дублируется личным сообщением в Telegram (если у бота
// есть право писать игроку — то есть он когда-либо запускал бота).
// ============================================================================

/**
 * Создаёт уведомление в мини-апп и (best-effort) пишет в личку Telegram.
 * @returns {Promise<object|null>} созданная запись
 */
export async function createNotification(userId, { kind = 'system', title, body }) {
  const uid = Number(userId)
  if (!uid) return null

  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({ user_id: uid, kind, title, body })
      .select()
      .single()

    if (error) {
      console.warn('[NOTIFY INSERT WARN]', error.message)
    }

    sendTelegramMessage(uid, `${title}\n\n${body || ''}`.trim()).catch(() => {})
    return data || null
  } catch (e) {
    console.warn('[NOTIFY ERROR]', e.message)
    return null
  }
}

/**
 * Отправляет личное сообщение игроку через Bot API.
 * Работает только если игрок когда-либо открывал бота (иначе Telegram
 * вернёт 403 — это нормально и не считается ошибкой приложения).
 */
export async function sendTelegramMessage(userId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return false

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(userId), text, disable_web_page_preview: true }),
    })
    return res.ok
  } catch (e) {
    console.warn('[NOTIFY TELEGRAM WARN]', e.message)
    return false
  }
}
