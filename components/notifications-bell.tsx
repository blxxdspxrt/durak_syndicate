'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Trash2 } from 'lucide-react'
import { getInitData } from '@/lib/telegram-client'

type Notification = {
  id: number
  kind: string
  title: string
  body: string | null
  is_read: boolean
  created_at: string
}

// ============================================================================
// КОЛОКОЛЬЧИК УВЕДОМЛЕНИЙ
// ============================================================================
// • красный кружок в правом верхнем углу кнопки, пока есть непрочитанные;
// • по клику кружок сразу сбрасывается (все помечаются прочитанными);
// • панель — прямоугольное «облачко» с коротким хвостиком к кнопке;
//   максимум 1/3 экрана, внутри — прокрутка;
// • закрывается кликом по свободному месту или повторным кликом по колокольчику;
// • уведомления можно удалять (кнопка справа снизу).
// ============================================================================

export function NotificationsBell({ userId }: { userId: number }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const alive = useRef(true)

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const params = new URLSearchParams({ userId: String(userId), initData: getInitData() })
      const res = await fetch(`/api/notifications?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json()
      if (!alive.current) return
      if (Array.isArray(data.notifications)) setItems(data.notifications)
      if (typeof data.unread === 'number') setUnread(data.unread)
    } catch {
      // сеть недоступна — попробуем на следующем тике
    }
  }, [userId])

  useEffect(() => {
    alive.current = true
    load()
    const timer = window.setInterval(load, 15000)
    return () => {
      alive.current = false
      window.clearInterval(timer)
    }
  }, [load])

  const markAllRead = useCallback(async () => {
    if (!userId) return
    setUnread(0)
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, initData: getInitData() }),
      })
    } catch {}
  }, [userId])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) markAllRead()
  }

  const remove = async (id: number) => {
    setItems((prev) => prev.filter((n) => n.id !== id))
    try {
      const params = new URLSearchParams({ userId: String(userId), initData: getInitData() })
      await fetch(`/api/notifications/${id}?${params.toString()}`, { method: 'DELETE' })
    } catch {}
  }

  const unreadItems = items.filter((n) => !n.is_read)
  const readItems = items.filter((n) => n.is_read)

  const renderItem = (n: Notification) => (
    <div
      key={n.id}
      className={`rounded-lg border p-2.5 ${
        n.is_read ? 'border-white/10 bg-slate-950/60' : 'border-rose-500/30 bg-rose-500/[0.07]'
      }`}
    >
      <p className="text-xs font-semibold text-white">{n.title}</p>
      {n.body && (
        <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-slate-400">{n.body}</p>
      )}
      <div className="mt-2 flex justify-end">
        <button
          onClick={() => remove(n.id)}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-slate-500 transition-colors hover:bg-white/5 hover:text-rose-300"
        >
          <Trash2 className="size-3" /> Удалить
        </button>
      </div>
    </div>
  )

  return (
    <div className="relative">
      <button
        aria-label="Уведомления"
        onClick={toggle}
        className={`icon-button relative ${open ? 'bg-white/[0.14] text-white' : ''}`}
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute right-0 top-0 size-2.5 translate-x-1/4 -translate-y-1/4 rounded-full border border-slate-950 bg-rose-500" />
        )}
      </button>

      {open && (
        <>
          {/* Клик по любому свободному месту закрывает облачко */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-full z-50 mt-1.5 w-72">
            {/* Короткий хвостик к кнопке */}
            <div
              className="ml-auto mr-3 h-2 w-4 bg-slate-900"
              style={{ clipPath: 'polygon(0 100%, 50% 0, 100% 100%)' }}
            />
            <div
              className="overflow-y-auto rounded-xl border border-white/10 bg-slate-900 p-2 shadow-2xl"
              style={{ maxHeight: 'calc((100vh - 96px) / 3)' }}
            >
              {items.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-slate-500">Уведомлений нет</p>
              ) : (
                <div className="space-y-3">
                  {unreadItems.length > 0 && (
                    <div className="space-y-2">
                      <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-rose-400">
                        Непрочитанные
                      </p>
                      {unreadItems.map(renderItem)}
                    </div>
                  )}
                  {readItems.length > 0 && (
                    <div className="space-y-2">
                      <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Прочитанные
                      </p>
                      {readItems.map(renderItem)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
