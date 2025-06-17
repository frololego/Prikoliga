const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const db = require('../db');

/**
 * Обновление имени пользователя
 * PUT /api/user/rename
 */
router.put('/rename', authenticateToken, async (req, res) => {
    console.log('--- /rename запрос ---');
    console.log('User:', req.user);
    
    const { newUsername } = req.body;
    const userId = req.user.id;
    const currentUsername = req.user.username;

    if (!newUsername || newUsername.length < 3) {
        return res.status(400).json({ error: 'Имя пользователя должно содержать минимум 3 символа' });
    }

    try {
        // Проверяем существование пользователя
        const user = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id FROM users WHERE id = ? AND is_deleted = 0', 
                [userId], 
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!user) {
            console.log(`User ${userId} not found in DB`);
            return res.status(404).json({ error: 'Пользователь не найден или удален' });
        }

        // Проверяем уникальность нового имени
        const usernameExists = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id FROM users WHERE username = ? AND id != ?',
                [newUsername, userId],
                (err, row) => err ? reject(err) : resolve(!!row)
            );
        });

        if (usernameExists) {
            return res.status(400).json({ error: 'Это имя пользователя уже занято' });
        }

        // Обновляем имя пользователя
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET username = ?, updated_at = datetime("now") WHERE id = ?',
                [newUsername, userId],
                function(err) {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });

        // Обновляем имя в прогнозах (если нужно)
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE predictions SET username = ? WHERE username = ?',
                [newUsername, currentUsername],
                function(err) {
                    if (err) console.error('Update predictions error:', err);
                    resolve();
                }
            );
        });

        res.json({ 
            success: true, 
            newUsername,
            message: 'Имя пользователя успешно изменено'
        });

    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Ошибка сервера при обновлении имени' });
    }
});

/**
 * Удаление аккаунта (soft delete)
 * DELETE /api/user/delete
 */
router.delete('/delete', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const currentDate = new Date().toISOString();
    
    console.log('Запрос на удаление аккаунта для пользователя:', userId);

    try {
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // Обновляем пользователя
                db.run(
                    `UPDATE users SET 
                    is_deleted = 1,
                    deleted_at = ?,
                    is_active = 0,
                    username = username || '_deleted_' || ?,
                    email = email || '_deleted_' || ?,
                    updated_at = datetime("now")
                    WHERE id = ? AND is_deleted = 0`,
                    [currentDate, userId, userId, userId],
                    function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }
                        if (this.changes === 0) {
                            db.run('ROLLBACK');
                            return reject(new Error('Пользователь не найден или уже удален'));
                        }
                        resolve();
                    }
                );
            });
        });

        res.json({ 
            success: true,
            message: 'Аккаунт успешно деактивирован'
        });

    } catch (err) {
        console.error('Ошибка при удалении:', err);
        const status = err.message.includes('не найден') ? 404 : 500;
        res.status(status).json({ 
            error: err.message || 'Не удалось деактивировать аккаунт'
        });
    }
});

/**
 * Получение информации о пользователе
 * GET /api/user/me
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 
                id, username, email, phone, role, 
                is_verified,
                strftime('%Y-%m-%d %H:%M:%S', created_at) as created_at,
                strftime('%Y-%m-%d %H:%M:%S', updated_at) as updated_at
                FROM users 
                WHERE id = ? AND is_deleted = 0`,
                [req.user.id],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json(user);
    } catch (err) {
        console.error('Ошибка при получении данных:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

/**
 * Обновление телефона пользователя
 * PUT /api/user/update-phone
 */
router.put('/update-phone', authenticateToken, async (req, res) => {
    const { phone } = req.body;
    const userId = req.user.id;

    const phoneRegex = /^\+?\d{10,15}$/;
    if (!phone || !phoneRegex.test(phone)) {
        return res.status(400).json({ 
            error: 'Некорректный формат номера. Используйте международный формат (+79123456789)' 
        });
    }

    try {
        // Проверка уникальности номера
        const existingUser = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id FROM users WHERE phone = ? AND id != ? AND is_deleted = 0',
                [phone, userId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (existingUser) {
            return res.status(400).json({ 
                error: 'Этот номер уже используется другим пользователем' 
            });
        }

        // Обновление номера
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET phone = ?, updated_at = datetime("now") WHERE id = ?',
                [phone, userId],
                function(err) {
                    if (err) return reject(err);
                    if (this.changes === 0) {
                        return reject(new Error('Пользователь не найден'));
                    }
                    resolve();
                }
            );
        });

        res.json({ 
            success: true,
            message: 'Номер телефона успешно обновлен',
            phone
        });
    } catch (err) {
        console.error('Ошибка при обновлении телефона:', err);
        res.status(500).json({ 
            error: err.message || 'Не удалось обновить номер телефона'
        });
    }
});

/**
 * Получение прогнозов пользователя
 * GET /api/user/predictions
 */
router.get('/predictions', authenticateToken, async (req, res) => {
    try {
        const predictions = await new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM predictions 
                WHERE username = ? AND is_deleted = 0`,
                [req.user.username],
                (err, rows) => err ? reject(err) : resolve(rows || [])
            );
        });

        if (!predictions.length) {
            return res.json([]);
        }

        // Дополнительная логика обработки прогнозов...
        res.json(predictions);

    } catch (err) {
        console.error('Ошибка при загрузке прогнозов:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;