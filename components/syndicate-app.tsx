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
  const [lobbyPlayers, setLobbyPlayers] = useState<any[]>([])
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

  // Функция подгрузки игроков за столом
  const fetchLobbyPlayers = (tableId: string) => {
    fetch(`/api/tables/${tableId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.players) setLobbyPlayers(data.players)
        if (data.table) setLobby(data.table)
      })
      .catch((err) => console.error('Fetch Lobby Players Error:', err))
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const tg = (window as any).Telegram?.WebApp
    if (!tg) {
      setUser((prev) => ({
        ...prev,
        id: 999999,
        name: 'Демо Игрок',
        username: '@demo',
        initials: 'ДМ',
        avatarColor: defaultAvatarColors[2],
        dollars: 15000,
        elo: 1200,
        influence: 450,
      }))
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
              dollars: data.user.dollars ?? 15000,
              elo: data.user.elo ?? 1200,
              influence: data.user.influence ?? 450,
            })
          }
        })
        .catch((err) => {
          console.error('Auth API Error:', err)
          setUser((prev) => ({
            ...prev,
            id: 999999,
            name: 'Гость',
            username: '@guest',
            initials: 'ГС',
            avatarColor: defaultAvatarColors[0],
            dollars: 15000,
            elo: 1200,
            influence: 450,
          }))
        })
        .finally(() => setLoading(false))
    } else {
      setUser((prev) => ({
        ...prev,
        id: 999999,
        name: 'Гость',
        username: '@guest',
        initials: 'ГС',
        avatarColor: defaultAvatarColors[0],
        dollars: 15000,
        elo: 1200,
        influence: 450,
      }))
      setLoading(false)
    }

    fetchTables()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    fetchTables()
    if (lobby) fetchLobbyPlayers(lobby.id)
    const interval = window.setInterval(() => {
      if (!lobby) {
        fetchTables()
      } else {
        fetchLobbyPlayers(lobby.id)
        fetchTables()
      }
    }, 5000)
    return () => window.clearInterval(interval)
  }, [lobby])

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
        const isSyndicate = data.table.mode === 'Синдикат'
        setLobby(data.table)
        setLobbyPlayers([
          {
            id: 'local-creator',
            table_id: data.table.id,
            user_id: user.id,
            seat_number: 1,
            team: 1,
            user: {
              id: user.id,
              username: user.username || '',
              first_name: user.name.split(' ')[0] || user.name,
              last_name: user.name.split(' ')[1] || '',
              photo_url: user.photoUrl,
            },
          },
        ])
        setToast(`Стол на ${data.table.bet} $ создан!`)
        fetchTables()
        setTimeout(() => fetchLobbyPlayers(data.table.id), 400)
      }
    } catch (err) {
      console.error('Create Table Error:', err)
    }
  }

  // Хэндлер выхода из стола
  const handleLeaveTable = async () => {
    if (!lobby) return
    try {
      await fetch('/api/tables/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: lobby.id,
          userId: user.id,
          isCreator: lobby.creator_id === user.id,
        }),
      })
      setToast('Вы вышли из-за стола')
    } catch (err) {
      console.error('Leave Table Error:', err)
    }
    setLobby(null)
    setLobbyPlayers([])
    fetchTables()
  }

  // Хэндлер подключения к столу
  const handleJoinTable = async (table: Table) => {
    let joined = false
    try {
      if (table.creator_id !== user.id && table.current_players < table.max_players) {
        const res = await fetch('/api/tables/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableId: table.id, userId: user.id }),
        })
        const data = await res.json()
        if (data.table) {
          table = data.table
          joined = true
        }
      }
      const isCreatorOfThis = table.creator_id === user.id
      const isSyndicate = table.mode === 'Синдикат'
      const localSeat = isCreatorOfThis ? 1 : table.current_players

      const basePlayers = []
      if (isCreatorOfThis || table.creator_id) {
        basePlayers.push({
          id: 'local-creator',
          table_id: table.id,
          user_id: table.creator_id,
          seat_number: 1,
          team: 1,
          user: isCreatorOfThis ? {
            id: user.id,
            username: user.username || '',
            first_name: user.name.split(' ')[0] || user.name,
            last_name: user.name.split(' ')[1] || '',
            photo_url: user.photoUrl,
          } : null,
        })
      }

      if (!isCreatorOfThis) {
        let freeSeat = 2
        basePlayers.push({
          id: 'local-me',
          table_id: table.id,
          user_id: user.id,
          seat_number: freeSeat,
          team: isSyndicate ? (freeSeat % 2 === 1 ? 1 : 2) : 1,
          user: {
            id: user.id,
            username: user.username || '',
            first_name: user.name.split(' ')[0] || user.name,
            last_name: user.name.split(' ')[1] || '',
            photo_url: user.photoUrl,
          },
        })
      }

      setLobby(table)
      setLobbyPlayers(basePlayers)
      setToast(`Вошли за стол ${table.bet} $`)
      fetchTables()
      setTimeout(() => fetchLobbyPlayers(table.id), 400)
    } catch (err) {
      console.error('Join Table Error:', err)
      setLobby(table)
      setToast(`Вошли за стол ${table.bet} $`)
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
        await handleJoinTable(data.table)
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
          <TableLobby user={user} table={lobby} players={lobbyPlayers} onBack={handleLeaveTable} isCreator={lobby.creator_id === user.id} />
        ) : tab === 'play' ? (
          <PlayScreen 
            user={user} 
            tables={tables} 
            stats={stats}
            onSearch={() => setModal('search')} 
            onCreate={() => setModal('create')} 
            onJoin={handleJoinTable} 
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