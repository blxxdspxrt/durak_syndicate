import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(_request, context) {
  let rawId = 0
  try {
    // В Next.js App Router params является Promise
    const params = await context.params
    rawId = params?.id
    const userId = Number(rawId)

    if (!userId || isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, first_name, last_name, photo_url, dollars, elo, influence')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw error

    if (!user) {
      return NextResponse.json(
        {
          id: userId,
          username: '',
          first_name: `Игрок_${userId}`,
          last_name: '',
          photo_url: null,
          placeholder: true,
        },
        { status: 404 }
      )
    }

    return NextResponse.json({ user })
  } catch (err) {
    const fallbackId = Number(rawId) || 0
    return NextResponse.json(
      {
        id: fallbackId,
        username: '',
        first_name: `Игрок_${fallbackId}`,
        last_name: '',
        photo_url: null,
        placeholder: true,
        error: err.message,
      },
      { status: 200 }
    )
  }
}