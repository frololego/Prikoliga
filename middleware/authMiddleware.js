// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const revokedTokens = new Set(); // Хранилище отозванных токенов

// Основная функция аутентификации
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    // Проверяем наличие заголовка и формат
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '❌ Токен отсутствует или неверного формата' });
    }

    const token = authHeader.split(' ')[1];

    // Проверяем, не отозван ли токен
    if (revokedTokens.has(token)) {
        return res.status(403).json({ error: '❌ Токен отозван' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey123');
        
        // Проверяем наличие обязательных полей
        if (!decoded || !decoded.id || !decoded.username) {
            return res.status(403).json({ error: '❌ Недостаточно данных в токене' });
        }

        console.log("🔓 Декодированный токен:", decoded);
        req.user = decoded;
        next();
    } catch (e) {
        console.error("❌ Ошибка верификации токена:", e.message);
        return res.status(403).json({ error: '❌ Неверный токен' });
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
