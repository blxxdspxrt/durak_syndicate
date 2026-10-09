import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    const { initData } = body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!initData) {
      return NextResponse.json({ error: 'Missing initData' }, { status: 400 });
    }

    // 1. HMAC Валидация
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');

    const dataCheckString = Array.from(urlParams.entries())
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
      return NextResponse.json({ error: 'Invalid auth signature' }, { status: 401 });
    }

    const userStr = urlParams.get('user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (!user || !user.id) {
      return NextResponse.json({ error: 'User data not found' }, { status: 400 });
    }

    let photoUrl = null;

    // 2. Получение фото профиля из Telegram
    try {
      const photosRes = await fetch(
        `https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${user.id}&limit=1`
      );
      const photosData = await photosRes.json();

      if (photosData.ok && photosData.result.total_count > 0) {
        const fileId = photosData.result.photos[0][0].file_id;
        const fileRes = await fetch(
          `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
        );
        const fileData = await fileRes.json();

        if (fileData.ok && fileData.result.file_path) {
          const imgRes = await fetch(
            `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`
          );
          const arrayBuffer = await imgRes.arrayBuffer();
          const base64Img = Buffer.from(arrayBuffer).toString('base64');
          photoUrl = `data:image/jpeg;base64,${base64Img}`;
        }
      }
    } catch (e) {
      console.error('Error fetching photo:', e);
    }

    // 3. Формируем объект Тлько с тем, что нужно обновлять
    const updateData = {
      id: user.id,
      username: user.username || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      updated_at: new Date().toISOString(),
    };

    // Обновляем фото только если удалось скачать новое
    if (photoUrl) {
      updateData.photo_url = photoUrl;
    }

    // Выполняем upsert. Никаких dollars/elo/influence здесь НЕТ!
    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .upsert(updateData, { onConflict: 'id' })
      .select()
      .single();

    if (dbError) {
      console.error('Supabase DB Error:', dbError);
      return NextResponse.json({ error: 'Database sync failed' }, { status: 500 });
    }

    // Возвращаем ТОЛЬКО то, что реально лежит в базе
    return NextResponse.json({ user: dbUser });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}