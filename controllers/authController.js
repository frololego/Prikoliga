// controllers/authController.js

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('db');
const winston = require('services/logger');
const { generateVerificationCode, sendVerificationEmail } = require('services/emailService');

// Конфигурация JWT
const JWT_CONFIG = {
    expiresIn: '1h',
    issuer: 'your-app-name'
};

async function register(req, res) {
    const { username, contact, password_hash } = req.body;

    if (!username || !password_hash || !contact) {
        winston.warn('⚠️ Недостаточно данных для регистрации');
        return res.status(400).json({ error: 'Имя, пароль и контакт обязательны' });
    }

    let email = null;
    let phone = null;

    if (contact.includes('@')) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
            winston.warn('⚠️ Некорректный email');
            return res.status(400).json({ error: 'Некорректный email' });
        }
        email = contact.trim().toLowerCase();
    } else {
        if (!/^\+?[0-9]{10,15}$/.test(contact)) {
            winston.warn('⚠️ Некорректный телефон');
            return res.status(400).json({ error: 'Некорректный телефон' });
        }
        phone = contact.trim();
    }

    try {
        const userExists = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM users WHERE username = ? OR email = ? OR phone = ?`,
                [username.trim(), email, phone],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (userExists) {
            winston.warn(`⚠️ Пользователь уже существует: ${username}`);
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
                        winston.error(`❌ Ошибка при регистрации: ${err.message}`);
                        return reject(err);
                    }
                    winston.info(`✅ Пользователь ${username} зарегистрирован`);
                    resolve(this.lastID);
                }
            );
        });

        const emailSent = email ? await sendVerificationEmail(email, verificationCode) : true;

        if (!emailSent) {
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
                    if (err) {
                        winston.error(`❌ Не удалось откатить регистрацию: ${err.message}`);
                        reject(err);
                    } else {
                        winston.warn(`⚠️ Регистрация отменена: ошибка отправки email`);
                        resolve();
                    }
                });
            });
            return res.status(500).json({ error: 'Ошибка отправки кода подтверждения' });
        }

        winston.info(`📧 Код подтверждения отправлен на ${email || phone}`);

        return res.status(201).json({
            success: true,
            message: email ? 'Код отправлен на email' : 'Вы успешно зарегистрированы',
            contact: email || phone,
            userId
        });

    } catch (err) {
        winston.error(`❌ Ошибка регистрации: ${err.message}`, { error: err });
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}

async function login(req, res) {
    const { login, password_hash } = req.body;

    if (!login || !password_hash) {
        winston.warn('⚠️ Все поля обязательны');
        return res.status(400).json({ error: 'Все поля обязательны' });
    }

    try {
        const normalizedLogin = login.trim();

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
            winston.warn('⚠️ Пользователь не найден');
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }

        if (!user.is_active) {
            winston.warn(`⚠️ Попытка входа в деактивированный аккаунт: ${user.username}`);
            return res.status(403).json({ error: 'Аккаунт деактивирован' });
        }

        if (!user.is_verified) {
            winston.warn(`⚠️ Требуется подтверждение: ${user.username}`);
            return res.status(403).json({
                error: 'Требуется подтверждение email или телефона',
                needs_verification: true,
                contact: user.email || user.phone
            });
        }

        const passwordMatch = await bcrypt.compare(password_hash, user.password_hash);

        if (!passwordMatch) {
            winston.warn(`⚠️ Неверный пароль для пользователя: ${user.username}`);
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

        winston.info(`🔓 Пользователь ${user.username} вошёл в систему`);

        return res.json({
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
        winston.error(`❌ Ошибка входа: ${err.message}`, { error: err });
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}

async function verifyEmail(req, res) {
    const { contact, code } = req.body;

    if (!contact || !code) {
        winston.warn('⚠️ Контакт или код пустые');
        return res.status(400).json({ error: 'Контакт и код обязательны' });
    }

    try {
        const normalizedContact = contact.trim().toLowerCase();

        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, verification_code, is_verified, email, phone 
                 FROM users 
                 WHERE email = ? OR phone = ?`,
                [normalizedContact, normalizedContact],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!user) {
            winston.warn('⚠️ Пользователь не найден');
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        if (user.is_verified) {
            winston.warn('⚠️ Аккаунт уже подтверждён');
            return res.status(400).json({ error: 'Аккаунт уже подтверждён' });
        }

        if (user.verification_code !== code) {
            winston.warn('⚠️ Неверный код подтверждения');
            return res.status(400).json({ error: 'Неверный код подтверждения' });
        }

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE users SET is_verified = 1, verification_code = NULL WHERE id = ?`,
                [user.id],
                (err) => err ? reject(err) : resolve()
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

        winston.info(`✅ Пользователь ${updatedUser.username} успешно подтвердил email/телефон`);

        return res.json({
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
        winston.error(`❌ Ошибка подтверждения: ${err.message}`, { error: err });
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}

module.exports = {
    register,
    login,
    verifyEmail
};