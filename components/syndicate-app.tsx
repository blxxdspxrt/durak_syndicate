'use client'

import { useEffect, useState } from 'react'
import { Check, Shield, ShoppingBag, Swords, UserRound } from 'lucide-react'
import { FiltersModal } from '@/components/filters-modal'
import { Header } from '@/components/header'
import { PlayScreen } from '@/components/screens/play-screen'
import { ProfileScreen } from '@/components/screens/profile-screen'
import { ShopScreen } from '@/components/screens/shop-screen'
import { TopScreen } from '@/components/screens/top-screen'
import { TableLobby } from '@/components/table-lobby'
import { GameScreen } from '@/components/screens/game-screen'
import { Stats, Tab, Table, UserData } from '@/types'
import { supabase } from '@/lib/supabase'

const defaultAvatarColors = [
  'from-sky-400 to-blue-700',
  'from-amber-300 to-orange-700',
  'from-emerald-300 to-emerald-700',
  'from-fuchsia-300 to-violet-700',
]

// Новые режимы навигации
export type AppTab = 'shop' | 'classic' | 'syndicate' | 'profile' | 'top'

export default function SyndicateApp() {
  const [tab, setTab] = useState<AppTab>('syndicate') // По умолчанию Синдикат
  const [modal, setModal] = useState<'search' | 'create' | null>(null)
  const [lobby, setLobby] = useState<Table | null>(null)
  const [lobbyPlayers, setLobbyPlayers] = useState<any[]>([])
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)

  // 👇 НОВЫЙ СТЕЙТ ДЛЯ СОСТОЯНИЯ ИГРЫ
  const [gameState, setGameState] = useState<any>(null)

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

  const fetchTables = () => {
    fetch('/api/tables')
      .then((res) => res.json())
      .then((data) => {
        if (data.tables) setTables(data.tables)
        if (data.stats) setStats(data.stats)
      })
      .catch((err) => console.error('Fetch Tables Error:', err))
  }

  const fetchLobbyPlayers = async (tableId: string) => {
    try {
      const res = await fetch(`/api/tables/${tableId}`)
      const data = await res.json()
      if (data.players && Array.isArray(data.players)) setLobbyPlayers(data.players)
      if (data.table) setLobby(data.table)
    } catch (err) {
      console.error('Fetch Lobby Players Error:', err)
    }
  }

  // 👇 ФУНКЦИЯ ПОДГРУЗКИ СОСТОЯНИЯ ИГРЫ
  const fetchGameState = async (tableId: string) => {
    try {
      const { data, error } = await supabase
        .from('game_states')
        .select('*')
        .eq('table_id', tableId)
        .maybeSingle()

      if (data) setGameState(data)
    } catch (err) {
      console.error('Fetch Game State Error:', err)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const tg = (window as any).Telegram?.WebApp

    if (!tg || !tg.initData) {
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
            id: Number(data.user.id),
            name: fullName,
            username: data.user.username ? `@${data.user.username}` : '@no_username',
            initials,
            avatarColor: defaultAvatarColors[Math.abs(Number(data.user.id)) % defaultAvatarColors.length],
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

    fetchTables()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  // Realtime таблицы
  useEffect(() => {
    fetchTables()
    const tablesChannel = supabase
      .channel('realtime_tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchTables())
      .subscribe()

    return () => {
      supabase.removeChannel(tablesChannel)
    }
  }, [])

  // 👇 REALTIME ЛОББИ + ИГРОВОЕ СОСТОЯНИЕ
  useEffect(() => {
    if (!lobby?.id) {
      setGameState(null)
      return
    }

    fetchLobbyPlayers(lobby.id)
    fetchGameState(lobby.id)

    // Канал игроков
    const lobbyChannel = supabase
      .channel(`table_players_${lobby.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'table_players', filter: `table_id=eq.${lobby.id}` },
        () => {
          fetchLobbyPlayers(lobby.id)
        }
      )
      .subscribe()

    // Канал игровых ходов / состояния стола
    const gameChannel = supabase
      .channel(`game_state_${lobby.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_states', filter: `table_id=eq.${lobby.id}` },
        (payload) => {
          setGameState(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(lobbyChannel)
      supabase.removeChannel(gameChannel)
    }
  }, [lobby?.id])

  const handleCreateTable = async (filters: { bet: number; players: number; mode: string; deck: string; turnTime: number }) => {
    try {
      const modeToCreate = tab === 'syndicate' ? 'Синдикат' : filters.mode || 'Переводной'
      const maxPlayers = tab === 'syndicate' ? 4 : filters.players

      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          bet: filters.bet,
          maxPlayers,
          mode: modeToCreate,
          deck: filters.deck,
          turnTime: filters.turnTime,
        }),
      })
      const data = await res.json()

      if (data.table) {
        setLobby(data.table)
        setToast(`Стол на ${data.table.bet} $ создан!`)
        await fetchLobbyPlayers(data.table.id)
        fetchTables()
      }
    } catch (err) {
      console.error('Create Table Error:', err)
    }
  }

  const handleLeaveTable = async () => {
    if (!lobby) return
    try {
      await fetch('/api/tables/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: lobby.id, userId: user.id, isCreator: lobby.creator_id === user.id }),
      })
      setToast('Вы вышли из-за стола')
    } catch (err) {
      console.error('Leave Table Error:', err)
    }
    setLobby(null)
    setLobbyPlayers([])
    setGameState(null)
    fetchTables()
  }

  const handleJoinTable = async (table: Table) => {
    try {
      if (table.creator_id !== user.id && table.current_players < table.max_players) {
        const res = await fetch('/api/tables/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableId: table.id, userId: user.id }),
        })
        const data = await res.json()
        if (data.table) table = data.table
      }

      setLobby(table)
      setToast(`Вошли за стол ${table.bet} $`)
      await fetchLobbyPlayers(table.id)
      fetchTables()
    } catch (err) {
      console.error('Join Table Error:', err)
      setLobby(table)
      fetchLobbyPlayers(table.id)
    }
  }

  // Фильтруем столы в зависимости от открытой вкладки
  const filteredTables = tables.filter((t) => {
    if (tab === 'syndicate') return t.mode === 'Синдикат'
    if (tab === 'classic') return t.mode !== 'Синдикат'
    return true
  })

  if (loading || user.dollars === null) {
    return <div className="flex h-screen items-center justify-center bg-black font-mono text-sm text-white">Загрузка Синдиката...</div>
  }

  return (
    <main className="club-shell">
      <div className="club-frame">
        <Header user={user} onMenu={() => setToast('Меню профиля скоро будет доступно')} />

        {/* 👇 ИЗМЕНЁННЫЙ БЛОК РЕНДЕРА: LOBBY → GAME_SCREEN → LOBBY */}
        {lobby ? (
          lobby.status === 'in_game' && gameState ? (
            <GameScreen
              user={user}
              gameState={gameState}
              players={lobbyPlayers}
              onLeave={handleLeaveTable}
            />
          ) : (
            <TableLobby
              user={user}
              table={lobby}
              players={lobbyPlayers}
              onBack={handleLeaveTable}
              isCreator={lobby.creator_id === user.id}
            />
          )
        ) : tab === 'classic' || tab === 'syndicate' ? (
          <PlayScreen
            user={user}
            tables={filteredTables}
            stats={stats}
            gameMode={tab}
            onSearch={() => setModal('search')}
            onCreate={() => setModal('create')}
            onJoin={handleJoinTable}
          />
        ) : tab === 'profile' ? (
          <ProfileScreen user={user} onOpenTop={() => setTab('top')} />
        ) : tab === 'shop' ? (
          <ShopScreen />
        ) : (
          <TopScreen currentUser={user} />
        )}

        {/* НОВАЯ ПАНЕЛЬ НАВИГАЦИИ С СДВОЕННЫМ ТУМБЛЕРОМ ПОЦЕНТРУ */}
        <nav className="bottom-nav flex items-center justify-between px-4 py-2.5 bg-slate-950/95 border-t border-white/10 backdrop-blur-xl">
          {/* Кнопка Магазин Слева */}
          <button
            onClick={() => {
              setTab('shop')
              setLobby(null)
            }}
            className={`flex flex-col items-center gap-1 transition-all ${
              tab === 'shop' ? 'text-blue-400 font-semibold scale-105' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="size-5" />
            <span className="text-[10px] tracking-wide">Магазин</span>
          </button>

          {/* Сдвоенный Тумблер Режимов (Классика | Синдикат) Впалый по высоте */}
          <div className="relative flex items-center rounded-2xl bg-slate-900/90 p-1 border border-white/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] translate-y-1">
            {/* Анимированная градиентная подложка */}
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-gradient-to-r transition-all duration-300 ease-out shadow-lg ${
                tab === 'classic'
                  ? 'left-1 from-amber-500 to-orange-600 shadow-amber-500/25'
                  : tab === 'syndicate'
                  ? 'left-[calc(50%+2px)] from-blue-600 to-indigo-600 shadow-blue-500/30'
                  : 'opacity-0 pointer-events-none'
              }`}
            />

            <button
              onClick={() => {
                setTab('classic')
                setLobby(null)
              }}
              className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                tab === 'classic' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Swords className="size-3.5" />
              <span>Классика</span>
            </button>

            <button
              onClick={() => {
                setTab('syndicate')
                setLobby(null)
              }}
              className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                tab === 'syndicate' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="size-3.5" />
              <span>Синдикат</span>
            </button>
          </div>

          {/* Кнопка Профиль Справа */}
          <button
            onClick={() => {
              setTab('profile')
              setLobby(null)
            }}
            className={`flex flex-col items-center gap-1 transition-all ${
              tab === 'profile' ? 'text-blue-400 font-semibold scale-105' : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserRound className="size-5" />
            <span className="text-[10px] tracking-wide">Профиль</span>
          </button>
        </nav>
      </div>

      {modal && (
        <FiltersModal
          mode={modal}
          defaultGameMode={tab === 'syndicate' ? 'Синдикат' : 'Классический'}
          onClose={() => setModal(null)}
          onSubmit={(filters) => {
            if (modal === 'create') {
              handleCreateTable(filters)
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