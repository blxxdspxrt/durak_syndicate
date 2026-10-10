'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Spade, Heart, Diamond, Club, ArrowLeft, Clock, Hand, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserData } from '@/types'
import { DynamicAvatar } from '../dynamic-avatar'
import { getInitData } from '@/lib/telegram-client'

const SUIT_ICONS: Record<string, any> = {
  s: <Spade className="size-4 text-slate-200" />,
  h: <Heart className="size-4 text-rose-500 fill-rose-500" />,
  d: <Diamond className="size-4 text-rose-500 fill-rose-500" />,
  c: <Club className="size-4 text-slate-200 fill-slate-200" />,
}

const SUIT_SMALL: Record<string, any> = {
  s: <Spade className="size-3 text-slate-800" />,
  h: <Heart className="size-3 text-rose-600 fill-rose-600" />,
  d: <Diamond className="size-3 text-rose-600 fill-rose-600" />,
  c: <Club className="size-3 text-slate-800 fill-slate-800" />,
}

function CardFace({ card, small }: { card: any; small?: boolean }) {
  if (!card) return null
  const isRed = card.suit === 'h' || card.suit === 'd'
  return (
    <div
      className={`flex flex-col justify-between rounded-lg border bg-white shadow-md ${
        small ? 'h-14 w-10 p-1' : 'h-24 w-16 p-1.5'
      } ${isRed ? 'border-rose-200' : 'border-slate-300'}`}
    >
      <div className={`font-black ${small ? 'text-[10px]' : 'text-xs'} ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
        {card.rank}
      </div>
      <div className="self-center">{small ? SUIT_SMALL[card.suit] : SUIT_ICONS[card.suit]}</div>
      <div className={`self-end font-black ${small ? 'text-[10px]' : 'text-xs'} ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
        {card.rank}
      </div>
    </div>
  )
}

function CardBack({ small }: { small?: boolean }) {
  return (
    <div
      className={`rounded-lg border border-blue-900/60 bg-gradient-to-br from-blue-800 to-indigo-950 shadow-md ${
        small ? 'h-14 w-10' : 'h-24 w-16'
      }`}
    />
  )
}

export function GameScreen({
  user,
  gameState,
  players,
  onLeave,
  onRefresh,
}: {
  user: UserData
  gameState: any
  players: any[]
  onLeave: () => void
  onRefresh?: () => void
}) {
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const [showRoulette, setShowRoulette] = useState(false)
  const [rouletteWinner, setRouletteWinner] = useState<number | null>(null)
  const rouletteShownRef = useRef<string | null>(null)

  const myHand = gameState?.hands?.[user.id] || []
  const trumpCard = gameState?.trump_card
  const deckCount = gameState?.deck_count ?? gameState?.deck?.length ?? 0
  const tableCards = gameState?.table_cards || []
  const attackerId = Number(gameState?.attacker_id)
  const defenderId = Number(gameState?.defender_id)
  const phase = tableCards.length === 0 ? 'attack' : 'defend'
  const isAttacker = attackerId === user.id
  const isDefender = defenderId === user.id
  const finished = gameState?.status === 'finished'

  // Таймер хода
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(t)
  }, [])

  const secondsLeft = useMemo(() => {
    if (!gameState?.turn_deadline) return null
    const diff = new Date(gameState.turn_deadline).getTime() - now
    return Math.max(0, Math.ceil(diff / 1000))
  }, [gameState?.turn_deadline, now])

  // Авто-таймаут: если время вышло — просим сервер применить действие
  useEffect(() => {
    if (finished || secondsLeft === null || secondsLeft > 0) return
    fetch('/api/games/timeout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: gameState.table_id, userId: user.id, initData: getInitData() }),
    })
      .then(() => onRefresh?.())
      .catch(() => {})
  }, [secondsLeft, finished, gameState?.table_id])

  // Рулетка первенства: показываем один раз при старте
  useEffect(() => {
    const startedAt = gameState?.roulette_started_at
    if (!startedAt || !gameState?.first_player_id) return
    if (rouletteShownRef.current === startedAt) return
    rouletteShownRef.current = startedAt
    setShowRoulette(true)
    setRouletteWinner(null)
    const t = window.setTimeout(() => {
      setRouletteWinner(Number(gameState.first_player_id))
      window.setTimeout(() => setShowRoulette(false), 2200)
    }, 2200)
    return () => window.clearTimeout(t)
  }, [gameState?.roulette_started_at, gameState?.first_player_id])

  const sendMove = async (action: string, payload: any = {}) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/games/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: gameState.table_id,
          userId: user.id,
          action,
          initData: getInitData(),
          ...payload,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Ход отклонён')
        setSelectedCard(null)
      } else {
        setSelectedCard(null)
        onRefresh?.()
      }
    } catch (e: any) {
      setError('Ошибка сети')
    } finally {
      setBusy(false)
    }
  }

  // Перевод доступен защитнику в режиме «Переводной», когда на столе
  // только неотбитые карты одного ранга и есть такая же карта в руке.
  const transferRank =
    tableCards.length > 0 &&
    tableCards.every((p: any) => p.attack && !p.defend) &&
    tableCards.every((p: any) => p.attack.rank === tableCards[0].attack.rank)
      ? tableCards[0].attack.rank
      : null

  const transferEligible =
    gameState?.mode === 'Переводной' &&
    isDefender &&
    phase === 'defend' &&
    transferRank !== null &&
    myHand.some((c: any) => c.rank === transferRank) &&
    !finished

  const handleCardClick = (card: any) => {
    if (finished || busy) return

    // Защитник: если доступен перевод, сначала выбираем карту и ждём кнопку
    if (isDefender && phase === 'defend') {
      if (transferEligible) {
        setSelectedCard(card.id)
        return
      }
      const idx = tableCards.findIndex((p: any) => p.attack && !p.defend)
      if (idx === -1) return
      setSelectedCard(card.id)
      sendMove('defend', { card, targetPairIndex: idx })
      return
    }

    // Атакующий/подкидывающий кладёт карту
    setSelectedCard(card.id)
    sendMove('attack', { card })
  }

  const handleDefendSelected = () => {
    const card = myHand.find((c: any) => c.id === selectedCard)
    if (!card) return
    const idx = tableCards.findIndex((p: any) => p.attack && !p.defend)
    if (idx === -1) return
    sendMove('defend', { card, targetPairIndex: idx })
  }

  const handleTransfer = () => {
    const card = myHand.find((c: any) => c.id === selectedCard)
    if (!card) return
    sendMove('transfer', { card })
  }

  const handleTake = () => sendMove('take')
  const handleBito = () => sendMove('bito')

  // Роль текущего игрока
  let roleLabel = 'Ожидание'
  let roleColor = 'text-slate-400'
  if (finished) {
    roleLabel = gameState?.loser_id === user.id ? 'Вы проиграли' : 'Вы победили!'
    roleColor = gameState?.loser_id === user.id ? 'text-rose-400' : 'text-emerald-400'
  } else if (isDefender) {
    roleLabel = 'Вы защищаетесь'
    roleColor = 'text-rose-400'
  } else if (isAttacker && phase === 'attack') {
    roleLabel = 'Вы ходите'
    roleColor = 'text-amber-400'
  } else if (phase === 'defend') {
    roleLabel = 'Можете подкинуть'
    roleColor = 'text-blue-400'
  } else {
    roleLabel = 'Ожидание хода'
    roleColor = 'text-slate-400'
  }

  const canTake = isDefender && phase === 'defend' && !finished
  const canBito = !isDefender && phase === 'defend' && tableCards.every((p: any) => p.defend) && !finished

  const opponents = players.filter((p) => Number(p.user_id) !== user.id)

  const playerRole = (uid: number) => {
    if (finished) return null
    if (uid === defenderId) return 'defend'
    if (uid === attackerId && phase === 'attack') return 'attack'
    if (phase === 'defend' && uid !== defenderId) return 'add'
    return null
  }

  return (
    <div className="relative flex h-[calc(100vh-80px)] flex-col justify-between overflow-hidden bg-emerald-950 p-3 select-none">
      {/* Шапка стола */}
      <div className="z-10 flex items-center justify-between rounded-xl border border-emerald-800/40 bg-emerald-900/60 p-2.5 backdrop-blur-md">
        <button onClick={onLeave} className="flex items-center gap-1 text-xs text-emerald-300 hover:text-white">
          <ArrowLeft className="size-4" /> Выйти
        </button>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-emerald-200">КОЗЫРЬ</span>
            {trumpCard && (
              <div className="flex items-center gap-1 rounded bg-slate-900/80 px-2 py-0.5 text-xs font-bold text-white border border-white/10">
                <span>{trumpCard.rank}</span>
                {SUIT_ICONS[trumpCard.suit]}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 rounded bg-slate-900/80 px-2 py-0.5 text-xs font-bold text-white border border-white/10">
            🂠 {deckCount}
          </div>
          {secondsLeft !== null && !finished && (
            <div
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold border ${
                secondsLeft <= 5
                  ? 'border-rose-500/40 bg-rose-500/20 text-rose-300 animate-pulse'
                  : 'border-white/10 bg-slate-900/80 text-white'
              }`}
            >
              <Clock className="size-3" /> {secondsLeft}с
            </div>
          )}
        </div>
      </div>

      {/* Игровое поле */}
      <div className="relative flex flex-1 flex-col items-center justify-center my-2 rounded-3xl border-2 border-emerald-800/30 bg-gradient-to-b from-emerald-900/40 via-emerald-950 to-emerald-900/40 shadow-inner">
        {/* Соперники */}
        <div className="absolute top-3 flex flex-wrap justify-center gap-4 px-2">
          {opponents.map((p) => {
            const role = playerRole(Number(p.user_id))
            const count = gameState?.hands?.[p.user_id]?.count ?? gameState?.hands?.[p.user_id]?.length ?? 0
            return (
              <div key={p.seat_number} className="flex flex-col items-center gap-1">
                <div
                  className={`rounded-full p-0.5 transition-all ${
                    role === 'defend'
                      ? 'ring-2 ring-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.7)]'
                      : role === 'attack'
                      ? 'ring-2 ring-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.7)]'
                      : role === 'add'
                      ? 'ring-2 ring-blue-400 shadow-[0_0_14px_rgba(96,165,250,0.6)]'
                      : 'ring-1 ring-white/10'
                  }`}
                >
                  <DynamicAvatar
                    initials={p.user?.first_name?.[0] || '?'}
                    color="from-slate-600 to-slate-800"
                    photoUrl={p.user?.photo_url}
                    size="sm"
                  />
                </div>
                <span className="text-[10px] font-semibold text-emerald-200 max-w-[70px] truncate">
                  {p.user?.first_name || 'Соперник'}
                </span>
                <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[9px] text-slate-300 border border-white/10">
                  🂠 {count}
                </span>
                {role && (
                  <span
                    className={`text-[8px] font-bold uppercase ${
                      role === 'defend' ? 'text-rose-400' : role === 'attack' ? 'text-amber-400' : 'text-blue-400'
                    }`}
                  >
                    {role === 'defend' ? 'Отбивается' : role === 'attack' ? 'Ходит' : 'Подкидывает'}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Колода + Поле боя */}
        <div className="flex items-center gap-6">
          {/* Колода */}
          <div className="relative flex items-center justify-center">
            {deckCount > 0 ? (
              <div className="relative">
                <CardBack small />
                {trumpCard && (
                  <div className="absolute -left-3 top-1 rotate-90">
                    <CardFace card={trumpCard} small />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-14 w-10 items-center justify-center rounded-lg border border-dashed border-emerald-700/50 text-[9px] text-emerald-600">
                пусто
              </div>
            )}
          </div>

          {/* Поле боя */}
          <div className="flex min-h-[100px] min-w-[140px] flex-wrap items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-700/50 bg-emerald-900/20 p-3">
            {tableCards.length === 0 ? (
              <span className="text-[11px] text-emerald-600/70 font-semibold">Поле боя</span>
            ) : (
              tableCards.map((pair: any, i: number) => (
                <div key={i} className="relative">
                  <CardFace card={pair.attack} small />
                  {pair.defend && (
                    <div className="absolute left-3 top-3">
                      <CardFace card={pair.defend} small />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Статус роли */}
        <div className={`absolute bottom-3 text-sm font-bold ${roleColor}`}>{roleLabel}</div>
      </div>

      {/* Моя рука и действия */}
      <div className="z-10 space-y-3">
        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-center text-[11px] text-rose-300">
            {error}
          </div>
        )}

        <div className="flex justify-center -space-x-4 overflow-x-auto py-2">
          {myHand.map((card: any) => {
            const isSelected = selectedCard === card.id
            return (
              <button
                key={card.id}
                onClick={() => handleCardClick(card)}
                disabled={busy || finished}
                className={`relative transition-all duration-200 ${
                  isSelected ? '-translate-y-4' : 'hover:-translate-y-2'
                } disabled:opacity-60`}
              >
                <CardFace card={card} />
              </button>
            )
          })}
          {myHand.length === 0 && (
            <span className="py-8 text-xs text-emerald-600">У вас нет карт</span>
          )}
        </div>

        {transferEligible && (
          <div className="flex gap-2">
            <Button
              onClick={handleDefendSelected}
              disabled={!selectedCard || busy}
              variant="outline"
              className="flex-1 h-10 border-blue-700 bg-blue-900/80 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-40"
            >
              Отбить выбранной
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={!selectedCard || busy}
              className="flex-1 h-10 bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white disabled:opacity-40"
            >
              Перевод
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleTake}
            disabled={!canTake || busy}
            variant="outline"
            className="flex-1 h-10 border-emerald-700 bg-emerald-900/80 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-40"
          >
            <Hand className="size-4" /> Беру
          </Button>
          <Button
            onClick={handleBito}
            disabled={!canBito || busy}
            className="flex-1 h-10 bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white shadow-lg shadow-amber-600/20 disabled:opacity-40"
          >
            <Check className="size-4" /> Бито
          </Button>
        </div>
      </div>

      {/* Оверлей рулетки первенства */}
      {showRoulette && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-blue-400">Определяем первого игрока</p>
          <div className={`roulette ${rouletteWinner === null ? 'spinning' : ''}`}>
            <div className="roulette-ring">
              {players.map((p, i) => (
                <div className="roulette-slot" key={i}>
                  <DynamicAvatar
                    initials={p.user?.first_name?.[0] || '?'}
                    color="from-slate-600 to-slate-800"
                    photoUrl={p.user?.photo_url}
                    size="sm"
                  />
                  <span>{p.user?.first_name || `Игрок ${i + 1}`}</span>
                </div>
              ))}
            </div>
          </div>
          {rouletteWinner !== null && (
            <div className="mt-6 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3 text-center text-sm text-emerald-300">
              <Check className="mr-2 inline size-4" /> Первым ходит:{' '}
              <strong>
                {players.find((p) => Number(p.user_id) === rouletteWinner)?.user?.first_name || 'Игрок'}
              </strong>
            </div>
          )}
        </div>
      )}

      {/* Оверлей завершения игры */}
      {finished && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm">
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 text-center">
            <h2 className={`text-xl font-bold ${gameState?.loser_id === user.id ? 'text-rose-400' : 'text-emerald-400'}`}>
              {gameState?.loser_id === user.id ? 'Вы проиграли 😔' : 'Победа! 🎉'}
            </h2>
            <p className="mt-2 text-xs text-slate-400">Игра завершена</p>
            <Button onClick={onLeave} className="mt-4 h-10 bg-blue-600 text-white hover:bg-blue-500">
              Вернуться в лобби
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}