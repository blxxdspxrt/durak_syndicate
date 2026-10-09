import { Shield, Spade, Swords, Users, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Stats, Table, UserData } from '@/types'

export function PlayScreen({
  user,
  tables,
  stats,
  gameMode = 'syndicate',
  onSearch,
  onCreate,
  onJoin,
}: {
  user: UserData
  tables: Table[]
  stats: Stats
  gameMode?: 'classic' | 'syndicate'
  onSearch: () => void
  onCreate: () => void
  onJoin: (table: Table) => void
}) {
  const isSyndicate = gameMode === 'syndicate'

  return (
    <div className="page-content space-y-5">
      {/* Шапка режима */}
      <div
        className={`relative overflow-hidden rounded-2xl p-5 border ${
          isSyndicate
            ? 'border-blue-500/30 bg-gradient-to-br from-blue-950/60 via-slate-900/80 to-indigo-950/40 shadow-blue-500/10'
            : 'border-amber-500/30 bg-gradient-to-br from-amber-950/50 via-slate-900/80 to-orange-950/30 shadow-amber-500/10'
        } shadow-2xl backdrop-blur-md`}
      >
        <div className="flex items-center justify-between">
          <div>
            <span className={`eyebrow ${isSyndicate ? 'text-blue-400' : 'text-amber-400'} flex items-center gap-1.5`}>
              {isSyndicate ? <Shield className="size-3.5" /> : <Swords className="size-3.5" />}
              {isSyndicate ? 'КОМАНДНЫЕ СРАЖЕНИЯ 2×2' : 'КЛАССИЧЕСКИЙ ДУРАК'}
            </span>
            <h1 className="mt-1 text-xl font-bold text-white tracking-tight">
              {isSyndicate ? 'Дурак Синдикат ♠️' : 'Классическая Заруба'}
            </h1>
            <p className="mt-1.5 text-xs text-slate-300 max-w-[280px] leading-relaxed">
              {isSyndicate
                ? 'Битва кланов и дуэтов. Побеждайте парой, качайте Влияние и забирайте банки Синдиката.'
                : 'Личные столы 1 на 1 или каждый сам за себя. Показывай скилл и забирай банк соперника.'}
            </p>
          </div>
        </div>

        {/* Кнопки Действий */}
        <div className="mt-5 flex gap-2.5">
          <Button
            onClick={onCreate}
            className={`flex-1 h-10 text-xs font-semibold text-white shadow-lg ${
              isSyndicate ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30' : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
            }`}
          >
            + Создать стол
          </Button>
          <Button onClick={onSearch} variant="outline" className="h-10 border-white/15 bg-white/[0.05] text-xs text-white hover:bg-white/10">
            Быстрый поиск
          </Button>
        </div>
      </div>

      {/* Статистика режима */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-2.5 backdrop-blur-sm">
          <p className="text-[10px] uppercase text-slate-400">В сети</p>
          <p className="mt-0.5 text-sm font-bold text-white">{stats.onlinePlayers} игр.</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-2.5 backdrop-blur-sm">
          <p className="text-[10px] uppercase text-slate-400">Столов</p>
          <p className="mt-0.5 text-sm font-bold text-white">{tables.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-2.5 backdrop-blur-sm">
          <p className="text-[10px] uppercase text-slate-400">Награда</p>
          <p className="mt-0.5 text-sm font-bold text-emerald-400">{isSyndicate ? '+Влияние' : stats.multiplier}</p>
        </div>
      </div>

      {/* Список доступных столов */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            {isSyndicate ? 'Доступные Синдикат-столы' : 'Классические столы'} ({tables.length})
          </h2>
        </div>

        {tables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 py-8 text-center">
            <p className="text-xs text-slate-500">
              {isSyndicate ? 'Свободных Синдикат-столов пока нет' : 'Активных классических столов нет'}
            </p>
            <button onClick={onCreate} className="mt-2 text-xs font-semibold text-blue-400 hover:underline">
              Будь первым, создай стол!
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {tables.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/80 p-3 hover:border-blue-500/40 transition-all"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{t.bet.toLocaleString()} $</span>
                    <span className="badge-chip text-[10px]">{t.mode}</span>
                    <span className="badge-chip text-[10px]">{t.deck}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">Ход: {t.turn_time}с</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-300 font-mono">
                    {t.current_players}/{t.max_players}
                  </span>
                  <Button
                    onClick={() => onJoin(t)}
                    size="sm"
                    className="h-8 bg-blue-600 text-xs hover:bg-blue-500 text-white"
                  >
                    Сесть
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}