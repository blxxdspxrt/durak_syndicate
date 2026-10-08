const crypto = require('crypto');

module.exports = async (req, res) => {
  // 1. Настройка CORS-заголовков (разрешаем фронтенду делать запросы)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Обработка предварительного CORS-запроса OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 2. Безопасное извлечение initData
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { initData } = body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!initData) {
      return res.status(400).json({ error: 'Missing initData' });
    }

    if (!botToken) {
      return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN is not configured on server' });
    }

    // 3. Проверка HMAC-подписи Telegram
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
      return res.status(401).json({ error: 'Invalid auth signature' });
    }

    // 4. Отправляем юзера
    const userStr = urlParams.get('user');
    const user = userStr ? JSON.parse(userStr) : null;

    return res.status(200).json({ user });
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message });
  }
};