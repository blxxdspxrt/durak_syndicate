'use client'

import { useState } from 'react'
import { Shield, Swords, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function FiltersModal({
  mode,
  defaultGameMode = 'Синдикат',
  onClose,
  onSubmit,
}: {
  mode: 'search' | 'create'
  defaultGameMode?: string
  onClose: () => void
  onSubmit: (filters: any) => void
}) {
  const isSyndicate = defaultGameMode === 'Синдикат'
  
  const [bet, setBet] = useState(1000)
  const [players, setPlayers] = useState(4) // По дефолту 4
  const [deck, setDeck] = useState('36 карт')
  const [turnTime, setTurnTime] = useState(30)

  const allowedPlayerCounts = isSyndicate ? [4, 6] : [2, 3, 4, 6]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            {isSyndicate ? <Shield className="size-4 text-blue-400" /> : <Swords className="size-4 text-amber-400" />}
            <h3 className="text-sm font-bold text-white">
              {mode === 'create' ? `Создать стол (${defaultGameMode})` : 'Поиск столов'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="size-5" />
          </button>
        </div>

        {/* Команда / Игроки */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isSyndicate ? 'Состав (Только парами 2х2 или 3х2)' : 'Количество игроков'}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {allowedPlayerCounts.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setPlayers(count)}
                className={`h-9 rounded-xl border text-xs font-semibold transition-all ${
                  players === count
                    ? isSyndicate
                      ? 'border-blue-500 bg-blue-600/30 text-white shadow-lg shadow-blue-500/20'
                      : 'border-amber-500 bg-amber-600/30 text-white shadow-lg shadow-amber-500/20'
                    : 'border-white/10 bg-slate-950/60 text-slate-400 hover:border-white/20'
                }`}
              >
                {isSyndicate ? `${count} Игрока (${count / 2} Синдиката)` : `${count} Игрока`}
              </button>
            ))}
          </div>
        </div>

        {/* Ставка */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ставка ($)</label>
          <div className="grid grid-cols-3 gap-2">
            {[1000, 5000, 25000].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBet(b)}
                className={`h-8 rounded-lg border text-xs font-semibold ${
                  bet === b ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-white/10 bg-slate-950/60 text-slate-400'
                }`}
              >
                {b.toLocaleString()} $
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={() => {
            onSubmit({ bet, players, mode: defaultGameMode, deck, turnTime })
            onClose()
          }}
          className={`w-full h-10 font-bold text-white shadow-lg ${
            isSyndicate ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30' : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
          }`}
        >
          {mode === 'create' ? 'Создать стол' : 'Найти стол'}
        </Button>
      </div>
    </div>
  )
}