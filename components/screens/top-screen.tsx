import { Crown, Medal } from 'lucide-react'
import { UserData } from '@/types'
import { DynamicAvatar } from '../dynamic-avatar'

const defaultAvatarColors = [
  'from-sky-400 to-blue-700',
  'from-amber-300 to-orange-700',
  'from-emerald-300 to-emerald-700',
  'from-fuchsia-300 to-violet-700',
]

export function TopScreen({ currentUser }: { currentUser: UserData }) {
  return (
    <div className="page-content">
      <div className="mb-6">
        <p className="eyebrow text-amber-400">THE INNER CIRCLE</p>
        <h2 className="section-title mt-1">Лидерборд</h2>
        <p className="mt-2 text-sm text-slate-500">Лучшие игроки Синдиката за сезон.</p>
      </div>
      <div className="podium">
        <div className="podium-player second">
          <DynamicAvatar initials="MI" color="from-amber-300 to-orange-700" size="md" />
          <Medal className="medal silver" />
          <p>MisterX</p>
          <strong>1,820</strong>
        </div>
        <div className="podium-player first">
          <Crown className="crown" />
          <DynamicAvatar initials="NO" color="from-fuchsia-300 to-violet-700" size="lg" />
          <p>Nox</p>
          <strong>2,140</strong>
        </div>
        <div className="podium-player third">
          <DynamicAvatar initials="SA" color="from-emerald-300 to-emerald-700" size="md" />
          <Medal className="medal bronze" />
          <p>Sable</p>
          <strong>1,640</strong>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-2">
        {['Nox', 'MisterX', 'Sable', currentUser.name, 'Karma'].map((name, i) => (
          <div className={`leader-row ${name === currentUser.name ? 'you' : ''}`} key={name}>
            <span className="w-6 font-mono text-xs text-slate-500">0{i + 1}</span>
            <DynamicAvatar
              initials={name === currentUser.name ? currentUser.initials : name.substring(0, 2).toUpperCase()}
              color={name === currentUser.name ? currentUser.avatarColor : defaultAvatarColors[i % defaultAvatarColors.length]}
              photoUrl={name === currentUser.name ? currentUser.photoUrl : undefined}
              size="sm"
            />
            <span className="flex-1 text-xs font-medium text-white">
              {name}
              {name === currentUser.name && <span className="ml-2 text-[10px] text-blue-400">ВЫ</span>}
            </span>
            <span className="font-mono text-xs text-amber-200">
              {[2140, 1820, 1640, currentUser.elo ?? 0, 1140][i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}