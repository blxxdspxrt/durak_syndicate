import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabase } from '@/lib/supabase'

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

    let photoUrl = null
    let debugInfo = null

    // 2. Скачивание аватарки в Base64
    try {
      const photosRes = await fetch(
        `https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${user.id}&limit=1`
      )
      const photosData = await photosRes.json()
      debugInfo = { photosData }

      if (photosData.ok && photosData.result.total_count > 0) {
        const fileId = photosData.result.photos[0][0].file_id

        const fileRes = await fetch(
          `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
        )
        const fileData = await fileRes.json()
        debugInfo.fileData = fileData

        if (fileData.ok && fileData.result.file_path) {
          const imgRes = await fetch(
            `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`
          )
          const arrayBuffer = await imgRes.arrayBuffer()
          const base64Img = Buffer.from(arrayBuffer).toString('base64')
          photoUrl = `data:image/jpeg;base64,${base64Img}`
        }
      }
    } catch (e) {
      debugInfo = { error: e.message }
    }

    // 3. РАБОТА С БД SUPABASE
    let { data: dbUser, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (selectError) {
      console.error('Supabase Select Error:', selectError)
    }

    if (!dbUser) {
      // Юзера нет -> Создаём (PostgreSQL сам установит DEFAULT = 15000)
      const insertData = {
        id: user.id,
        username: user.username || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        updated_at: new Date().toISOString(),
      }

      if (photoUrl) {
        insertData.photo_url = photoUrl
      }

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        console.error('Supabase Insert Error:', insertError)
        return NextResponse.json({ error: 'Failed to create user', details: insertError.message }, { status: 500 })
      }

      dbUser = newUser
    } else {
      // Юзер есть -> обновляем профиль
      const updateData = {
        username: user.username || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        updated_at: new Date().toISOString(),
      }

      if (photoUrl) {
        updateData.photo_url = photoUrl
      }

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id)
        .select()
        .single()

      if (updateError) {
        console.error('Supabase Update Error:', updateError)
      } else if (updatedUser) {
        dbUser = updatedUser
      }
    }

    // Защитная страховка: обновляем баланс до 15000 в БД, если нужно
    const needsBalanceFix = dbUser && (dbUser.dollars === 10000 || dbUser.dollars === null || dbUser.dollars === undefined || dbUser.elo === null || dbUser.elo === undefined || dbUser.influence === null || dbUser.influence === undefined)

    if (needsBalanceFix) {
      const fixData = {
        dollars: dbUser.dollars === 10000 || dbUser.dollars === null || dbUser.dollars === undefined ? 15000 : dbUser.dollars,
        elo: dbUser.elo === null || dbUser.elo === undefined ? 1200 : dbUser.elo,
        influence: dbUser.influence === null || dbUser.influence === undefined ? 450 : dbUser.influence,
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

    console.log('[AUTH ROUTE SUCCESS] User returned:', dbUser)

    return NextResponse.json({
      user: dbUser,
      debug: debugInfo,
    })

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}