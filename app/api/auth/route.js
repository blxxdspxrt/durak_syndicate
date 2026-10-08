import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const body = await request.json();
    const { initData } = body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!initData) {
      return NextResponse.json({ error: 'Missing initData' }, { status: 400 });
    }

    if (!botToken) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN is not configured on server' },
        { status: 500 }
      );
    }

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

    let photoUrl = null;

    if (user && user.id) {
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
        console.error('Failed to fetch user profile photo:', e);
      }
    }

    return NextResponse.json({
      user: {
        ...user,
        photo_url: photoUrl,
      },
    });
  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}