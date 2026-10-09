import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
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

    let photoUrl: string | null = null
    let debugInfo: any = null

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
    } catch (e: any) {
      debugInfo = { error: e.message }
    }

    // 3. РАБОТА С БД СУПАБЕЙЗ (БЕЗ ХАРДКОДА В КОДЕ)
    
    // А. Проверяем, есть ли уже юзер в таблице
    let { data: dbUser, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (selectError) {
      console.error('Supabase Select Error:', selectError)
    }

    if (!dbUser) {
      // Б. Юзера НЕТ в базе -> Создаём НОВУЮ запись.
      // Поля dollars, elo, influence НЕ передаём вообще!
      // PostgreSQL сам подставит их значение по умолчанию (DEFAULT 15000) из схемы таблицы.
      const insertData: Record<string, any> = {
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
      // В. Юзер УЖЕ ЕСТЬ -> Обновляем ТОЛЬКО профильные данные (имя, username, аватар).
      // Баланс (dollars) и игровые метрики ВООБЩЕ НЕ ТРОГАЕМ.
      const updateData: Record<string, any> = {
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

    // 4. Отдаем ТОЛЬКО чистый объект из PostgreSQL
    return NextResponse.json({
      user: dbUser,
      debug: debugInfo,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}