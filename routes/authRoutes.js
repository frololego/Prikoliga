const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../db.js');
const router = express.Router();

// Конфигурация
const JWT_CONFIG = {
    expiresIn: '1h',
    issuer: 'your-app-name'
};

// === Улучшенный middleware для проверки токена ===
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey123', (err, user) => {
        if (err) {
            console.error('Ошибка верификации токена:', err.message);
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        
        if (!user.id) {
            return res.status(403).json({ error: 'Токен не содержит идентификатор пользователя' });
        }

        req.user = user;
        next();
    });
}

// === Роуты ===

// Проверка авторизации
router.get('/check', authenticateToken, (req, res) => {
    res.json({ 
        success: true, 
        user: {
            id: req.user.id,
            username: req.user.username,
            email: req.user.email,
            role: req.user.role
        }
    });
});

// Регистрация
router.post('/register', async (req, res) => {
    const { username, password_hash, email } = req.body;
    
    // Валидация
    if (!username || !password_hash || !email) {
        return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }

    if (password_hash.length < 8) {
        return res.status(400).json({ error: 'Пароль должен содержать минимум 8 символов' });
    }

    try {
        // Проверка существования пользователя
        const userExists = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id FROM users WHERE username = ? OR email = ?', 
                [username.trim().toLowerCase(), email.trim().toLowerCase()], 
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (userExists) {
            return res.status(409).json({ 
                error: 'Пользователь с таким именем или email уже существует' 
            });
        }

        // Хеширование пароля
        const hashedPassword = await bcrypt.hash(password_hash, 10);
        
        // Создание пользователя
        const userId = await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
                [
                    username.trim(),
                    email.trim().toLowerCase(),
                    hashedPassword,
                    'user' // Роль по умолчанию
                ],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.lastID);
                }
            );
        });

        // Генерация токена
        const token = generateToken({
            id: userId,
            username: username.trim(),
            email: email.trim().toLowerCase(),
            role: 'user'
        });

        res.status(201).json({ 
            success: true,
            token,
            user: {
                id: userId,
                username: username.trim(),
                email: email.trim().toLowerCase(),
                role: 'user'
            }
        });

    } catch (err) {
        console.error('Ошибка регистрации:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Вход
router.post('/login', async (req, res) => {
    const { login, password_hash } = req.body;
    
    // Валидация
    if (!login || !password_hash) {
        return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }

    try {
        // Поиск пользователя
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, username, email, password_hash, role, is_active 
                FROM users 
                WHERE username = ? OR email = ?`,
                [login.trim().toLowerCase(), login.trim().toLowerCase()],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!user) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'Аккаунт деактивирован' });
        }

        // Проверка пароля
        const passwordMatch = await bcrypt.compare(password_hash, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }

        // Генерация токена
        const token = generateToken({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
        });

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });

    } catch (err) {
        console.error('Ошибка входа:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Вспомогательная функция для генерации токена
function generateToken(payload) {
    return jwt.sign(
        payload,
        process.env.JWT_SECRET || 'supersecretkey123',
        JWT_CONFIG
    );
}

module.exports = router;