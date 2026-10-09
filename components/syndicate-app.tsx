'use client'

import { useEffect, useState } from 'react'
import { Check, ShoppingBag, Swords, Trophy, UserRound } from 'lucide-react'
import { FiltersModal } from '@/components/filters-modal'
import { Header } from '@/components/header'
import { PlayScreen } from '@/components/screens/play-screen'
import { ProfileScreen } from '@/components/screens/profile-screen'
import { ShopScreen } from '@/components/screens/shop-screen'
import { TopScreen } from '@/components/screens/top-screen'
import { TableLobby } from '@/components/table-lobby'
import { Stats, Tab, Table, UserData } from '@/types'

const defaultAvatarColors = [
  'from-sky-400 to-blue-700',
  'from-amber-300 to-orange-700',
  'from-emerald-300 to-emerald-700',
  'from-fuchsia-300 to-violet-700',
]

const navItems = [
  { id: 'play', label: 'Играть', icon: Swords },
  { id: 'top', label: 'Топ', icon: Trophy },
  { id: 'shop', label: 'Магазин', icon: ShoppingBag },
  { id: 'profile', label: 'Профиль', icon: UserRound },
]

export default function SyndicateApp() {
  const [tab, setTab] = useState<Tab>('play')
  const [modal, setModal] = useState<'search' | 'create' | null>(null)
  const [lobby, setLobby] = useState<Table | null>(null)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)

  const [tables, setTables] = useState<Table[]>([])
  const [stats, setStats] = useState<Stats>({
    onlinePlayers: 1,
    activeTables: 0,
    avgTurn: '30с',
    multiplier: 'x2.4',
  })

  const [user, setUser] = useState<UserData>({
    id: 0,
    name: 'Игрок',
    username: '@player',
    initials: 'PL',
    avatarColor: defaultAvatarColors[0],
    dollars: null,
    elo: null,
    influence: null,
  })

  // Функция подгрузки столов из Supabase
  const fetchTables = () => {
    fetch('/api/tables')
      .then((res) => res.json())
      .then((data) => {
        if (data.tables) setTables(data.tables)
        if (data.stats) setStats(data.stats)
      })
      .catch((err) => console.error('Fetch Tables Error:', err))
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const tg = (window as any).Telegram?.WebApp
    if (!tg) {
      setLoading(false)
      fetchTables()
      return
    }

    tg.ready()
    tg.expand()

    if (tg.initData) {
      fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            const fullName = `${data.user.first_name || ''} ${data.user.last_name || ''}`.trim() || data.user.username || 'Игрок'
            const initials = fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'PL'

            setUser({
              id: data.user.id,
              name: fullName,
              username: data.user.username ? `@${data.user.username}` : '@no_username',
              initials,
              avatarColor: defaultAvatarColors[Math.abs(data.user.id) % defaultAvatarColors.length],
              photoUrl: data.user.photo_url || undefined,
              dollars: data.user.dollars,
              elo: data.user.elo,
              influence: data.user.influence,
            })
          }
        })
        .catch((err) => console.error('Auth API Error:', err))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }

    fetchTables()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  // Хэндлер создания нового стола
  const handleCreateTable = async (filters: { bet: number; players: number; mode: string; deck: string; turnTime: number }) => {
    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id || 1,
          bet: filters.bet,
          maxPlayers: filters.players,
          mode: filters.mode,
          deck: filters.deck,
          turnTime: filters.turnTime,
        }),
      })
      const data = await res.json()
      if (data.table) {
        setLobby(data.table)
        setToast(`Стол на ${data.table.bet} $ создан!`)
        fetchTables()
      }
    } catch (err) {
      console.error('Create Table Error:', err)
    }
  }

  // Хэндлер быстрого поиска
  const handleQuickSearch = async (filters?: { bet: number; mode: string; deck: string }) => {
    try {
      const res = await fetch('/api/tables/quick-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters || {}),
      })
      const data = await res.json()

      if (data.table) {
        setLobby(data.table)
        setToast(`Стол на ${data.table.bet} $ найден!`)
      } else {
        setToast('Подходящих столов не найдено')
      }
    } catch (err) {
      console.error('Quick Search Error:', err)
    }
  }

  if (loading || user.dollars === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white font-mono text-sm">
        Загрузка Синдиката...
      </div>
    )
  }

  return (
    <main className="club-shell">
      <div className="club-frame">
        <Header user={user} onMenu={() => setToast('Меню профиля скоро будет доступно')} />
        
        {lobby ? (
          <TableLobby user={user} table={lobby} onBack={() => { setLobby(null); fetchTables() }} />
        ) : tab === 'play' ? (
          <PlayScreen 
            user={user} 
            tables={tables} 
            stats={stats}
            onSearch={() => setModal('search')} 
            onCreate={() => setModal('create')} 
            onJoin={(table) => {
              setLobby(table)
              setToast(`Вошли за стол ${table.bet} $`)
            }} 
          />
        ) : tab === 'profile' ? (
          <ProfileScreen user={user} />
        ) : tab === 'shop' ? (
          <ShopScreen />
        ) : (
          <TopScreen currentUser={user} />
        )}

        <nav className="bottom-nav" aria-label="Основная навигация">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setTab(id as Tab)
                setLobby(null)
              }}
              className={`nav-item ${tab === id ? 'active' : ''}`}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {modal && (
        <FiltersModal
          mode={modal}
          onClose={() => setModal(null)}
          onSubmit={(filters) => {
            if (modal === 'create') {
              handleCreateTable(filters)
            } else {
              handleQuickSearch(filters)
            }
          }}
        />
      )}

      {toast && (
        <div className="toast">
          <Check className="size-4 text-emerald-400" /> {toast}
        </div>
      )}
    </main>
  )
}