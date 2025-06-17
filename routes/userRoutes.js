const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const db = require('../db');

/**
 * Обновление имени пользователя
 * PUT /api/user/rename
 */
router.put('/rename', auth, async (req, res) => {
    console.log('--- /rename запрос ---');
    console.log('Headers:', req.headers);
    console.log('User:', req.user);
    console.log('Body:', req.body);

    const { newUsername } = req.body;
    const userId = req.user.id;
    const currentUsername = req.user.username;

    if (!newUsername || newUsername.length < 3) {
        return res.status(400).json({ error: 'Имя пользователя должно содержать минимум 3 символа' });
    }

    db.get('SELECT id FROM users WHERE id = ? AND is_deleted = 0', [userId], (err, user) => {
        if (err) {
            console.error('DB error:', err);
            return res.status(500).json({ error: 'Ошибка БД' });
        }

        if (!user) {
            console.log(`User ${userId} not found in DB`);
            return res.status(404).json({ error: 'Пользователь не найден или удален' });
        }

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
});

/**
 * Удаление аккаунта (soft delete)
 * DELETE /api/user/delete
 */
router.delete('/delete', auth, async (req, res) => {
    const userId = req.user.id;
    const username = req.user.username;
    const currentDate = new Date().toISOString();
    
    console.log('Запрос на мягкое удаление аккаунта для пользователя:', userId);

    try {
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

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

                db.run(
                    `UPDATE users SET 
                    is_deleted = 1,
                    deleted_at = ?,
                    is_active = 0,
                    username = username || '_deleted_' || ?,
                    email = email || '_deleted_' || ?
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
                        db.run('COMMIT');
                        resolve();
                    }
                );
            });
        });

        res.json({ 
            success: true,
            message: 'Аккаунт успешно деактивирован (данные сохранены)'
        });

    } catch (err) {
        console.error('Ошибка при мягком удалении:', err);
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
router.get('/me', auth, async (req, res) => {
    try {
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, username, email, phone, role, 
                strftime('%Y-%m-%d %H:%M:%S', created_at) as created_at,
                strftime('%Y-%m-%d %H:%M:%S', updated_at) as updated_at
                FROM users 
                WHERE id = ? AND is_deleted = 0`,
                [req.user.id],
                function(err, row) {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден или удален' });
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
router.put('/update-phone', auth, async (req, res) => {
    const { phone } = req.body;
    const userId = req.user.id;

    const phoneRegex = /^\+?\d{10,15}$/;
    if (!phone || !phoneRegex.test(phone)) {
        return res.status(400).json({ 
            error: 'Некорректный формат номера. Используйте международный формат (+79123456789)' 
        });
    }

    try {
        const existingUser = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM users 
                WHERE phone = ? AND id != ? AND is_deleted = 0`,
                [phone, userId],
                function(err, row) {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (existingUser) {
            return res.status(400).json({ 
                error: 'Этот номер уже используется другим пользователем' 
            });
        }

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE users SET 
                phone = ?, 
                updated_at = datetime("now") 
                WHERE id = ? AND is_deleted = 0`,
                [phone, userId],
                function(err) {
                    if (err) return reject(err);
                    if (this.changes === 0) {
                        return reject(new Error('Пользователь не найден или удален'));
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
            );
        });

        if (!predictions.length) {
            return res.json([]);
        }

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
    } catch (err) {
        console.error('Ошибка при загрузке прогнозов:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;