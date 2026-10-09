import { Crown, Gem, LayoutGrid, Plus, Spade, Zap } from 'lucide-react'

export function ShopScreen() {
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