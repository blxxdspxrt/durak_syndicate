import crypto from 'crypto'

/**
 * Проверяет подпись Telegram WebApp initData.
 * Возвращает объект пользователя или null, если подпись невалидна.
 */
export function verifyInitData(initData, botToken) {
  if (!initData || !botToken) return null

  try {
    const urlParams = new URLSearchParams(initData)
    const hash = urlParams.get('hash')
    if (!hash) return null
    urlParams.delete('hash')

    const dataCheckString = Array.from(urlParams.entries())
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n')

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex')

    if (calculatedHash !== hash) return null

    const userStr = urlParams.get('user')
    const user = userStr ? JSON.parse(userStr) : null
    if (!user || !user.id) return null

    return user
  } catch {
    return null
  }
}

/**
 * Извлекает и валидирует пользователя из запроса.
 * В dev-режиме (нет TELEGRAM_BOT_TOKEN) доверяет userId из тела —
 * это нужно для локальной отладки без Telegram.
 *
 * @returns {{ userId: number|null, user: object|null, error: string|null }}
 */
export function authenticateRequest(initData, fallbackUserId) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN

  if (botToken) {
    const user = verifyInitData(initData, botToken)
    if (!user) {
      return { userId: null, user: null, error: 'Invalid Telegram signature' }
    }
    return { userId: Number(user.id), user, error: null }
  }

  // Dev-режим: токена нет — доверяем переданному userId
  const uid = Number(fallbackUserId)
  if (!uid || Number.isNaN(uid)) {
    return { userId: null, user: null, error: 'userId is required (dev mode)' }
  }
  return { userId: uid, user: null, error: null }
}
