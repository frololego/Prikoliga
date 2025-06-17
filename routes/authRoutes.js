const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../db.js');
const { generateVerificationCode, sendVerificationEmail } = require('../services/emailService');
const router = express.Router();

// Конфигурация JWT
const JWT_CONFIG = {
    expiresIn: '1h',
    issuer: 'your-app-name'
};

// === Middleware для проверки токена ===
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Токен не предоставлен' });

    jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey123', (err, user) => {
        if (err) {
            console.error('Ошибка верификации токена:', err.message);
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        if (!user.id) {
            return res.status(403).json({ error: 'Токен не содержит ID' });
        }
        req.user = user;
        next();
    });
}

// === Роут /register — регистрация с email или телефоном ===
router.post('/register', async (req, res) => {
    // Изменяем деструктуризацию - принимаем contact вместо email и phone
    const { username, contact, password_hash } = req.body;
    
    if (!username || !password_hash || !contact) {
        return res.status(400).json({ error: 'Имя, пароль и контакт обязательны' });
    }

    // Определяем, email это или телефон
    let email = null;
    let phone = null;
    
    if (contact.includes('@')) {
        if (!contact.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.status(400).json({ error: 'Некорректный email' });
        }
        email = contact.trim().toLowerCase();
    } else {
        if (!contact.match(/^\+?[0-9]{10,15}$/)) {
            return res.status(400).json({ error: 'Некорректный телефон' });
        }
        phone = contact.trim();
    }

    // Остальной код остается прежним, но используем email и phone
    try {
        const userExists = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM users WHERE username = ? OR email = ? OR phone = ?`,
                [username.trim(), email, phone],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (userExists) {
            return res.status(409).json({ error: 'Пользователь уже существует' });
        }

        const hashedPassword = await bcrypt.hash(password_hash, 10);
        const verificationCode = generateVerificationCode();

        const userId = await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users 
                (username, email, phone, password_hash, role, verification_code, is_verified) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    username.trim(),
                    email,
                    phone,
                    hashedPassword,
                    'user',
                    verificationCode,
                    email ? 0 : 1 // Автоматическое подтверждение, если нет email
                ],
                function (err) {
                    if (err) return reject(err);
                    resolve(this.lastID);
                }
            );
        });

        // Если есть email — отправляем код
        const emailSent = email ? await sendVerificationEmail(email, verificationCode) : true;

        if (!emailSent) {
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            return res.status(500).json({ error: 'Ошибка отправки кода подтверждения' });
        }

        res.status(201).json({
            success: true,
            message: email ? 'Код отправлен на email' : 'Вы успешно зарегистрированы',
            contact: email || phone,
            userId
        });
    } catch (err) {
        console.error('Ошибка регистрации:', err.message);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// === Роут /verify-email — подтверждение через email или телефон ===
router.post('/verify-email', async (req, res) => {
    const { contact, code } = req.body;

    if (!contact || !code) {
        return res.status(400).json({ error: 'Контакт и код обязательны' });
    }

    try {
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, verification_code, is_verified, email, phone 
                 FROM users 
                 WHERE email = ? OR phone = ?`,
                [contact.trim().toLowerCase(), contact.trim()],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        if (user.is_verified) {
            return res.status(400).json({ error: 'Аккаунт уже подтверждён' });
        }

        if (user.verification_code !== code) {
            return res.status(400).json({ error: 'Неверный код подтверждения' });
        }

        await new Promise((resolve, reject) => {
            db.run(`UPDATE users SET is_verified = 1, verification_code = NULL WHERE id = ?`, [user.id], (err) =>
                err ? reject(err) : resolve()
            );
        });

        const updatedUser = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id, username, email, phone, role FROM users WHERE id = ?',
                [user.id],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        const token = jwt.sign(
            {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                phone: updatedUser.phone,
                role: updatedUser.role
            },
            process.env.JWT_SECRET || 'supersecretkey123',
            JWT_CONFIG
        );

        res.json({
            success: true,
            token,
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                phone: updatedUser.phone,
                role: updatedUser.role,
                is_verified: true
            }
        });
    } catch (err) {
        console.error('Ошибка подтверждения:', err.message);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// === Роут /login — вход через username, email или телефон ===
router.post('/login', async (req, res) => {
    const { login, password_hash } = req.body;

    if (!login || !password_hash) {
        return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }

    try {
        const normalizedLogin = login.trim();
        
        // Ищем пользователя по username (точное совпадение), email (без учета регистра) или телефону
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, username, email, phone, password_hash, role, is_active, is_verified 
                 FROM users 
                 WHERE username = ? OR email = ? OR phone = ?`,
                [normalizedLogin, normalizedLogin.toLowerCase(), normalizedLogin],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!user) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'Аккаунт деактивирован' });
        }

        if (!user.is_verified) {
            return res.status(403).json({ 
                error: 'Требуется подтверждение email или телефона',
                needs_verification: true,
                contact: user.email || user.phone
            });
        }

        const passwordMatch = await bcrypt.compare(password_hash, user.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                email: user.email,
                phone: user.phone,
                role: user.role
            },
            process.env.JWT_SECRET || 'supersecretkey123',
            JWT_CONFIG
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                phone: user.phone,
                role: user.role,
                is_verified: user.is_verified
            }
        });

    } catch (err) {
        console.error('Ошибка входа:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// === Вспомогательная функция для генерации токена ===
function generateToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET || 'supersecretkey123', JWT_CONFIG);
}

module.exports = {
    router,
    authenticateToken
};