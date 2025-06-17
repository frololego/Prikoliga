const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../db.js');
<<<<<<< HEAD
const { generateVerificationCode, sendVerificationEmail } = require('../services/emailService');

const router = express.Router();

// Конфигурация JWT
=======
const router = express.Router();

// Конфигурация
>>>>>>> origin/main
const JWT_CONFIG = {
    expiresIn: '1h',
    issuer: 'your-app-name'
};

<<<<<<< HEAD
// === Middleware для проверки токена ===
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Токен не предоставлен' });
=======
// === Улучшенный middleware для проверки токена ===
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Токен не предоставлен' });
    }
>>>>>>> origin/main

    jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey123', (err, user) => {
        if (err) {
            console.error('Ошибка верификации токена:', err.message);
            return res.status(403).json({ error: 'Недействительный токен' });
        }
<<<<<<< HEAD
        if (!user.id) {
            return res.status(403).json({ error: 'Токен не содержит идентификатор пользователя' });
        }
=======
        
        if (!user.id) {
            return res.status(403).json({ error: 'Токен не содержит идентификатор пользователя' });
        }

>>>>>>> origin/main
        req.user = user;
        next();
    });
}

<<<<<<< HEAD
// === Middleware для проверки подтверждения email ===
async function checkVerified(req, res, next) {
    try {
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT is_verified FROM users WHERE id = ?', [req.user.id], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
        if (!user || !user.is_verified) {
            return res.status(403).json({ error: 'Требуется подтверждение email' });
        }
        next();
    } catch (err) {
        console.error('Ошибка проверки верификации:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}

// === Роуты ===

// Вспомогательная функция для генерации токена
function generateToken(payload) {
    return jwt.sign(
        payload,
        process.env.JWT_SECRET || 'supersecretkey123',
        JWT_CONFIG
    );
}

// Проверка авторизации
router.get('/check', authenticateToken, async (req, res) => {
    try {
        const user = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id, username, email, role, is_verified FROM users WHERE id = ?',
                [req.user.id],
                (err, row) => (err ? reject(err) : resolve(row))
            );
        });
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                is_verified: user.is_verified
            }
        });
    } catch (err) {
        console.error('Ошибка проверки авторизации:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Регистрация с подтверждением email
router.post('/register', async (req, res) => {
    const { username, password_hash, email } = req.body;
    if (!username || !password_hash || !email) {
        return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }
    if (password_hash.length < 8) {
        return res.status(400).json({ error: 'Пароль должен содержать минимум 8 символов' });
    }
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        return res.status(400).json({ error: 'Некорректный email' });
    }

    try {
        const userExists = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id FROM users WHERE username = ? OR email = ?',
                [username.trim().toLowerCase(), email.trim().toLowerCase()],
                (err, row) => (err ? reject(err) : resolve(row))
            );
        });
        if (userExists) {
            return res.status(409).json({ error: 'Пользователь с таким именем или email уже существует' });
        }

        const hashedPassword = await bcrypt.hash(password_hash, 10);
        const verificationCode = generateVerificationCode();

        const userId = await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users 
                (username, email, password_hash, role, verification_code, is_verified) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [username.trim(), email.trim().toLowerCase(), hashedPassword, 'user', verificationCode, 0],
                function (err) {
=======
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
>>>>>>> origin/main
                    if (err) return reject(err);
                    resolve(this.lastID);
                }
            );
        });

<<<<<<< HEAD
        const emailSent = await sendVerificationEmail(email, verificationCode);
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
            message: 'Код подтверждения отправлен на email',
            email: email.trim().toLowerCase(),
            userId
        });
=======
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

>>>>>>> origin/main
    } catch (err) {
        console.error('Ошибка регистрации:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

<<<<<<< HEAD
// Подтверждение email
router.post('/verify-email', async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
        return res.status(400).json({ error: 'Email и код обязательны' });
    }

    try {
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, verification_code, is_verified FROM users WHERE email = ?`,
                [email.trim().toLowerCase()],
                (err, row) => (err ? reject(err) : resolve(row))
            );
        });
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        if (user.is_verified) return res.status(400).json({ error: 'Email уже подтвержден' });
        if (user.verification_code !== code) return res.status(400).json({ error: 'Неверный код подтверждения' });

        await new Promise((resolve, reject) => {
            db.run(`UPDATE users SET is_verified = 1, verification_code = NULL WHERE id = ?`, [user.id], (err) =>
                err ? reject(err) : resolve()
            );
        });

        const updatedUser = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id, username, email, role FROM users WHERE id = ?',
                [user.id],
                (err, row) => (err ? reject(err) : resolve(row))
            );
        });

        const token = jwt.sign(
            {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                role: updatedUser.role
            },
            process.env.JWT_SECRET || 'supersecretkey123',
            JWT_CONFIG
        );

        res.json({
            success: true,
            message: 'Email успешно подтвержден',
            token,
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                role: updatedUser.role,
                is_verified: true
            }
        });
    } catch (err) {
        console.error('Ошибка подтверждения email:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Повторная отправка кода подтверждения
router.post('/resend-verification', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email обязателен' });

    try {
        const user = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id, is_verified FROM users WHERE email = ?',
                [email.trim().toLowerCase()],
                (err, row) => (err ? reject(err) : resolve(row))
            );
        });
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        if (user.is_verified) return res.status(400).json({ error: 'Email уже подтвержден' });

        const newVerificationCode = generateVerificationCode();

        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET verification_code = ? WHERE id = ?',
                [newVerificationCode, user.id],
                (err) => (err ? reject(err) : resolve())
            );
        });

        const emailSent = await sendVerificationEmail(email, newVerificationCode);
        if (!emailSent) return res.status(500).json({ error: 'Ошибка отправки кода подтверждения' });

        res.json({
            success: true,
            message: 'Новый код подтверждения отправлен'
        });
    } catch (err) {
        console.error('Ошибка повторной отправки кода:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Вход (только для верифицированных пользователей)
router.post('/login', async (req, res) => {
    const { login, password_hash } = req.body;
    if (!login || !password_hash) {
        return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }
    try {
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, username, email, password_hash, role, is_active, is_verified 
=======
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
>>>>>>> origin/main
                FROM users 
                WHERE username = ? OR email = ?`,
                [login.trim().toLowerCase(), login.trim().toLowerCase()],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });
<<<<<<< HEAD
        if (!user) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }
        if (!user.is_active) {
            return res.status(403).json({ error: 'Аккаунт деактивирован' });
        }
        if (!user.is_verified) {
            return res.status(403).json({ 
                error: 'Требуется подтверждение email',
                needs_verification: true,
                email: user.email
            });
        }

        const passwordMatch = await bcrypt.compare(password_hash, user.password_hash);

=======

        if (!user) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'Аккаунт деактивирован' });
        }

        // Проверка пароля
        const passwordMatch = await bcrypt.compare(password_hash, user.password_hash);
>>>>>>> origin/main
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }

<<<<<<< HEAD
=======
        // Генерация токена
>>>>>>> origin/main
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
<<<<<<< HEAD
                role: user.role,
                is_verified: true
            }
        });
=======
                role: user.role
            }
        });

>>>>>>> origin/main
    } catch (err) {
        console.error('Ошибка входа:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

<<<<<<< HEAD
=======
// Вспомогательная функция для генерации токена
function generateToken(payload) {
    return jwt.sign(
        payload,
        process.env.JWT_SECRET || 'supersecretkey123',
        JWT_CONFIG
    );
}

>>>>>>> origin/main
module.exports = router;