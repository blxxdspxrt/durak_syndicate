import { useState } from 'react'
import { Check, Dices } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, UserData } from '@/types'
import { DynamicAvatar } from './dynamic-avatar'

export function TableLobby({ user, table, onBack }: { user: UserData; table: Table; onBack: () => void }) {
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState('')

  const spin = () => {
    setSpinning(true)
    setWinner('')
    window.setTimeout(() => {
      setSpinning(false)
      setWinner('MisterX')
    }, 2200)
  }

  return (
    <div className="page-content">
      <button onClick={onBack} className="mb-5 flex items-center gap-2 text-xs text-slate-500 hover:text-white">← Назад к столам</button>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="eyebrow text-blue-400">TABLE #{table.bet.replace(',', '')}</p>
          <h2 className="section-title mt-1">Ожидание игроков</h2>
        </div>
        <span className="table-status">{table.players} МЕСТ</span>
      </div>
      <div className="lobby-card">
        <div className="mb-6 text-center">
          <p className="eyebrow text-slate-500">FIRST MOVE ROULETTE</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Кто ходит первым?</h3>
        </div>
        <div className={`roulette ${spinning ? 'spinning' : ''}`}>
          <div className="roulette-ring">
            <div className="roulette-slot">
              <div className="flex -space-x-2">
                <DynamicAvatar initials="MI" color="from-amber-300 to-orange-700" size="sm" />
                <DynamicAvatar initials="SA" color="from-emerald-300 to-emerald-700" size="sm" />
              </div>
              <span>СИНДИКАТ</span>
            </div>
            <div className="roulette-slot"><DynamicAvatar initials="NO" color="from-fuchsia-300 to-violet-700" size="sm" /><span>Nox</span></div>
            <div className="roulette-slot"><DynamicAvatar initials={user.initials} color={user.avatarColor} photoUrl={user.photoUrl} size="sm" /><span>{user.name}</span></div>
            <div className="roulette-slot"><DynamicAvatar initials="SA" color="from-emerald-300 to-emerald-700" size="sm" /><span>Sable</span></div>
          </div>
        </div>
        {winner && <div className="mt-6 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3 text-center text-sm text-emerald-300"><Check className="mr-2 inline size-4" /> Первый ход: <strong>{winner}</strong></div>}
        <Button disabled={spinning} onClick={spin} className="mt-6 h-11 w-full bg-blue-500 text-white hover:bg-blue-400">
          {spinning ? 'Определяем...' : 'Крутить рулетку'} <Dices data-icon="inline-end" />
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="player-card">
          <DynamicAvatar initials={user.initials} color={user.avatarColor} photoUrl={user.photoUrl} size="sm" />
          <div>
            <p className="text-xs font-medium text-white">Вы · {user.name}</p>
            <p className="text-[10px] text-slate-500">Готов к игре</p>
          </div>
          <div className="ml-auto size-1.5 rounded-full bg-emerald-400" />
        </div>
        {[
          { name: 'MisterX', initials: 'MI', color: 'from-amber-300 to-orange-700' },
          { name: 'Sable', initials: 'SA', color: 'from-emerald-300 to-emerald-700' },
          { name: 'Nox', initials: 'NO', color: 'from-fuchsia-300 to-violet-700' },
        ].map((p) => (
          <div className="player-card" key={p.name}>
            <DynamicAvatar initials={p.initials} color={p.color} size="sm" />
            <div>
              <p className="text-xs font-medium text-white">{p.name}</p>
              <p className="text-[10px] text-slate-500">Готов к игре</p>
            </div>
            <div className="ml-auto size-1.5 rounded-full bg-emerald-400" />
          </div>
        ))}
      </div>
    </div>
  )
}