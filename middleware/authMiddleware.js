const jwt = require('jsonwebtoken');

const revokedTokens = new Set(); // Простой список отозванных токенов

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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId; // Должно совпадать с полем в токене

        // Проверяем наличие обязательных полей
        if (!decoded || !decoded.username) {
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

// Для использования в logout
authenticateToken.revokeToken = (token) => {
    if (token) {
        revokedTokens.add(token);
    }
};

module.exports = authenticateToken;