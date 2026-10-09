import { useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function FiltersModal({
  mode,
  onClose,
  onSubmit,
}: {
  mode: 'search' | 'create'
  onClose: () => void
  onSubmit: (filters: { bet: number; players: number; mode: string; deck: string; turnTime: number }) => void
}) {
  const [bet, setBet] = useState(1000)
  const [players, setPlayers] = useState(4)
  const [game, setGame] = useState('Переводной')
  const [deck, setDeck] = useState('36 карт')
  const [turnTime, setTurnTime] = useState(30)

  const handleAction = () => {
    onSubmit({
      bet,
      players,
      mode: game,
      deck,
      turnTime,
    })
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow text-blue-400">{mode === 'search' ? 'FIND A TABLE' : 'PRIVATE ROOM'}</p>
            <h2 id="modal-title" className="mt-1 text-xl font-semibold text-white">
              {mode === 'search' ? 'Настроить поиск' : 'Создать стол'}
            </h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Закрыть"><X className="size-4" /></button>
        </div>
        <div className="mt-6 grid gap-5">
          <label className="field-label">
            Размер ставки
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min="100"
                max="100000"
                step="100"
                value={bet}
                onChange={(e) => setBet(Number(e.target.value))}
              />
              <span className="value-pill">{bet.toLocaleString()} $</span>
            </div>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="field-label">
              Игроков
              <select value={players} onChange={(e) => setPlayers(Number(e.target.value))} className="field-select">
                {[2, 4, 6, 8, 10].map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
            <label className="field-label">
              Время хода
              <select value={turnTime} onChange={(e) => setTurnTime(Number(e.target.value))} className="field-select">
                <option value={15}>15 секунд</option>
                <option value={30}>30 секунд</option>
                <option value={60}>60 секунд</option>
              </select>
            </label>
          </div>
          <label className="field-label">
            Тип игры
            <div className="segmented mt-2">
              {['Подкидной', 'Переводной', 'Синдикат'].map((x) => (
                <button type="button" className={game === x ? 'active' : ''} onClick={() => setGame(x)} key={x}>{x}</button>
              ))}
            </div>
          </label>
          <label className="field-label">
            Размер колоды
            <div className="segmented mt-2">
              {['24 карты', '36 карт', '52 карты'].map((x) => (
                <button type="button" className={deck === x ? 'active' : ''} onClick={() => setDeck(x)} key={x}>{x}</button>
              ))}
            </div>
          </label>
        </div>
        <Button className="mt-7 h-11 w-full bg-blue-500 text-white hover:bg-blue-400" onClick={handleAction}>
          {mode === 'search' ? 'Найти столы' : 'Создать приватный стол'} <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  )
}