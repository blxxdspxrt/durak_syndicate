import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(_request, { params }) {
  try {
    const { id } = params
    const userId = Number(id)

    if (!userId) {
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
    return NextResponse.json(
      {
        id: Number(params?.id) || 0,
        username: '',
        first_name: `Игрок_${Number(params?.id) || 0}`,
        last_name: '',
        photo_url: null,
        placeholder: true,
        error: err.message,
      },
      { status: 200 }
    )
  }
}
