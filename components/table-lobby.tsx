import { useState, useMemo } from 'react'
import { Check, Dices, DoorOpen, Play, Spade, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, UserData } from '@/types'
import { DynamicAvatar } from './dynamic-avatar'

const placeholderColors = [
  'from-sky-400 to-blue-700',
  'from-amber-300 to-orange-700',
  'from-emerald-300 to-emerald-700',
  'from-fuchsia-300 to-violet-700',
]

const SYNDICATE_NAMES = ['Синдикат Альфа ♠️', 'Синдикат Омега ♦️', 'Синдикат Феникс ♣️']

type LobbyPlayer = {
  id?: string
  user_id?: number | null
  user?: {
    id: number
    username?: string
    first_name?: string
    last_name?: string
    photo_url?: string
  } | null
  seat_number: number
  team?: number
}

type Slot = {
  name: string
  initials: string
  color: string
  photoUrl?: string
  isUser: boolean
  isEmpty: boolean
  isCreator: boolean
  seatNumber: number
  team: number
}

export function TableLobby({
  user,
  table,
  players = [],
  onBack,
  isCreator = false,
}: {
  user: UserData
  table: Table
  players?: LobbyPlayer[]
  onBack: () => void
  isCreator?: boolean
}) {
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState('')
  const [gameStarting, setGameStarting] = useState(false)

  const totalSlots = table.max_players
  const isSyndicate = table.mode === 'Синдикат'

  // Формируем сетку слотов от 1 до max_players
  const slots = useMemo<Slot[]>(() => {
    const result: Slot[] = []
    const playerBySeat = new Map<number, LobbyPlayer>()

    if (Array.isArray(players)) {
      for (const p of players) {
        if (p && typeof p.seat_number === 'number') {
          playerBySeat.set(p.seat_number, p)
        }
      }
    }

    for (let i = 1; i <= totalSlots; i++) {
      const p = playerBySeat.get(i)
      let calculatedTeam = 1
      if (isSyndicate) {
        if (i <= 2) calculatedTeam = 1
        else if (i <= 4) calculatedTeam = 2
        else calculatedTeam = 3
      } else {
        calculatedTeam = i
      }

      if (p) {
        const u = p.user
        const userId = p.user_id ?? u?.id ?? null
        const isCurrentUser = userId === user.id
        const thisIsCreator = userId === table.creator_id

        let name: string
        let initials: string
        let photoUrl: string | undefined
        let color = placeholderColors[(i - 1) % placeholderColors.length]

        if (isCurrentUser) {
          name = user.name
          initials = user.initials
          color = user.avatarColor
          photoUrl = user.photoUrl
        } else if (u) {
          const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
          name = full || (u.username ? `@${u.username}` : `Игрок #${String(userId).slice(-4)}`)
          initials = name.replace('@', '').split(' ').map((x) => x[0]).join('').substring(0, 2).toUpperCase() || `И${i}`
          photoUrl = u.photo_url || undefined
          if (userId) color = placeholderColors[Math.abs(Number(userId)) % placeholderColors.length]
        } else if (userId) {
          name = `Игрок #${String(userId).slice(-4)}`
          initials = `И${String(userId).slice(-2)}`
          color = placeholderColors[Math.abs(Number(userId)) % placeholderColors.length]
        } else {
          name = `Игрок ${i}`
          initials = `И${i}`
        }

        result.push({
          name: thisIsCreator ? `${name} (Создатель)` : isCurrentUser ? `${name} (Вы)` : name,
          initials,
          color,
          photoUrl,
          isUser: isCurrentUser,
          isEmpty: false,
          isCreator: thisIsCreator,
          seatNumber: i,
          team: p.team || calculatedTeam,
        })
      } else {
        result.push({
          name: 'Свободное место',
          initials: '??',
          color: 'from-slate-700 to-slate-900',
          isUser: false,
          isEmpty: true,
          isCreator: false,
          seatNumber: i,
          team: calculatedTeam,
        })
      }
    }

    return result
  }, [players, table, user, totalSlots, isSyndicate])

  const actualFilled = slots.filter((s) => !s.isEmpty).length
  const minPlayers = isSyndicate ? 4 : 2
  const canStart = isCreator && actualFilled >= minPlayers

  // Секторы для рулетки
  const rouletteItems = useMemo(() => {
    if (!isSyndicate) return slots.filter((s) => !s.isEmpty)
    
    // В Синдикате крутим по именам Синдикатов
    const activeTeams = new Set(slots.filter((s) => !s.isEmpty).map((s) => s.team))
    return Array.from(activeTeams).map((tNum) => ({
      name: SYNDICATE_NAMES[tNum - 1] || `Синдикат ${tNum}`,
      initials: `С${tNum}`,
      color: placeholderColors[(tNum - 1) % placeholderColors.length],
      photoUrl: undefined,
    }))
  }, [slots, isSyndicate])

  const spin = () => {
    if (rouletteItems.length === 0) return
    setSpinning(true)
    setWinner('')
    window.setTimeout(() => {
      setSpinning(false)
      const w = rouletteItems[Math.floor(Math.random() * rouletteItems.length)]
      setWinner(w.name)
    }, 2200)
  }

  const startGame = () => {
    setGameStarting(true)
    setTimeout(() => setGameStarting(false), 1500)
  }

  const tableId = String(table.id).substring(0, 8).toUpperCase()
  const needMore = Math.max(0, minPlayers - actualFilled)

  // Группировка слотов по Синдикатам для режима Синдикат
  const syndicateGroups = useMemo(() => {
    if (!isSyndicate) return []
    const groups = []
    const totalTeams = totalSlots / 2
    for (let t = 1; t <= totalTeams; t++) {
      const p1 = slots.find((s) => s.seatNumber === t * 2 - 1)
      const p2 = slots.find((s) => s.seatNumber === t * 2)
      groups.push({
        teamNumber: t,
        name: SYNDICATE_NAMES[t - 1] || `Синдикат ${t}`,
        p1,
        p2,
      })
    }
    return groups
  }, [slots, isSyndicate, totalSlots])

  return (
    <div className="page-content">
      <button onClick={onBack} className="mb-5 flex items-center gap-2 text-xs text-slate-500 hover:text-white">
        ← Назад к столам
      </button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="eyebrow text-blue-400">TABLE #{tableId}</p>
          <h2 className="section-title mt-1">Ожидание игроков</h2>
        </div>
        <span className="table-status">{actualFilled}/{totalSlots} МЕСТ</span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="badge-chip"><Spade /> {table.bet.toLocaleString()} $</span>
        <span className="badge-chip badge-chip-blue">{table.mode}</span>
        <span className="badge-chip">{table.deck}</span>
        <span className="badge-chip badge-chip-blue">{table.turn_time}с / ход</span>
        {isSyndicate && <span className="badge-chip"><Shield /> Командные Синдикаты</span>}
        <span className="table-status ml-auto">{table.status === 'waiting' ? 'НАБОР ИГРОКОВ' : 'СКОРО ИГРА'}</span>
      </div>

      {/* Рулетка первенства */}
      <div className="lobby-card">
        <div className="mb-6 text-center">
          <p className="eyebrow text-slate-500">FIRST MOVE ROULETTE</p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            {isSyndicate ? 'Какой Синдикат ходит первым?' : 'Кто ходит первым?'}
          </h3>
        </div>
        <div className={`roulette ${spinning ? 'spinning' : ''}`}>
          <div className="roulette-ring">
            {rouletteItems.map((p, i) => (
              <div className="roulette-slot" key={i}>
                <DynamicAvatar initials={p.initials} color={p.color} photoUrl={p.photoUrl} size="sm" />
                <span>{p.name.replace(' (Создатель)', '').replace(' (Вы)', '')}</span>
              </div>
            ))}
          </div>
        </div>
        {winner && (
          <div className="mt-6 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3 text-center text-sm text-emerald-300">
            <Check className="mr-2 inline size-4" /> Первый ход: <strong>{winner}</strong>
          </div>
        )}
        <Button disabled={spinning || rouletteItems.length === 0} onClick={spin} className="mt-6 h-11 w-full bg-blue-500 text-white hover:bg-blue-400">
          {spinning ? 'Определяем...' : 'Крутить рулетку'} <Dices data-icon="inline-end" />
        </Button>
      </div>

      {/* Отрисовка слотов */}
      {isSyndicate ? (
        /* UI ДЛЯ СИНДИКАТА (Альянсы) */
        <div className="mt-4 space-y-2.5">
          {syndicateGroups.map((group) => (
            <div key={group.teamNumber} className="rounded-xl border border-white/10 bg-slate-900/80 p-3 shadow-md">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400">{group.name}</span>
                <span className="text-[10px] text-slate-400">
                  {group.p1 && !group.p1.isEmpty && group.p2 && !group.p2.isEmpty
                    ? 'Состав готов'
                    : 'Ожидание напарника'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[group.p1, group.p2].map((p, idx) => (
                  <div
                    key={idx}
                    className={`player-card ${p?.isEmpty ? 'opacity-40 border-dashed border-slate-700 bg-slate-900/30' : 'border-blue-500/20 bg-blue-500/[0.02]'}`}
                  >
                    <DynamicAvatar initials={p?.initials || '??'} color={p?.color || 'from-slate-700 to-slate-900'} photoUrl={p?.photoUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-white">
                        {p?.isCreator && '👑 '}
                        {p?.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {p?.isEmpty ? 'Свободно' : `Игрок ${idx + 1}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* UI ДЛЯ КЛАССИКИ */
        <div className={`mt-4 grid gap-2.5 ${totalSlots <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {slots.map((p) => (
            <div
              key={p.seatNumber}
              className={`player-card ${p.isEmpty ? 'opacity-40 border-dashed border-slate-700 bg-slate-900/30' : ''}`}
            >
              <DynamicAvatar initials={p.initials} color={p.color} photoUrl={p.photoUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white">
                  {p.isCreator && '👑 '}
                  {p.name}
                </p>
                <p className="text-[10px] text-slate-500">
                  {p.isEmpty ? 'Ожидание игрока' : `Место ${p.seatNumber} · Готов`}
                </p>
              </div>
              <div className={`ml-auto size-1.5 rounded-full ${p.isEmpty ? 'bg-slate-600' : 'bg-emerald-400'}`} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
        <Button variant="outline" onClick={onBack} className="h-11 flex-1 border-white/15 bg-white/[0.04] text-white hover:bg-white/10">
          <DoorOpen data-icon="inline-start" /> Покинуть стол
        </Button>
        <Button
          onClick={startGame}
          disabled={!canStart || gameStarting}
          className={`h-11 flex-1 ${canStart ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-slate-700 cursor-not-allowed opacity-60'} text-white`}
        >
          <Play data-icon="inline-start" />
          {gameStarting
            ? 'Запуск...'
            : isCreator
            ? canStart
              ? 'Начать игру'
              : `Нужно еще ${needMore} игрок${needMore === 1 ? 'а' : 'ов'}`
            : 'Ожидание создателя'}
        </Button>
      </div>
    </div>
  )
}