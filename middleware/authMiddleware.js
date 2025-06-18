// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const revokedTokens = new Set(); // Хранилище отозванных токенов

// Основная функция аутентификации
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

// Middleware для проверки верификации email
function requireVerified(req, res, next) {
    if (!req.user || !req.user.is_verified) {
        return res.status(403).json({ error: '❌ Требуется подтверждение email' });
    }
    next();
}

// Функция для отзыва токенов
function revokeToken(token) {
    if (token) {
        revokedTokens.add(token);
    }
}

// Экспортируем все функции
module.exports = {
    authenticateToken,
    requireVerified,
    revokeToken
};
