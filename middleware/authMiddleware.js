// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const winston = require('logger');

const revokedTokens = new Set(); // Для отзыва токенов

/**
 * Middleware для проверки и верификации JWT токена
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    winston.info(`📡 Запрос к: ${req.url}`);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        winston.warn('❌ Нет заголовка Authorization');
        return res.status(401).json({ error: 'Токен отсутствует' });
    }

    const token = authHeader.split(' ')[1];
    winston.info(`🗝️ Получен токен: ${token.substring(0, 10)}...`);

    try {
        if (revokedTokens.has(token)) {
            winston.warn('🚫 Токен был отозван');
            return res.status(403).json({ error: 'Токен недействителен' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        winston.info(`🔓 Токен успешно декодирован: ${decoded.username}`);

        req.user = decoded;
        next();
    } catch (e) {
        winston.error(`🚫 Ошибка верификации токена: ${e.message}`);
        return res.status(403).json({ error: 'Неверный токен' });
    }
}

/**
 * Middleware для проверки подтверждения email
 */
function requireVerified(req, res, next) {
    if (!req.user || !req.user.is_verified) {
        winston.warn(`❌ Пользователь не подтвердил email: ${req.user?.username}`);
        return res.status(403).json({ error: '❌ Требуется подтверждение email' });
    }
    next();
}

/**
 * Добавляет токен в список отозванных
 * @param {string} token - Токен для отзыва
 */
function revokeToken(token) {
    if (token) {
        revokedTokens.add(token);
        winston.info(`🔄 Токен добавлен в черный список`);
    }
}

module.exports = { authenticateToken, requireVerified, revokeToken };