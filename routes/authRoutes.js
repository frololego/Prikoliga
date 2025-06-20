// routes/authRoutes.js

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('db');
const { generateVerificationCode, sendVerificationEmail } = require('services/emailService');
const logger = require('logger');

const router = express.Router();

// Конфигурация JWT
const JWT_CONFIG = {
    expiresIn: '1h',
    issuer: 'PRIKOLIGA'
};

// === Middleware для проверки токена ===
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) {
        logger.warn('❌ Токен не предоставлен');
        return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey123', (err, user) => {
        if (err) {
            logger.error(`🚫 Ошибка верификации токена: ${err.message}`);
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        if (!user.id) {
            logger.warn('❌ Токен не содержит ID пользователя');
            return res.status(403).json({ error: 'Токен не содержит ID' });
        }
        req.user = user;
        next();
    });
}

// === Роут /register — регистрация с email или телефоном ===
router.post('/register', async (req, res) => {
    const { username, contact, password_hash } = req.body;

    if (!username || !password_hash || !contact) {
        logger.warn('❌ Неверные данные регистрации: недостающие поля');
        return res.status(400).json({ error: 'Имя, пароль и контакт обязательны' });
    }

    let email = null;
    let phone = null;

    if (contact.includes('@')) {
        if (!contact.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            logger.warn(`❌ Некорректный email: ${contact}`);
            return res.status(400).json({ error: 'Некорректный email' });
        }
        email = contact.trim().toLowerCase();
    } else {
        if (!contact.match(/^\+?[0-9]{10,15}$/)) {
            logger.warn(`❌ Некорректный телефон: ${contact}`);
            return res.status(400).json({ error: 'Некорректный телефон' });
        }
        phone = contact.trim();
    }

    try {
        const userExists = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM users WHERE username = ? OR email = ? OR phone = ?`,
                [username.trim(), email, phone],
                (err, row) => {
                    if (err) {
                        logger.error(`❌ Ошибка поиска пользователя: ${err.message}`);
                        return reject(err);
                    }
                    resolve(row);
                }
            );
        });

        if (userExists) {
            logger.warn(`❌ Пользователь уже существует: ${username}`);
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
                    if (err) {
                        logger.error(`❌ Ошибка создания пользователя: ${err.message}`);
                        return reject(err);
                    }
                    logger.info(`✅ Пользователь создан, ID: ${this.lastID}`);
                    resolve(this.lastID);
                }
            );
        });

        const emailSent = email ? await sendVerificationEmail(email, verificationCode) : true;

        if (!emailSent) {
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
                    if (err) {
                        logger.error(`❌ Ошибка удаления пользователя: ${err.message}`);
                        return reject(err);
                    }
                    logger.warn(`🗑️ Пользователь удалён после ошибки отправки письма`);
                    resolve();
                });
            });
            return res.status(500).json({ error: 'Ошибка отправки кода подтверждения' });
        }

        logger.info(`📧 Код подтверждения отправлен: ${email || phone}`);

        res.status(201).json({
            success: true,
            message: email ? 'Код отправлен на email' : 'Вы успешно зарегистрированы',
            contact: email || phone,
            userId
        });
    } catch (err) {
        logger.error(`❌ Внутренняя ошибка сервера: ${err.message}`);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// === Роут /verify-email — подтверждение через email или телефон ===
router.post('/verify-email', async (req, res) => {
    const { contact, code } = req.body;

    if (!contact || !code) {
        logger.warn('❌ Контакт или код отсутствуют');
        return res.status(400).json({ error: 'Контакт и код обязательны' });
    }

    try {
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, verification_code, is_verified, email, phone 
                 FROM users 
                 WHERE email = ? OR phone = ?`,
                [contact.trim().toLowerCase(), contact.trim()],
                (err, row) => {
                    if (err) {
                        logger.error(`❌ Ошибка поиска пользователя: ${err.message}`);
                        return reject(err);
                    }
                    resolve(row);
                }
            );
        });

        if (!user) {
            logger.warn(`❌ Пользователь не найден: ${contact}`);
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        if (user.is_verified) {
            logger.info(`✅ Аккаунт уже подтверждён: ${contact}`);
            return res.status(400).json({ error: 'Аккаунт уже подтверждён' });
        }

        if (user.verification_code !== code) {
            logger.warn(`❌ Неверный код подтверждения: ${contact}`);
            return res.status(400).json({ error: 'Неверный код подтверждения' });
        }

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE users SET is_verified = 1, verification_code = NULL WHERE id = ?`,
                [user.id],
                function (err) {
                    if (err) {
                        logger.error(`❌ Ошибка обновления пользователя: ${err.message}`);
                        return reject(err);
                    }
                    logger.info(`✅ Email подтверждён: ${contact}`);
                    resolve();
                }
            );
        });

        const updatedUser = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id, username, email, phone, role FROM users WHERE id = ?',
                [user.id],
                (err, row) => {
                    if (err) {
                        logger.error(`❌ Ошибка получения данных пользователя: ${err.message}`);
                        return reject(err);
                    }
                    resolve(row);
                }
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
        logger.error(`❌ Ошибка подтверждения: ${err.message}`);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// === Роут /login — вход через username, email или телефон ===
router.post('/login', async (req, res) => {
    const { login, password_hash } = req.body;

    if (!login || !password_hash) {
        logger.warn('❌ Неверные данные входа: недостающие поля');
        return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }

    const normalizedLogin = login.trim();

    try {
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, username, email, phone, password_hash, role, is_active, is_verified 
                 FROM users 
                 WHERE username = ? OR email = ? OR phone = ?`,
                [normalizedLogin, normalizedLogin.toLowerCase(), normalizedLogin],
                (err, row) => {
                    if (err) {
                        logger.error(`❌ Ошибка поиска пользователя: ${err.message}`);
                        return reject(err);
                    }
                    resolve(row);
                }
            );
        });

        if (!user) {
            logger.warn(`❌ Пользователь не найден: ${normalizedLogin}`);
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }

        if (!user.is_active) {
            logger.warn(`❌ Аккаунт деактивирован: ${normalizedLogin}`);
            return res.status(403).json({ error: 'Аккаунт деактивирован' });
        }

        if (!user.is_verified) {
            logger.warn(`❌ Требуется подтверждение: ${normalizedLogin}`);
            return res.status(403).json({
                error: 'Требуется подтверждение email или телефона',
                needs_verification: true,
                contact: user.email || user.phone
            });
        }

        const passwordMatch = await bcrypt.compare(password_hash, user.password_hash);

        if (!passwordMatch) {
            logger.warn(`❌ Неверный пароль для пользователя: ${normalizedLogin}`);
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

        logger.info(`🔓 Пользователь вошёл в систему: ${normalizedLogin}`);

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
        logger.error(`❌ Ошибка входа: ${err.message}`);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// === Экспортируем роуты ===
module.exports = {
    router,
    authenticateToken
};