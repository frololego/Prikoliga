const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const db = require('../db');

// Вспомогательные функции для работы с базой данных
const dbQuery = (query, params) => new Promise((resolve, reject) => db.get(query, params, (err, row) => err ? reject(err) : resolve(row)));
const dbRun = (query, params) => new Promise((resolve, reject) => db.run(query, params, function(err) { err ? reject(err) : resolve(this); }));
const dbAll = (query, params) => new Promise((resolve, reject) => db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows || [])));

// Получение информации о пользователе
router.get('/me', authenticateToken, async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store');
        const user = await dbQuery(
            `SELECT id, username, email, phone, role, is_verified,
            strftime('%Y-%m-%d %H:%M:%S', created_at) as created_at,
            strftime('%Y-%m-%d %H:%M:%S', updated_at) as updated_at
            FROM users WHERE id = ? AND is_deleted = 0`,
            [req.user.id]
        );

        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        return res.json(user);
    } catch (err) {
        console.error('Ошибка:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление имени пользователя
router.put('/rename', authenticateToken, async (req, res) => {
    const { newUsername } = req.body;
    const { id: userId, username: currentUsername } = req.user;

    if (!newUsername || newUsername.length < 3)
        return res.status(400).json({ error: 'Имя пользователя должно содержать минимум 3 символа' });

    try {
        const user = await dbQuery('SELECT id FROM users WHERE id = ? AND is_deleted = 0', [userId]);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден или удален' });

        const usernameExists = await dbQuery('SELECT id FROM users WHERE username = ? AND id != ?', [newUsername, userId]);
        if (usernameExists) return res.status(400).json({ error: 'Это имя пользователя уже занято' });

        await dbRun('UPDATE users SET username = ?, updated_at = datetime("now") WHERE id = ?', [newUsername, userId]);

        try {
            await dbRun('UPDATE predictions SET username = ? WHERE username = ?', [newUsername, currentUsername]);
        } catch (err) {
            console.error('Ошибка обновления прогнозов:', err);
        }

        return res.json({ success: true, newUsername, message: 'Имя пользователя успешно изменено' });
    } catch (err) {
        console.error('Ошибка:', err);
        return res.status(500).json({ error: 'Ошибка сервера при обновлении имени' });
    }
});

// Удаление аккаунта (soft delete)
router.delete('/delete', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const currentDate = new Date().toISOString();

    try {
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                db.run(
                    `UPDATE users SET 
                    is_deleted = 1, deleted_at = ?, is_active = 0,
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

        return res.json({ success: true, message: 'Аккаунт успешно деактивирован' });
    } catch (err) {
        console.error('Ошибка:', err);
        const status = err.message.includes('не найден') ? 404 : 500;
        return res.status(status).json({ error: err.message || 'Не удалось деактивировать аккаунт' });
    }
});

// Обновление телефона пользователя
router.put('/update-phone', authenticateToken, async (req, res) => {
    const { phone } = req.body;
    const userId = req.user.id;

    const phoneRegex = /^\+?\d{10,15}$/;
    if (!phone || !phoneRegex.test(phone))
        return res.status(400).json({ error: 'Некорректный формат номера. Используйте международный формат (+79123456789)' });

    try {
        const existingUser = await dbQuery('SELECT id FROM users WHERE phone = ? AND id != ? AND is_deleted = 0', [phone, userId]);
        if (existingUser) return res.status(400).json({ error: 'Этот номер уже используется другим пользователем' });

        const result = await dbRun('UPDATE users SET phone = ?, updated_at = datetime("now") WHERE id = ?', [phone, userId]);
        if (result.changes === 0) return res.status(404).json({ error: 'Пользователь не найден' });

        return res.json({ success: true, message: 'Номер телефона успешно обновлен', phone });
    } catch (err) {
        console.error('Ошибка:', err);
        return res.status(500).json({ error: err.message || 'Не удалось обновить номер телефона' });
    }
});

// Получение прогнозов пользователя
router.get('/predictions', authenticateToken, async (req, res) => {
    try {
        const predictions = await dbAll(`SELECT * FROM predictions WHERE username = ? AND is_deleted = 0`, [req.user.username]);
        return res.json(predictions);
    } catch (err) {
        console.error('Ошибка:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;