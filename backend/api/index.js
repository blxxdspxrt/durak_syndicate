// backend/api/index.js
const crypto = require('crypto');

module.exports = (req, res) => {
  // Vercel автоматически парсит JSON
  const { initData } = req.body;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!initData || !botToken) {
    return res.status(400).json({ error: 'Missing data' });
  }

  // Простая проверка подписи (для MVP)
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
    return res.status(401).json({ error: 'Invalid auth' });
  }

  // Если подпись верна, возвращаем данные пользователя
  const user = JSON.parse(urlParams.get('user'));
  res.json({ user });
};