// routes/analyticsRoutes.js

const express = require('express');
const db = require('config/db');
const axios = require('axios');
const logger = require('logger');
require('dotenv').config();

const router = express.Router();

// === Middleware для заголовков ===
router.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    next();
});

// === Основной роут для получения аналитики ===
router.get('/', async (req, res) => {
    logger.info('➡️ Запрос аналитики получен');

    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            logger.warn('⚠️ Запрос без токена авторизации');
            return res.status(401).json({ error: 'Требуется авторизация' });
        }

        logger.debug('🔄 Проверка необходимости обновления результатов...');
        await checkAndUpdateResults();

        logger.debug('📊 Расчет аналитики пользователей...');
        const analyticsData = await calculateUserAnalytics();

        if (!analyticsData.length) {
            logger.warn('⚠️ Нет данных для отображения');
            return res.status(404).json({ error: 'Нет данных для отображения' });
        }

        logger.info(`✅ Отправлено ${analyticsData.length} записей`);
        return res.json(analyticsData);

    } catch (err) {
        logger.error(`❌ Ошибка в основном роуте: ${err.message}`);
        return res.status(500).json({
            error: 'Ошибка сервера',
            ...(process.env.NODE_ENV === 'development' && { details: err.message })
        });
    }
});

// === Вспомогательные функции ===

async function checkAndUpdateResults() {
    try {
        const lastUpdate = await new Promise((resolve, reject) => {
            db.get('SELECT updated_at FROM results ORDER BY updated_at DESC LIMIT 1', (err, row) => {
                if (err) {
                    logger.error(`❌ Ошибка БД при проверке результатов: ${err.message}`);
                    return reject(err);
                }
                resolve(row?.updated_at);
            });
        });

        const oneHourAgo = new Date(Date.now() - 3600000);
        const needsUpdate = !lastUpdate || new Date(lastUpdate) < oneHourAgo;

        if (needsUpdate) {
            logger.info('🔄 Требуется обновление результатов');
            await updateMatchResults();
        } else {
            logger.info('🕒 Результаты актуальны, обновление не требуется');
        }
    } catch (err) {
        logger.error(`❌ Критическая ошибка при проверке результатов: ${err.message}`);
        throw err;
    }
}

async function calculateUserAnalytics() {
    try {
        logger.info('🔍 Получение списка пользователей...');

        const users = await new Promise((resolve, reject) => {
            db.all(`
                SELECT DISTINCT username 
                FROM predictions 
                WHERE username IS NOT NULL 
                AND username != ''
                AND TRIM(username) != ''
            `, (err, rows) => {
                if (err) {
                    logger.error(`❌ Ошибка при получении пользователей: ${err.message}`);
                    return reject(err);
                }

                resolve(rows
                    .map(row => row.username)
                    .filter(username => username && username.trim() !== '')
                );
            });
        });

        if (!users.length) {
            logger.warn('⚠️ В базе нет пользователей с прогнозами');
            return [];
        }

        logger.info(`📝 Найдено ${users.length} пользователей`);
        const statsPromises = users.map(username => getUserStats(username));
        return (await Promise.all(statsPromises)).filter(Boolean);
    } catch (err) {
        logger.error(`❌ Ошибка расчета аналитики: ${err.message}`);
        throw err;
    }
}

async function getUserStats(username) {
    logger.debug(`📊 Расчет статистики для ${username}`);

    if (!username || username.trim() === '') {
        logger.warn(`⚠️ Пустое имя пользователя, пропускаем`);
        return null;
    }

    try {
        // Прогнозы по завершенным матчам
        const predictions = await new Promise((resolve, reject) => {
            const query = `
                SELECT p.match_id, p.forecast, r.home_goals, r.away_goals
                FROM predictions p
                JOIN results r ON p.match_id = r.match_id
                WHERE p.username = ? 
                  AND p.username IS NOT NULL
                  AND p.username != ''
                  AND r.home_goals IS NOT NULL 
                  AND r.away_goals IS NOT NULL
            `;

            db.all(query, [username], (err, rows) => {
                if (err) {
                    logger.error(`❌ Ошибка при получении прогнозов для ${username}: ${err.message}`);
                    return reject(err);
                }
                resolve(rows || []);
            });
        });

        const stats = {
            username,
            totalPredictions: 0,
            finishedPredictions: predictions.length,
            correct: 0,
            partial: 0,
            wrong: 0,
            accuracyPercentage: 0,
            rating: 0
        };

        const totalCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM predictions WHERE username = ?', [username], (err, row) => {
                if (err) {
                    logger.error(`❌ Ошибка при подсчёте прогнозов для ${username}: ${err.message}`);
                    return reject(err);
                }
                resolve(row?.count || 0);
            });
        });

        stats.totalPredictions = totalCount;

        predictions.forEach(pred => {
            const { home_goals, away_goals, forecast } = pred;
            const [userHome, userAway] = forecast.split(':').map(Number);

            if (userHome === home_goals && userAway === away_goals) {
                stats.correct++;
            } else {
                const userOutcome = Math.sign(userHome - userAway);
                const actualOutcome = Math.sign(home_goals - away_goals);
                if (userOutcome === actualOutcome) {
                    stats.partial++;
                } else {
                    stats.wrong++;
                }
            }
        });

        if (stats.finishedPredictions > 0) {
            stats.accuracyPercentage = Math.round(
                ((stats.correct + stats.partial) / stats.finishedPredictions) * 100
            );
            stats.rating = stats.correct * 3 + stats.partial;
        }

        logger.info(`✅ Статистика для ${username} готова`);
        return stats;

    } catch (err) {
        logger.error(`❌ Ошибка расчета статистики для ${username}: ${err.message}`);
        return {
            username,
            totalPredictions: 0,
            finishedPredictions: 0,
            correct: 0,
            partial: 0,
            wrong: 0,
            accuracyPercentage: 0,
            rating: 0
        };
    }
}

async function updateMatchResults() {
    logger.info('🔄 Начало обновления результатов матчей');

    try {
        const unfinishedMatches = await new Promise((resolve, reject) => {
            db.all(`
                SELECT DISTINCT p.match_id, m.homeTeam, m.awayTeam 
                FROM predictions p
                LEFT JOIN results r ON p.match_id = r.match_id
                LEFT JOIN matches m ON p.match_id = m.match_id
                WHERE r.home_goals IS NULL OR r.away_goals IS NULL
            `, (err, rows) => {
                if (err) {
                    logger.error(`❌ Ошибка при получении незавершённых матчей: ${err.message}`);
                    return reject(err);
                }
                resolve(rows || []);
            });
        });

        if (!unfinishedMatches.length) {
            logger.info('✅ Нет незавершённых матчей для обновления');
            return;
        }

        logger.info(`🔍 Найдено ${unfinishedMatches.length} незавершённых матчей`);
        const apiKey = process.env.API_KEY_SSTATS;

        if (!apiKey) {
            logger.error('❌ Отсутствует API_KEY_SSTATS в переменных окружения');
            throw new Error('API_KEY_SSTATS отсутствует');
        }

        let updatedCount = 0;

        for (const match of unfinishedMatches) {
            try {
                logger.info(`🔄 Обновление матча ${match.match_id} (${match.homeTeam} vs ${match.awayTeam})`);

                const response = await axios.get(`https://api.sstats.net/games/${match.match_id}`,  {
                    params: { apikey: apiKey },
                    timeout: 10000
                });

                if (response.data?.status === 'OK') {
                    const game = response.data.data.game;

                    if (game.homeResult !== null && game.awayResult !== null) {
                        await new Promise((resolve, reject) => {
                            db.run(`
                                INSERT OR REPLACE INTO results 
                                (match_id, home_goals, away_goals, updated_at)
                                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                            `, [match.match_id, game.homeResult, game.awayResult], (err) => {
                                if (err) {
                                    logger.error(`❌ Ошибка сохранения результатов для матча ${match.match_id}: ${err.message}`);
                                    return reject(err);
                                }

                                logger.info(`✅ Результаты матча ${match.match_id} сохранены`);
                                updatedCount++;
                                resolve();
                            });
                        });
                    }
                }
            } catch (err) {
                logger.error(`⚠️ Ошибка при обновлении матча ${match.match_id}: ${err.message}`);
            }
        }

        logger.info(`✅ Обновлено ${updatedCount} результатов матчей`);
    } catch (err) {
        logger.error(`❌ Критическая ошибка при обновлении результатов: ${err.message}`);
        throw err;
    }
}

module.exports = router;