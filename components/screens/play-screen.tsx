import { ArrowRight, CirclePlus, Clock3, LayoutGrid, Search, Spade, Users, WalletCards, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, UserData } from '@/types'

export function PlayScreen({
  user,
  tables,
  onSearch,
  onCreate,
  onJoin,
}: {
  user: UserData
  tables: Table[]
  onSearch: () => void
  onCreate: () => void
  onJoin: (table: Table) => void
}) {
  return (
    <div className="page-content">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="eyebrow text-blue-400">THE UNDERGROUND CLUB</p>
          <h2 className="section-title mt-1">Добрый вечер, <span className="text-slate-400">{user.name}</span></h2>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-2 sm:hidden">
          <WalletCards className="size-3.5 text-emerald-400" />
          <span className="font-mono text-xs font-bold text-emerald-300">
            {user.dollars !== null ? `${user.dollars.toLocaleString()} $` : 'Загрузка...'}
          </span>
        </div>
      </div>

      {/* Syndicate Banner */}
      <section className="syndicate-hero relative overflow-hidden rounded-2xl border border-blue-400/20 p-5 sm:p-7">
        <div className="hero-grid" />
        <div className="relative z-10 max-w-xl">
          <div className="mb-4 flex items-center gap-2">
            <span className="live-dot" />
            <span className="eyebrow text-blue-300">ФЛАГМАНСКИЙ РЕЖИМ</span>
            <span className="ml-auto rounded-md border border-blue-300/20 bg-blue-300/10 px-2 py-1 font-mono text-[10px] text-blue-200">2 × 2</span>
          </div>
          <h1 className="font-display text-3xl font-semibold leading-none tracking-tight text-white sm:text-4xl">СИНДИКАТ</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">Командный бой 2×2. Играй в связке с напарником — видишь его карты, но подкидывать нельзя.</p>
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <Button onClick={onSearch} className="h-11 bg-blue-500 px-5 font-semibold text-white hover:bg-blue-400"><Search data-icon="inline-start" /> Быстрый поиск</Button>
            <Button onClick={onCreate} variant="outline" className="h-11 border-white/15 bg-white/[0.04] px-5 text-white hover:bg-white/10"><CirclePlus data-icon="inline-start" /> Создать стол</Button>
          </div>
        </div>
        <div className="hero-mark"><Spade /></div>
      </section>

      {/* Active Tables */}
      <section className="mt-7">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="eyebrow text-slate-500">LIVE NOW</p>
            <h2 className="section-title">Активные столы</h2>
          </div>
          <button className="text-xs font-medium text-blue-400 hover:text-blue-300">Все столы <ArrowRight className="ml-1 inline size-3" /></button>
        </div>
        <div className="flex flex-col gap-2.5">
          {tables.map((table) => (
            <div className="table-row" key={table.bet}>
              <div className={`table-icon tone-${table.tone}`}><Spade /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-white">{table.bet} $</span>
                  <span className="table-status">ОТКРЫТ</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-slate-500">
                  <span>{table.players} игроков</span><span>•</span><span>{table.mode}</span><span>•</span><span>{table.deck}</span><span>•</span><span>{table.time}</span>
                </div>
              </div>
              <Button onClick={() => onJoin(table)} size="sm" variant="outline" className="border-white/10 bg-white/[0.03] text-xs text-slate-200 hover:border-blue-400/40 hover:bg-blue-400/10">Войти</Button>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          ['12', 'игр онлайн', Users],
          ['24', 'карты в колоде', LayoutGrid],
          ['30с', 'средний ход', Clock3],
          ['x2.4', 'множитель банка', Zap],
        ].map(([value, label, Icon]) => (
          <div className="stat-tile" key={String(label)}>
            <Icon className="size-4 text-slate-600" />
            <p className="mt-3 font-mono text-lg font-bold text-white">{value as string}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">{label as string}</p>
          </div>
        ))}
      </section>
    </div>
  )
}