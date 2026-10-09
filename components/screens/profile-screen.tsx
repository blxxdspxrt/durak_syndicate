import { Trophy, Shield, DollarSign, Award } from 'lucide-react'
import { UserData } from '@/types'
import { DynamicAvatar } from '../dynamic-avatar'

export function ProfileScreen({
  user,
  onOpenTop,
}: {
  user: UserData
  onOpenTop: () => void
}) {
  return (
    <div className="page-content space-y-4">
      {/* Главная карточка профиля */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-4">
          <DynamicAvatar initials={user.initials} color={user.avatarColor} photoUrl={user.photoUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-white">{user.name}</h2>
            <p className="text-xs text-slate-400">{user.username}</p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
              <DollarSign className="size-3.5" /> {user.dollars?.toLocaleString()} $
            </div>
          </div>
        </div>

        {/* Переход к Топу / Рейтингу */}
        <div className="mt-6">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Статистика и Рейтинг</span>
            <button
              onClick={onOpenTop}
              className="flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 transition-all shadow-sm"
            >
              <Trophy className="size-3.5 text-amber-400" />
              <span>Рейтинг ➔</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3 text-center">
              <p className="text-[10px] uppercase text-slate-400">Рейтинг ELO</p>
              <p className="mt-1 text-sm font-bold text-blue-400 flex items-center justify-center gap-1">
                <Award className="size-3.5" /> {user.elo}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3 text-center">
              <p className="text-[10px] uppercase text-slate-400">Влияние</p>
              <p className="mt-1 text-sm font-bold text-amber-400 flex items-center justify-center gap-1">
                <Shield className="size-3.5" /> {user.influence}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}