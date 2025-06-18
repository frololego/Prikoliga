const jwt = require('jsonwebtoken');

const revokedTokens = new Set(); // Для отзыва токенов

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    
    console.log("📡 Запрос к:", req.url);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn("❌ Нет заголовка Authorization");
        return res.status(401).json({ error: 'Токен отсутствует' });
    }

    const token = authHeader.split(' ')[1];
    console.log("🗝️ Получен токен:", token);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey123');
        console.log("🔓 Токен декодирован:", decoded);
        req.user = decoded;
        next();
    } catch (e) {
        console.error("🚫 Ошибка верификации токена:", e.message);
        res.status(403).json({ error: 'Неверный токен' });
    }
}

function requireVerified(req, res, next) {
    if (!req.user || !req.user.is_verified) {
        return res.status(403).json({ error: '❌ Требуется подтверждение email' });
    }
    next();
}

function revokeToken(token) {
    if (token) revokedTokens.add(token);
}

module.exports = { authenticateToken, requireVerified, revokeToken };