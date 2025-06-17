const express = require('express');
const router = express.Router();
<<<<<<< HEAD
const { authenticateToken } = require('../middleware/authMiddleware');
=======
const auth = require('../middleware/authMiddleware');
>>>>>>> origin/main
const db = require('../db');

/**
 * Обновление имени пользователя
 * PUT /api/user/rename
 */
<<<<<<< HEAD
router.put('/rename', authenticateToken, async (req, res) => {
    console.log('--- /rename запрос ---');
    console.log('User:', req.user);
    
=======
router.put('/rename', auth, async (req, res) => {
    console.log('--- /rename запрос ---');
    console.log('Headers:', req.headers);
    console.log('User:', req.user);
    console.log('Body:', req.body);

>>>>>>> origin/main
    const { newUsername } = req.body;
    const userId = req.user.id;
    const currentUsername = req.user.username;

    if (!newUsername || newUsername.length < 3) {
        return res.status(400).json({ error: 'Имя пользователя должно содержать минимум 3 символа' });
    }

<<<<<<< HEAD
    try {
        // Проверяем существование пользователя
        const user = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id FROM users WHERE id = ? AND is_deleted = 0', 
                [userId], 
                (err, row) => err ? reject(err) : resolve(row)
            );
        });
=======
    db.get('SELECT id FROM users WHERE id = ? AND is_deleted = 0', [userId], (err, user) => {
        if (err) {
            console.error('DB error:', err);
            return res.status(500).json({ error: 'Ошибка БД' });
        }
>>>>>>> origin/main

        if (!user) {
            console.log(`User ${userId} not found in DB`);
            return res.status(404).json({ error: 'Пользователь не найден или удален' });
        }

<<<<<<< HEAD
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
=======
        console.log('User found:', user);
        
        db.run(
            'UPDATE users SET username = ?, updated_at = datetime("now") WHERE id = ?',
            [newUsername, userId],
            function(err) {
                if (err) {
                    console.error('Update error:', err);
                    return res.status(500).json({ error: 'Ошибка обновления' });
                }
                
                db.run(
                    'UPDATE predictions SET username = ? WHERE username = ?',
                    [newUsername, currentUsername],
                    function(err) {
                        if (err) {
                            console.error('Update predictions error:', err);
                        }
                        console.log(`Updated ${this.changes} rows in users`);
                        res.json({ success: true, newUsername });
                    }
                );
            }
        );
    });
>>>>>>> origin/main
});

/**
 * Удаление аккаунта (soft delete)
 * DELETE /api/user/delete
 */
<<<<<<< HEAD
router.delete('/delete', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const currentDate = new Date().toISOString();
    
    console.log('Запрос на удаление аккаунта для пользователя:', userId);
=======
router.delete('/delete', auth, async (req, res) => {
    const userId = req.user.id;
    const username = req.user.username;
    const currentDate = new Date().toISOString();
    
    console.log('Запрос на мягкое удаление аккаунта для пользователя:', userId);
>>>>>>> origin/main

    try {
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

<<<<<<< HEAD
                // Обновляем пользователя
=======
                db.run(
                    `UPDATE predictions SET 
                    is_deleted = 1, 
                    deleted_at = ? 
                    WHERE username = ?`,
                    [currentDate, username],
                    function(err) {
                        if (err) {
                            console.error('Ошибка при пометке прогнозов:', err);
                        }
                    }
                );

>>>>>>> origin/main
                db.run(
                    `UPDATE users SET 
                    is_deleted = 1,
                    deleted_at = ?,
                    is_active = 0,
                    username = username || '_deleted_' || ?,
<<<<<<< HEAD
                    email = email || '_deleted_' || ?,
                    updated_at = datetime("now")
=======
                    email = email || '_deleted_' || ?
>>>>>>> origin/main
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
<<<<<<< HEAD
=======
                        db.run('COMMIT');
>>>>>>> origin/main
                        resolve();
                    }
                );
            });
        });

        res.json({ 
            success: true,
<<<<<<< HEAD
            message: 'Аккаунт успешно деактивирован'
        });

    } catch (err) {
        console.error('Ошибка при удалении:', err);
=======
            message: 'Аккаунт успешно деактивирован (данные сохранены)'
        });

    } catch (err) {
        console.error('Ошибка при мягком удалении:', err);
>>>>>>> origin/main
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
<<<<<<< HEAD
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 
                id, username, email, phone, role, 
                is_verified,
=======
router.get('/me', auth, async (req, res) => {
    try {
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, username, email, phone, role, 
>>>>>>> origin/main
                strftime('%Y-%m-%d %H:%M:%S', created_at) as created_at,
                strftime('%Y-%m-%d %H:%M:%S', updated_at) as updated_at
                FROM users 
                WHERE id = ? AND is_deleted = 0`,
                [req.user.id],
<<<<<<< HEAD
                (err, row) => err ? reject(err) : resolve(row)
=======
                function(err, row) {
                    if (err) return reject(err);
                    resolve(row);
                }
>>>>>>> origin/main
            );
        });

        if (!user) {
<<<<<<< HEAD
            return res.status(404).json({ error: 'Пользователь не найден' });
=======
            return res.status(404).json({ error: 'Пользователь не найден или удален' });
>>>>>>> origin/main
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
<<<<<<< HEAD
router.put('/update-phone', authenticateToken, async (req, res) => {
=======
router.put('/update-phone', auth, async (req, res) => {
>>>>>>> origin/main
    const { phone } = req.body;
    const userId = req.user.id;

    const phoneRegex = /^\+?\d{10,15}$/;
    if (!phone || !phoneRegex.test(phone)) {
        return res.status(400).json({ 
            error: 'Некорректный формат номера. Используйте международный формат (+79123456789)' 
        });
    }

    try {
<<<<<<< HEAD
        // Проверка уникальности номера
        const existingUser = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id FROM users WHERE phone = ? AND id != ? AND is_deleted = 0',
                [phone, userId],
                (err, row) => err ? reject(err) : resolve(row)
=======
        const existingUser = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM users 
                WHERE phone = ? AND id != ? AND is_deleted = 0`,
                [phone, userId],
                function(err, row) {
                    if (err) return reject(err);
                    resolve(row);
                }
>>>>>>> origin/main
            );
        });

        if (existingUser) {
            return res.status(400).json({ 
                error: 'Этот номер уже используется другим пользователем' 
            });
        }

<<<<<<< HEAD
        // Обновление номера
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET phone = ?, updated_at = datetime("now") WHERE id = ?',
=======
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE users SET 
                phone = ?, 
                updated_at = datetime("now") 
                WHERE id = ? AND is_deleted = 0`,
>>>>>>> origin/main
                [phone, userId],
                function(err) {
                    if (err) return reject(err);
                    if (this.changes === 0) {
<<<<<<< HEAD
                        return reject(new Error('Пользователь не найден'));
=======
                        return reject(new Error('Пользователь не найден или удален'));
>>>>>>> origin/main
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
<<<<<<< HEAD
router.get('/predictions', authenticateToken, async (req, res) => {
    try {
        const predictions = await new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM predictions 
                WHERE username = ? AND is_deleted = 0`,
                [req.user.username],
                (err, rows) => err ? reject(err) : resolve(rows || [])
=======
router.get('/predictions', auth, async (req, res) => {
    try {
        const predictions = await new Promise((resolve, reject) => {
            db.all(
                `SELECT p.* FROM predictions p 
                WHERE p.username = ? AND p.is_deleted = 0`,
                [req.user.username],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
>>>>>>> origin/main
            );
        });

        if (!predictions.length) {
            return res.json([]);
        }

<<<<<<< HEAD
        // Дополнительная логика обработки прогнозов...
        res.json(predictions);

=======
        const matchIds = predictions.map(p => p.match_id);
        const placeholders = matchIds.map(() => '?').join(',');

        const [matches, results] = await Promise.all([
            new Promise((resolve, reject) => {
                db.all(
                    `SELECT id, homeTeam, awayTeam, 
                    strftime('%Y-%m-%d %H:%M:%S', matchDate) as matchDate, 
                    status FROM matches WHERE id IN (${placeholders})`,
                    matchIds,
                    function(err, rows) {
                        if (err) return reject(err);
                        resolve(rows);
                    }
                );
            }),
            new Promise((resolve, reject) => {
                db.all(
                    `SELECT match_id, home_goals, away_goals 
                    FROM results WHERE match_id IN (${placeholders})`,
                    matchIds,
                    function(err, rows) {
                        if (err) return reject(err);
                        resolve(rows);
                    }
                );
            })
        ]);

        const response = predictions.map(pred => {
            const match = matches.find(m => m.id === pred.match_id) || {};
            const result = results.find(r => r.match_id === pred.match_id) || {};

            return {
                id: pred.id,
                matchId: pred.match_id,
                forecast: pred.forecast,
                createdAt: pred.created_at,
                updatedAt: pred.updated_at,
                match: {
                    homeTeam: match.homeTeam || `Матч #${pred.match_id}`,
                    awayTeam: match.awayTeam || '',
                    date: match.matchDate,
                    status: match.status,
                    result: {
                        home: result.home_goals,
                        away: result.away_goals
                    }
                }
            };
        });

        res.json(response);
>>>>>>> origin/main
    } catch (err) {
        console.error('Ошибка при загрузке прогнозов:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;