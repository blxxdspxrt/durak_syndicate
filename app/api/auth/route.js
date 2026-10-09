import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabase } from '@/lib/supabase'

// 3-этапный каскадный метод получения аватарки
async function fetchUserAvatar(user, botToken) {
  // ---- Этап 1: Прямой URL из WebApp initData ----
  if (user && user.photo_url && typeof user.photo_url === 'string' && user.photo_url.startsWith('http')) {
    try {
      const res = await fetch(user.photo_url, { method: 'HEAD', timeout: 5000 })
      if (res.ok) {
        const full = await fetch(user.photo_url)
        if (full.ok) {
          const buffer = await full.arrayBuffer()
          if (buffer && buffer.byteLength > 0) {
            console.log('[AVATAR] Этап 1 ОК (прямой URL,', buffer.byteLength, 'байт)')
            return `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`
          }
        }
      }
    } catch (e) {
      console.warn('[AVATAR] Этап 1 не сработал (прямой URL):', e.message)
    }
  }

  // ---- Этап 2: getUserProfilePhotos через Bot API ----
  if (botToken && user && user.id) {
    try {
      const photosRes = await fetch(
        `https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${user.id}&limit=1`
      )
      const photosData = await photosRes.json()

      if (photosData.ok && photosData.result && photosData.result.total_count > 0) {
        const firstPhotoSet = photosData.result.photos[0]
        if (firstPhotoSet && firstPhotoSet.length) {
          const biggest = firstPhotoSet[firstPhotoSet.length - 1]
          const fileId = biggest.file_id

          const fileRes = await fetch(
            `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
          )
          const fileData = await fileRes.json()

          if (fileData.ok && fileData.result && fileData.result.file_path) {
            const imgRes = await fetch(
              `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`
            )
            if (imgRes.ok) {
              const buffer = await imgRes.arrayBuffer()
              if (buffer && buffer.byteLength > 0) {
                console.log('[AVATAR] Этап 2 ОК (Bot API,', buffer.byteLength, 'байт)')
                return `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[AVATAR] Этап 2 не сработал (Bot API):', e.message)
    }
  }

  // ---- Этап 3: SVG-заглушка с инициалами ----
  console.log('[AVATAR] Этап 3: fallback SVG')
  const initial = (
    (user && (user.first_name || user.username || 'U')) || 'U'
  ).charAt(0).toUpperCase()

  const palette = [
    { bg: '#1e3a8a', fg: '#dbeafe' },
    { bg: '#7c2d12', fg: '#fed7aa' },
    { bg: '#064e3b', fg: '#a7f3d0' },
    { bg: '#581c87', fg: '#e9d5ff' },
    { bg: '#831843', fg: '#fbcfe8' },
  ]
  const c = palette[Math.abs(Number(user?.id || 0)) % palette.length]

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c.bg}" stop-opacity="1"/>
        <stop offset="100%" stop-color="#0b1120" stop-opacity="1"/>
      </linearGradient>
    </defs>
    <rect width="160" height="160" rx="80" fill="url(#g)"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="${c.fg}" font-size="66" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-weight="700">${initial}</text>
  </svg>`

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { initData } = body
    const botToken = process.env.TELEGRAM_BOT_TOKEN

    if (!initData) {
      return NextResponse.json({ error: 'Missing initData' }, { status: 400 })
    }

    if (!botToken) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN is not configured on server' },
        { status: 500 }
      )
    }

    // 1. Валидация HMAC подписи Telegram
    const urlParams = new URLSearchParams(initData)
    const hash = urlParams.get('hash')
    urlParams.delete('hash')

    const dataCheckString = Array.from(urlParams.entries())
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n')

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

    if (calculatedHash !== hash) {
      return NextResponse.json({ error: 'Invalid auth signature' }, { status: 401 })
    }

    const userStr = urlParams.get('user')
    const user = userStr ? JSON.parse(userStr) : null

    if (!user || !user.id) {
      return NextResponse.json({ error: 'User data not found in initData' }, { status: 400 })
    }

    const avatarBase64 = await fetchUserAvatar(user, botToken)

    // 2. Работа с БД Supabase
    let { data: dbUser, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (selectError) {
      console.error('Supabase Select Error:', selectError)
    }

    const profileData = {
      username: user.username || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      photo_url: avatarBase64,
      updated_at: new Date().toISOString(),
    }

    if (!dbUser) {
      // Юзера нет -> создаём
      const insertData = {
        id: user.id,
        ...profileData,
      }

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        console.error('Supabase Insert Error:', insertError)
        return NextResponse.json(
          { error: 'Failed to create user', details: insertError.message },
          { status: 500 }
        )
      }

      dbUser = newUser
    } else {
      // Юзер есть -> обновляем (всегда обновляем фото + ФИО)
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(profileData)
        .eq('id', user.id)
        .select()
        .single()

      if (updateError) {
        console.error('Supabase Update Error:', updateError)
      } else if (updatedUser) {
        dbUser = updatedUser
      }
    }

    // Защитная страховка: баланс/elo/influence
    const needsFix = dbUser && (
      dbUser.dollars === 10000 ||
      dbUser.dollars === null ||
      dbUser.dollars === undefined ||
      dbUser.elo === null ||
      dbUser.elo === undefined ||
      dbUser.influence === null ||
      dbUser.influence === undefined
    )

    if (needsFix) {
      const fixData = {
        dollars:
          dbUser.dollars === 10000 || dbUser.dollars === null || dbUser.dollars === undefined
            ? 15000
            : dbUser.dollars,
        elo: dbUser.elo === null || dbUser.elo === undefined ? 1200 : dbUser.elo,
        influence:
          dbUser.influence === null || dbUser.influence === undefined ? 450 : dbUser.influence,
      }

      const { data: fixedUser, error: fixError } = await supabase
        .from('users')
        .update(fixData)
        .eq('id', user.id)
        .select()
        .single()

      if (!fixError && fixedUser) {
        dbUser = fixedUser
      } else {
        dbUser.dollars = fixData.dollars
        dbUser.elo = fixData.elo
        dbUser.influence = fixData.influence
      }
    }

    console.log('[AUTH ROUTE SUCCESS] user:', dbUser.id, dbUser.username || dbUser.first_name)

    return NextResponse.json({
      user: dbUser,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
