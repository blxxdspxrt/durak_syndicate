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

  const slots = useMemo<Slot[]>(() => {
    const result: Slot[] = []
    const hasRealPlayers = Array.isArray(players) && players.length > 0
    const expectedFilled = Math.max(table.current_players || 0, isCreator ? 1 : 1)

    if (hasRealPlayers) {
      const playerBySeat = new Map<number, LobbyPlayer>()
      for (const p of players) {
        if (p && typeof p.seat_number === 'number') {
          playerBySeat.set(p.seat_number, p)
        }
      }

      let currentUserAdded = false
      let creatorAdded = false

      for (let i = 1; i <= totalSlots; i++) {
        const p = playerBySeat.get(i)
        if (p) {
          const u = p.user
          const userId = p.user_id ?? u?.id ?? null
          const isCurrentUser = userId === user.id
          const thisIsCreator = userId === table.creator_id || (isCreator && isCurrentUser && i === 1)

          let name = `Игрок ${i}`
          let initials = `И${i}`
          let photoUrl: string | undefined
          let color = placeholderColors[(i - 1) % placeholderColors.length]

          if (u) {
            const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
            if (full) name = full
            else if (u.username) name = u.username
            initials = name.split(' ').map((x) => x[0]).join('').substring(0, 2).toUpperCase() || `И${i}`
            photoUrl = u.photo_url || undefined
            if (userId) color = placeholderColors[Math.abs(Number(userId)) % placeholderColors.length]
          } else if (userId) {
            color = placeholderColors[Math.abs(Number(userId)) % placeholderColors.length]
          }

          if (isCurrentUser) {
            name = user.name
            initials = user.initials
            color = user.avatarColor
            photoUrl = user.photoUrl
            currentUserAdded = true
          }

          if (thisIsCreator) creatorAdded = true

          result.push({
            name: thisIsCreator ? `${name} (Создатель)` : isCurrentUser ? `${name} (Вы)` : name,
            initials,
            color,
            photoUrl,
            isUser: isCurrentUser,
            isEmpty: !userId,
            isCreator: thisIsCreator,
            seatNumber: i,
            team: p.team || (isSyndicate ? (i % 2 === 1 ? 1 : 2) : 1),
          })
        } else {
          result.push({
            name: 'Свободное место',
            initials: '??',
            color: 'from-slate-500 to-slate-700',
            isUser: false,
            isEmpty: true,
            isCreator: false,
            seatNumber: i,
            team: isSyndicate ? (i % 2 === 1 ? 1 : 2) : 1,
          })
        }
      }

      if (!currentUserAdded) {
        for (let i = 0; i < result.length; i++) {
          if (result[i].isEmpty) {
            result[i] = {
              ...result[i],
              name: `${user.name} (Вы)`,
              initials: user.initials,
              color: user.avatarColor,
              photoUrl: user.photoUrl,
              isUser: true,
              isEmpty: false,
            }
            break
          }
        }
      }

      if (isCreator && !creatorAdded) {
        for (let i = 0; i < result.length; i++) {
          if (result[i].isUser) {
            result[i] = { ...result[i], isCreator: true, name: result[i].name.replace(' (Вы)', '') + ' (Создатель)' }
            break
          }
        }
      }

      return result
    }

    const currentFilled = Math.min(expectedFilled, totalSlots)
    for (let i = 1; i <= totalSlots; i++) {
      const isFilled = i <= currentFilled
      const seatIsCreator = isCreator && i === 1
      const seatIsCurrentUser = seatIsCreator || (!isCreator && i === 2) || i === 1

      if (isFilled) {
        if (seatIsCurrentUser) {
          result.push({
            name: seatIsCreator ? `${user.name} (Создатель)` : `${user.name} (Вы)`,
            initials: user.initials,
            color: user.avatarColor,
            photoUrl: user.photoUrl,
            isUser: true,
            isEmpty: false,
            isCreator: seatIsCreator,
            seatNumber: i,
            team: isSyndicate ? (i % 2 === 1 ? 1 : 2) : 1,
          })
        } else {
          const idx = i - 2
          const name = placeholderNames[idx % placeholderNames.length]
          result.push({
            name,
            initials: name.substring(0, 2).toUpperCase(),
            color: placeholderColors[(i) % placeholderColors.length],
            isUser: false,
            isEmpty: false,
            isCreator: false,
            seatNumber: i,
            team: isSyndicate ? (i % 2 === 1 ? 1 : 2) : 1,
          })
        }
      } else {
        result.push({
          name: 'Свободное место',
          initials: '??',
          color: 'from-slate-500 to-slate-700',
          isUser: false,
          isEmpty: true,
          isCreator: false,
          seatNumber: i,
          team: isSyndicate ? (i % 2 === 1 ? 1 : 2) : 1,
        })
      }
    }
    return result
  }, [players, table, user, isCreator, totalSlots, isSyndicate])

  const actualFilled = slots.filter((s) => !s.isEmpty).length
  const minPlayers = isSyndicate ? 4 : 2
  const canStart = isCreator && actualFilled >= minPlayers

  const rouletteItems = slots.filter((s) => !s.isEmpty).slice(0, 4)
  while (rouletteItems.length < 4) {
    const idx = rouletteItems.length
    rouletteItems.push({
      name: `Слот ${idx + 1}`,
      initials: `S${idx + 1}`,
      color: placeholderColors[idx % placeholderColors.length],
      isUser: false,
      isEmpty: true,
      isCreator: false,
      seatNumber: 0,
      team: 1,
    })
  }

  const spin = () => {
    setSpinning(true)
    setWinner('')
    window.setTimeout(() => {
      setSpinning(false)
      const active = slots.filter((s) => !s.isEmpty)
      const w = active[Math.floor(Math.random() * active.length)]
      setWinner(w.name.replace(' (Вы)', '').replace(' (Создатель)', ''))
    }, 2200)
  }

  const startGame = () => {
    setGameStarting(true)
    setTimeout(() => setGameStarting(false), 1500)
  }

  const tableId = String(table.id).substring(0, 8).toUpperCase()
  const needMore = Math.max(0, minPlayers - actualFilled)

  return (
    <div className="page-content">
      <button onClick={onBack} className="mb-5 flex items-center gap-2 text-xs text-slate-500 hover:text-white">← Назад к столам</button>
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
        {isSyndicate && (
          <span className="badge-chip"><Shield /> Командный 2×2</span>
        )}
        <span className="table-status ml-auto">{table.status === 'waiting' ? 'НАБОР ИГРОКОВ' : 'СКОРО ИГРА'}</span>
      </div>

      {isSyndicate && (
        <div className="mb-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5 text-center">
            <span className="eyebrow text-blue-400">🔵 КОМАНДА 1</span>
          </div>
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-2.5 text-center">
            <span className="eyebrow text-rose-400">🔴 КОМАНДА 2</span>
          </div>
        </div>
      )}

      <div className="lobby-card">
        <div className="mb-6 text-center">
          <p className="eyebrow text-slate-500">FIRST MOVE ROULETTE</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Кто ходит первым?</h3>
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
        {winner && <div className="mt-6 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3 text-center text-sm text-emerald-300"><Check className="mr-2 inline size-4" /> Первый ход: <strong>{winner}</strong></div>}
        <Button disabled={spinning} onClick={spin} className="mt-6 h-11 w-full bg-blue-500 text-white hover:bg-blue-400">
          {spinning ? 'Определяем...' : 'Крутить рулетку'} <Dices data-icon="inline-end" />
        </Button>
      </div>

      <div className={`mt-4 grid gap-2.5 ${isSyndicate ? 'grid-cols-2' : totalSlots <= 4 ? 'grid-cols-2' : totalSlots <= 6 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {slots.map((p) => (
          <div
            className={`player-card ${p.isEmpty ? 'opacity-40' : ''} ${
              isSyndicate
                ? p.team === 1
                  ? 'border-blue-500/20 bg-blue-500/[0.02]'
                  : 'border-rose-500/20 bg-rose-500/[0.02]'
                : ''
            }`}
            key={p.seatNumber}
          >
            <DynamicAvatar initials={p.initials} color={p.color} photoUrl={p.photoUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">
                {p.isCreator && '👑 '}
                {p.name}
              </p>
              <p className="text-[10px] text-slate-500">
                {p.isEmpty
                  ? 'Ожидание игрока'
                  : isSyndicate
                  ? `Команда ${p.team} · Место ${p.seatNumber}`
                  : `Место ${p.seatNumber} · Готов`}
              </p>
            </div>
            <div className={`ml-auto size-1.5 rounded-full ${p.isEmpty ? 'bg-slate-500' : 'bg-emerald-400'}`} />
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
        <Button variant="outline" onClick={onBack} className="h-11 flex-1 border-white/15 bg-white/[0.04] text-white hover:bg-white/10">
          <DoorOpen data-icon="inline-start" /> Покинуть стол
        </Button>
        <Button
          onClick={startGame}
          disabled={!canStart || gameStarting}
          className={`h-11 flex-1 ${canStart ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-slate-600 cursor-not-allowed opacity-70'} text-white`}
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

const placeholderNames = ['Игрок_Alpha', 'Игрок_Beta', 'Игрок_Gamma', 'Игрок_Delta', 'Игрок_Epsilon', 'Игрок_Zeta']
