import { Bell, Crown, Menu, Trophy, WalletCards } from 'lucide-react'
import { UserData } from '@/types'
import { DynamicAvatar } from './dynamic-avatar'

export function Header({ user, onMenu }: { user: UserData; onMenu: () => void }) {
  return (
    <header className="flex items-center justify-between border-b border-white/[0.07] px-4 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        <DynamicAvatar initials={user.initials} color={user.avatarColor} photoUrl={user.photoUrl} size="md" />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-white">{user.name}</span>
            <span className="size-1 rounded-full bg-emerald-400" />
          </div>
          <div className="mt-1 flex gap-1.5">
            <span className="badge-chip">
              <Trophy /> ELO {user.elo !== null ? user.elo : '...'}
            </span>
            <span className="badge-chip badge-chip-blue">
              <Crown /> {user.influence !== null ? user.influence : '...'}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2 sm:flex">
          <WalletCards className="size-4 text-emerald-400" />
          <span className="font-mono text-sm font-bold text-emerald-300">
            {user.dollars !== null ? user.dollars.toLocaleString() : 'Загрузка...'}
          </span>
          <span className="text-xs text-emerald-400/70">$</span>
        </div>
        <button aria-label="Уведомления" className="icon-button"><Bell className="size-4" /></button>
        <button aria-label="Меню" onClick={onMenu} className="icon-button sm:hidden"><Menu className="size-4" /></button>
      </div>
    </header>
  )
}