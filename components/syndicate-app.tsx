'use client'

import { useEffect, useState } from 'react'
import {
  ArrowRight,
  BadgeDollarSign,
  Bell,
  Bot,
  Check,
  ChevronRight,
  CirclePlus,
  Clock3,
  Crown,
  Dices,
  Gift,
  Gem,
  LayoutGrid,
  Medal,
  Menu,
  Package,
  Plus,
  Search,
  Shield,
  ShoppingBag,
  Spade,
  Swords,
  Trophy,
  UserRound,
  Users,
  WalletCards,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type UserData = {
  id: number
  name: string
  username: string
  initials: string
  avatarColor: string
  photoUrl?: string
  dollars: number | null
  elo: number | null
  influence: number | null
}

const defaultAvatarColors = [
  'from-sky-400 to-blue-700',
  'from-amber-300 to-orange-700',
  'from-emerald-300 to-emerald-700',
  'from-fuchsia-300 to-violet-700',
]

const tables = [
  { bet: '1,000', players: '3/6', mode: 'Переводной', deck: '36 карт', time: '30с', tone: 'blue' },
  { bet: '5,000', players: '4/4', mode: 'Подкидной', deck: '52 карты', time: '60с', tone: 'gold' },
  { bet: '250', players: '2/6', mode: 'Переводной', deck: '24 карты', time: '15с', tone: 'green' },
]

const navItems = [
  { id: 'play', label: 'Играть', icon: Swords },
  { id: 'top', label: 'Топ', icon: Trophy },
  { id: 'shop', label: 'Магазин', icon: ShoppingBag },
  { id: 'profile', label: 'Профиль', icon: UserRound },
]

type Tab = 'play' | 'top' | 'shop' | 'profile'

function DynamicAvatar({
  initials,
  color,
  photoUrl,
  size = 'md',
}: {
  initials: string
  color: string
  photoUrl?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = { sm: 'size-8 text-[10px]', md: 'size-10 text-xs', lg: 'size-24 text-2xl' }

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt="Avatar"
        className={`shrink-0 rounded-full border border-white/15 object-cover shadow-lg ${sizes[size]}`}
      />
    )
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br font-bold text-white shadow-lg ${color} ${sizes[size]}`}
    >
      {initials}
    </div>
  )
}

function Header({ user, onMenu }: { user: UserData; onMenu: () => void }) {
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

function SyndicateBanner({ onSearch, onCreate }: { onSearch: () => void; onCreate: () => void }) {
  return (
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
          <Button onClick={onSearch} className="h-11 bg-blue-500 px-5 font-semibold text-white shadow-[0_0_24px_rgba(37,99,235,.35)] hover:bg-blue-400"><Search data-icon="inline-start" /> Быстрый поиск</Button>
          <Button onClick={onCreate} variant="outline" className="h-11 border-white/15 bg-white/[0.04] px-5 text-white hover:bg-white/10"><CirclePlus data-icon="inline-start" /> Создать стол</Button>
        </div>
      </div>
      <div className="hero-mark"><Spade /></div>
    </section>
  )
}

function ActiveTables({ onJoin }: { onJoin: (table: (typeof tables)[number]) => void }) {
  return (
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
  )
}

function PlayScreen({ user, onSearch, onCreate, onJoin }: { user: UserData; onSearch: () => void; onCreate: () => void; onJoin: (table: (typeof tables)[number]) => void }) {
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
      <SyndicateBanner onSearch={onSearch} onCreate={onCreate} />
      <ActiveTables onJoin={onJoin} />
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

function FiltersModal({ mode, onClose }: { mode: 'search' | 'create'; onClose: () => void }) {
  const [bet, setBet] = useState('1,000')
  const [players, setPlayers] = useState('4')
  const [game, setGame] = useState('Переводной')
  const [deck, setDeck] = useState('36 карт')
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow text-blue-400">{mode === 'search' ? 'FIND A TABLE' : 'PRIVATE ROOM'}</p>
            <h2 id="modal-title" className="mt-1 text-xl font-semibold text-white">{mode === 'search' ? 'Настроить поиск' : 'Создать стол'}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Закрыть"><X className="size-4" /></button>
        </div>
        <div className="mt-6 grid gap-5">
          <label className="field-label">
            Размер ставки
            <div className="mt-2 flex items-center gap-3">
              <input type="range" min="100" max="100000" step="100" value={bet.replace(',', '')} onChange={(e) => setBet(Number(e.target.value).toLocaleString('en-US'))} />
              <span className="value-pill">{bet} $</span>
            </div>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="field-label">
              Игроков
              <select value={players} onChange={(e) => setPlayers(e.target.value)} className="field-select">
                {['2','4','6','8','10'].map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="field-label">
              Время хода
              <select className="field-select"><option>30 секунд</option><option>15 секунд</option><option>60 секунд</option></select>
            </label>
          </div>
          <label className="field-label">
            Тип игры
            <div className="segmented mt-2">
              {['Подкидной', 'Переводной'].map((x) => <button type="button" className={game === x ? 'active' : ''} onClick={() => setGame(x)} key={x}>{x}</button>)}
            </div>
          </label>
          <label className="field-label">
            Размер колоды
            <div className="segmented mt-2">
              {['24 карты', '36 карт', '52 карты'].map((x) => <button type="button" className={deck === x ? 'active' : ''} onClick={() => setDeck(x)} key={x}>{x}</button>)}
            </div>
          </label>
        </div>
        <Button className="mt-7 h-11 w-full bg-blue-500 text-white hover:bg-blue-400" onClick={onClose}>
          {mode === 'search' ? 'Найти столы' : 'Создать приватный стол'} <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  )
}

function TableLobby({ user, table, onBack }: { user: UserData; table: (typeof tables)[number]; onBack: () => void }) {
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

function ProfileScreen({ user }: { user: UserData }) {
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

function ShopScreen() {
  const items = [
    { name: 'Noir', type: 'Рубашка карт', icon: Spade, price: '2,400' },
    { name: 'Emerald Felt', type: 'Фон стола', icon: LayoutGrid, price: '1,800' },
    { name: 'Gold Frame', type: 'Рамка аватара', icon: Crown, price: '3,200' },
    { name: 'Syndicate Pack', type: 'Анимации', icon: Zap, price: '900' },
  ]
  return (
    <div className="page-content">
      <div className="mb-6">
        <p className="eyebrow text-amber-400">BLACK MARKET</p>
        <h2 className="section-title mt-1">Черный рынок</h2>
        <p className="mt-2 text-sm text-slate-500">Укрась свой стол. Заявляй о статусе.</p>
      </div>
      <div className="market-note">
        <Gem className="size-5 text-amber-300" />
        <div>
          <p className="text-xs font-semibold text-amber-200">Скоро в Синдикате</p>
          <p className="mt-1 text-[11px] leading-5 text-amber-200/60">Покупки за Telegram Stars и реальную валюту.</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        {items.map(({ name, type, icon: Icon, price }) => (
          <div className="product-card" key={name}>
            <div className="product-art">
              <Icon className="size-8 text-white/80" />
              <span className="product-shine" />
            </div>
            <div className="mt-3">
              <p className="text-sm font-semibold text-white">{name}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{type}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-mono text-xs text-emerald-300">{price} $</span>
                <button aria-label={`Купить ${name}`} className="buy-button"><Plus className="size-3" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TopScreen({ currentUser }: { currentUser: UserData }) {
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

export default function SyndicateApp() {
  const [tab, setTab] = useState<Tab>('play')
  const [modal, setModal] = useState<'search' | 'create' | null>(null)
  const [lobby, setLobby] = useState<(typeof tables)[number] | null>(null)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)

  const [user, setUser] = useState<UserData>({
    id: 0,
    name: 'Игрок',
    username: '@player',
    initials: 'PL',
    avatarColor: defaultAvatarColors[0],
    dollars: 99999,
    elo: null,
    influence: null,
  })

console.log('[RENDER] user state:', JSON.stringify(user))

  useEffect(() => {
    if (typeof window === 'undefined') return

    const tg = (window as any).Telegram?.WebApp

    if (!tg) {
      setLoading(false)
      return
    }

    tg.ready()
    tg.expand()

    const tgUser = tg.initDataUnsafe?.user

    // 1. Быстро подставляем имя/username из Telegram SDK, чтобы аватар и ник были сразу
    if (tgUser) {
	console.log('[TG SDK] tgUser:', JSON.stringify(tgUser))
      const fullName =
        `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() ||
        tgUser.username ||
        'Игрок'
      const initials =
        fullName
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase() || 'PL'

      setUser((prev) => ({
        ...prev,
        id: tgUser.id,
        name: fullName,
        username: tgUser.username ? `@${tgUser.username}` : '@no_username',
        initials,
        photoUrl: tgUser.photo_url || prev.photoUrl,
        avatarColor:
          defaultAvatarColors[Math.abs(tgUser.id) % defaultAvatarColors.length],
      }))
    }

    // 2. Запрос к БД. Лоадер снимаем ТОЛЬКО в finally — то есть после ответа сервера.
    if (tg.initData) {
      fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData }),
      })
        .then((res) => res.json())
        .then((data) => {
			console.log('[API RESPONSE] data:', JSON.stringify(data))
          if (data.user) {
            const fullName =
              `${data.user.first_name || ''} ${data.user.last_name || ''}`.trim() ||
              data.user.username ||
              'Игрок'
            const initials =
              fullName
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase() || 'PL'

			setUser((prev) => ({
			  ...prev,
			  id: data.user.id,
			  name: fullName,
			  username: data.user.username ? `@${data.user.username}` : '@no_username',
			  initials,
			  avatarColor:
				defaultAvatarColors[Math.abs(data.user.id) % defaultAvatarColors.length],
			  photoUrl: data.user.photo_url || prev.photoUrl,
			  dollars: data.user.dollars === 10000 ? 15000 : (data.user.dollars ?? 15000),
			  elo: data.user.elo ?? 1200,
			  influence: data.user.influence ?? 450,
			}))	
          }
        })
        .catch((err) => console.error('Auth API Error:', err))
        .finally(() => {
          // Пускаем пользователя в приложение ТОЛЬКО после ответа от БД
          setLoading(false)
        })
    } else {
      // Нет initData — не ждём бесконечно, выпускаем на экран
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const join = (table: (typeof tables)[number]) => {
    setLobby(table)
    setToast(`Стол ${table.bet} $ выбран`)
  }

// Блокируем показ приложения, ПОКА идет загрузка ИЛИ пока баланс еще NULL (не ответила БД)
  if (loading || user.dollars === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white font-mono text-sm">
        Загрузка Синдиката...
      </div>
    )
  }

  return (
    <main className="club-shell">
      <div className="club-frame">
        <Header user={user} onMenu={() => setToast('Меню профиля скоро будет доступно')} />
        {lobby ? (
          <TableLobby user={user} table={lobby} onBack={() => setLobby(null)} />
        ) : tab === 'play' ? (
          <PlayScreen user={user} onSearch={() => setModal('search')} onCreate={() => setModal('create')} onJoin={join} />
        ) : tab === 'profile' ? (
          <ProfileScreen user={user} />
        ) : tab === 'shop' ? (
          <ShopScreen />
        ) : (
          <TopScreen currentUser={user} />
        )}
        <nav className="bottom-nav" aria-label="Основная навигация">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setTab(id as Tab)
                setLobby(null)
              }}
              className={`nav-item ${tab === id ? 'active' : ''}`}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
      {modal && <FiltersModal mode={modal} onClose={() => setModal(null)} />}
      {toast && (
        <div className="toast">
          <Check className="size-4 text-emerald-400" /> {toast}
        </div>
      )}
    </main>
  )
}

export { tables }