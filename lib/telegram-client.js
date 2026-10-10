// Клиентский помощник для Telegram WebApp.
// Возвращает initData для передачи на сервер (валидация подписи).
export function getInitData() {
  if (typeof window === 'undefined') return ''
  const tg = window.Telegram?.WebApp
  return tg?.initData || ''
}
