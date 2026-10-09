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
  status: 'waiting' | 'playing' | 'finished'
}

export type Stats = {
  onlinePlayers: number
  activeTables: number
  avgTurn: string
  multiplier: string
}

export type Tab = 'play' | 'top' | 'shop' | 'profile'