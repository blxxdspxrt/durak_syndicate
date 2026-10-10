import { LucideIcon } from 'lucide-react'

export type UserData = {
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

export type Table = {
  id: string
  creator_id: number
  bet: number
  max_players: number
  current_players: number
  mode: string
  deck: string
  turn_time: number
  status: 'waiting' | 'playing' | 'in_game' | 'finished'
}

export type Stats = {
  /** Уникальные игроки, реально сидящие за активными столами (счётчик «Играет»). */
  onlinePlayers: number
  /** Столы, в которых есть хотя бы один живой игрок. */
  activeTables: number
  avgTurn: string
  multiplier: string
}

export type Tab = 'play' | 'top' | 'shop' | 'profile'

export type Card = {
  id: string
  rank: string
  suit: 's' | 'h' | 'd' | 'c'
}

export type TablePair = {
  attack: Card
  defend: Card | null
}

export type GameState = {
  table_id: string
  mode?: string
  teams?: (number | null)[]
  // Клиент больше не получает порядок колоды — только её размер
  deck?: Card[]
  deck_count?: number
  trump_card: Card | null
  trump_suit: string | null
  hands: Record<string, Card[] | { count: number }>
  table_cards: TablePair[]
  discard: Card[]
  attacker_id: number
  defender_id: number
  turn_order: number[]
  phase: 'attack' | 'defend'
  status: 'playing' | 'finished'
  turn_deadline: string | null
  winner_id: number | null
  loser_id: number | null
  winner_ids?: number[]
  loser_ids?: number[]
  first_player_id?: number
  roulette_started_at?: string
}