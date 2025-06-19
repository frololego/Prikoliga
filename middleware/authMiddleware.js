// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const logger = require('logger');

const revokedTokens = new Set(); // Для отзыва токенов (in-memory)

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    logger.debug(`📡 Запрос к: ${req.url}`);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('❌ Нет заголовка Authorization');
        return res.status(401).json({ error: 'Токен отсутствует' });
    }

    const token = authHeader.split(' ')[1];
    logger.debug(`🗝️ Получен токен: ${token}`);

    if (revokedTokens.has(token)) {
        logger.warn('🚫 Попытка использования отозванного токена');
        return res.status(403).json({ error: 'Токен был отозван' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey123');
        logger.info(`🔓 Токен успешно декодирован: ${decoded.username}`);
        req.user = decoded;
        next();
    } catch (e) {
        logger.error(`🚫 Ошибка верификации токена: ${e.message}`);
        res.status(403).json({ error: 'Неверный токен' });
    }
}

function requireVerified(req, res, next) {
    if (!req.user || !req.user.is_verified) {
        logger.warn(`❌ Пользователь не подтвердил email: ${req.user?.username}`);
        return res.status(403).json({ error: 'Требуется подтверждение email' });
    }
    next();
}

function revokeToken(token) {
    if (token) {
        revokedTokens.add(token);
        logger.debug(`🚫 Токен добавлен в список отозванных`);
    }
}

module.exports = { authenticateToken, requireVerified, revokeToken };