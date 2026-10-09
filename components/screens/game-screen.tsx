'use client'

import { useState } from 'react'
import { Shield, Spade, Heart, Diamond, Club, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserData } from '@/types'
import { DynamicAvatar } from '../dynamic-avatar'

const SUIT_ICONS: Record<string, any> = {
  s: <Spade className="size-4 text-slate-200" />,
  h: <Heart className="size-4 text-rose-500 fill-rose-500" />,
  d: <Diamond className="size-4 text-rose-500 fill-rose-500" />,
  c: <Club className="size-4 text-slate-200 fill-slate-200" />,
}

export function GameScreen({
  user,
  gameState,
  players,
  onLeave,
}: {
  user: UserData
  gameState: any
  players: any[]
  onLeave: () => void
}) {
  const [selectedCard, setSelectedCard] = useState<string | null>(null)

  const myHand = gameState?.hands?.[user.id] || []
  const trumpCard = gameState?.trump_card
  const deckCount = gameState?.deck?.length || 0

  return (
    <div className="relative flex h-[calc(100vh-80px)] flex-col justify-between overflow-hidden bg-emerald-950 p-3 select-none">
      {/* Шапка Игрового Стола */}
      <div className="z-10 flex items-center justify-between rounded-xl border border-emerald-800/40 bg-emerald-900/60 p-2.5 backdrop-blur-md">
        <button onClick={onLeave} className="flex items-center gap-1 text-xs text-emerald-300 hover:text-white">
          <ArrowLeft className="size-4" /> Выйти
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-200">КОЗЫРЬ:</span>
          {trumpCard && (
            <div className="flex items-center gap-1 rounded bg-slate-900/80 px-2 py-0.5 text-xs font-bold text-white border border-white/10">
              <span>{trumpCard.rank}</span>
              {SUIT_ICONS[trumpCard.suit]}
            </div>
          )}
        </div>
      </div>

      {/* Игровое Поле (Зеленое Сукно) */}
      <div className="relative flex flex-1 flex-col items-center justify-center my-2 rounded-3xl border-2 border-emerald-800/30 bg-gradient-to-b from-emerald-900/40 via-emerald-950 to-emerald-900/40 shadow-inner">
        {/* Соперники Вверху */}
        <div className="absolute top-3 flex gap-4">
          {players
            .filter((p) => p.user_id !== user.id)
            .map((p) => (
              <div key={p.seat_number} className="flex flex-col items-center gap-1">
                <DynamicAvatar initials={p.user?.first_name?.[0] || '?'} photoUrl={p.user?.photo_url} size="sm" />
                <span className="text-[10px] font-semibold text-emerald-200 max-w-[70px] truncate">
                  {p.user?.first_name || 'Соперник'}
                </span>
                <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[9px] text-slate-300 border border-white/10">
                  🂠 {gameState?.hands?.[p.user_id]?.length || 6}
                </span>
              </div>
            ))}
        </div>

        {/* Колода и Стол Атаки/Защиты по центру */}
        <div className="flex items-center gap-8">
          {/* Колода */}
          <div className="relative flex items-center justify-center size-16 rounded-xl border border-white/20 bg-emerald-900 shadow-2xl">
            {trumpCard && (
              <div className="absolute -left-4 top-2 flex h-12 w-8 rotate-90 items-center justify-center rounded border border-slate-700 bg-white text-black font-bold text-xs shadow-md">
                {trumpCard.rank}
              </div>
            )}
            <div className="relative z-10 text-center">
              <span className="text-xs font-black text-white">🂠</span>
              <p className="text-[10px] font-bold text-emerald-200">{deckCount}</p>
            </div>
          </div>

          {/* Зона Битых/Сыгранных Карт */}
          <div className="flex min-h-[90px] min-w-[120px] items-center justify-center rounded-2xl border border-dashed border-emerald-700/50 bg-emerald-900/20 p-2">
            <span className="text-[11px] text-emerald-600/70 font-semibold">Поле боя</span>
          </div>
        </div>
      </div>

      {/* Мой Веер Карт и Панель Действий */}
      <div className="z-10 space-y-3">
        {/* Карты на руках */}
        <div className="flex justify-center -space-x-4 overflow-x-auto py-2">
          {myHand.map((card: any) => {
            const isSelected = selectedCard === card.id
            return (
              <button
                key={card.id}
                onClick={() => setSelectedCard(card.id)}
                className={`relative flex h-24 w-16 flex-col justify-between rounded-xl border p-1.5 transition-all duration-200 shadow-xl ${
                  isSelected
                    ? '-translate-y-4 border-amber-400 bg-amber-50 shadow-amber-500/50'
                    : 'border-slate-300 bg-white hover:-translate-y-2'
                }`}
              >
                <div className="text-xs font-black text-slate-900">{card.rank}</div>
                <div className="self-center">{SUIT_ICONS[card.suit]}</div>
                <div className="self-end text-xs font-black text-slate-900">{card.rank}</div>
              </button>
            )
          })}
        </div>

        {/* Кнопки Хода */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-10 border-emerald-700 bg-emerald-900/80 text-xs font-bold text-white hover:bg-emerald-800">
            Беру
          </Button>
          <Button className="flex-1 h-10 bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white shadow-lg shadow-amber-600/20">
            Бито
          </Button>
        </div>
      </div>
    </div>
  )
}