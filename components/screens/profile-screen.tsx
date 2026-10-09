import { Crown, Swords, Trophy } from 'lucide-react'
import { UserData } from '@/types'
import { DynamicAvatar } from '../dynamic-avatar'

export function ProfileScreen({ user }: { user: UserData }) {
  return (
    <div className="page-content">
      <div className="profile-hero">
        <div className="flex items-center gap-4">
          <DynamicAvatar initials={user.initials} color={user.avatarColor} photoUrl={user.photoUrl} size="lg" />
          <div>
            <p className="eyebrow text-blue-400">PLAYER PROFILE</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">{user.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{user.username}</p>
            <p className="mt-1 font-mono text-sm text-emerald-300">
              {user.dollars !== null ? `${user.dollars.toLocaleString()} $` : 'Загрузка...'}{' '}
              <span className="text-slate-500">баланс</span>
            </p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <div className="rating-box">
            <Trophy />
            <span>ELO<strong>{user.elo !== null ? user.elo : '...'}</strong></span>
          </div>
          <div className="rating-box rating-blue">
            <Crown />
            <span>ВЛИЯНИЕ<strong>{user.influence !== null ? user.influence : '...'}</strong></span>
          </div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-2.5">
        {[
          ['68%', 'Винрейт'],
          ['124', 'Матчей'],
          ['7', 'Серия'],
        ].map(([x, y]) => (
          <div className="stat-tile text-center" key={y}>
            <p className="font-mono text-xl font-bold text-white">{x}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{y}</p>
          </div>
        ))}
      </div>
      <section className="mt-7">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="eyebrow text-slate-500">RECENT ACTIVITY</p>
            <h2 className="section-title">История матчей</h2>
          </div>
          <span className="text-xs text-slate-500">10 игр</span>
        </div>
        <div className="history-list">
          {['+150 $', '+80$', '-1,000 $', '+350$'].map((amount, i) => (
            <div className="history-row" key={i}>
              <div className={`history-icon ${amount.startsWith('+') ? 'win' : 'loss'}`}>{amount.startsWith('+') ? <Trophy /> : <Swords />}</div>
              <div className="flex-1">
                <p className="text-xs font-medium text-white">{i % 2 === 0 ? 'Синдикат 2×2' : 'Переводной стол'}</p>
                <p className="mt-1 text-[10px] text-slate-500">Сегодня, {14 - i}:2{i} · {amount.startsWith('+') ? 'Победа' : 'Поражение'}</p>
              </div>
              <div className="text-right">
                <p className={`font-mono text-sm font-semibold ${amount.startsWith('+') ? 'text-emerald-300' : 'text-rose-300'}`}>{amount}</p>
                <p className="mt-1 text-[10px] text-slate-500">ELO {amount.startsWith('+') ? '+12' : '-18'}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}