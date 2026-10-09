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
  bet: string
  players: string
  mode: string
  deck: string
  time: string
  tone: string
}

export type Tab = 'play' | 'top' | 'shop' | 'profile'