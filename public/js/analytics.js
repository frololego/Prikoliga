// routes/analyticsRoutes.js

const express = require('express');
const db = require('db');
const axios = require('axios');
const winston = require('services/logger');
require('dotenv').config();

const router = express.Router();
const { wrapAsync } = require('controllers/baseController');

// Устанавливаем заголовки для всех ответов
router.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    next();
});

// === Роут: Получение аналитики ===
router.get('/', wrapAsync(async (req, res) => {
    winston.info('➡️ Запрос аналитики получен');

    // 1. Проверяем авторизацию
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        winston.warn('⚠️ Запрос без токена авторизации');
        return res.status(401).json({ error: 'Требуется авторизация' });
    }

    // 2. Проверяем и обновляем результаты матчей
    winston.info('🔄 Проверка необходимости обновления результатов...');
    await checkAndUpdateResults();

    // 3. Получаем аналитику только по завершенным матчам
    winston.info('📊 Расчет аналитики пользователей...');
    const analyticsData = await calculateUserAnalytics();

    if (!analyticsData.length) {
        winston.warn('⚠️ Нет данных для отображения');
        return res.status(404).json({ error: 'Нет данных для отображения' });
    }

    winston.info(`✅ Отправлено ${analyticsData.length} записей`);
    return res.json(analyticsData);
}));

// === Вспомогательные функции ===

async function checkAndUpdateResults() {
    const lastUpdate = await new Promise((resolve, reject) => {
        db.get('SELECT updated_at FROM results ORDER BY updated_at DESC LIMIT 1', (err, row) => {
            if (err) {
                winston.error(`❌ Ошибка БД при проверке результатов: ${err.message}`);
                reject(err);
            } else {
                resolve(row?.updated_at);
            }
        });
    });

    const oneHourAgo = new Date(Date.now() - 3600000);
    const needsUpdate = !lastUpdate || new Date(lastUpdate) < oneHourAgo;

    if (needsUpdate) {
        winston.info('🔄 Требуется обновление результатов');
        await updateMatchResults();
    } else {
        winston.info('🕒 Результаты актуальны, обновление не требуется');
    }
}

async function calculateUserAnalytics() {
    winston.info('🔍 Получение списка пользователей...');

    const users = await new Promise((resolve, reject) => {
        db.all(`
            SELECT DISTINCT username 
            FROM predictions 
            WHERE username IS NOT NULL 
              AND username != ''
              AND TRIM(username) != ''
        `, (err, rows) => {
            if (err) {
                winston.error(`❌ Ошибка при получении пользователей: ${err.message}`);
                reject(err);
            } else {
                resolve(rows.map(row => row.username).filter(Boolean));
            }
        });
    });

    if (!users.length) {
        winston.warn('⚠️ В базе нет пользователей с прогнозами');
        return [];
    }

    winston.info(`📝 Найдено ${users.length} пользователей`);

    const statsPromises = users.map(username => getUserStats(username));
    const results = await Promise.all(statsPromises);

    return results.filter(Boolean); // фильтруем null
}

async function getUserStats(username) {
    winston.info(`📊 Расчет статистики для ${username}`);

    if (!username || username.trim() === '') {
        winston.warn(`⚠️ Пустое имя пользователя, пропускаем`);
        return null;
    }

    const predictions = await new Promise((resolve, reject) => {
        const query = `
            SELECT p.match_id, p.forecast, r.home_goals, r.away_goals
            FROM predictions p
            JOIN results r ON p.match_id = r.match_id
            WHERE p.username = ? 
              AND r.home_goals IS NOT NULL 
              AND r.away_goals IS NOT NULL
        `;
        db.all(query, [username], (err, rows) => {
            if (err) {
                winston.error(`❌ Ошибка получения прогнозов для ${username}: ${err.message}`);
                reject(err);
            } else {
                resolve(rows || []);
            }
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
                winston.error(`❌ Ошибка подсчёта прогнозов для ${username}: ${err.message}`);
                reject(err);
            } else {
                resolve(row?.count || 0);
            }
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
        stats.accuracyPercentage = Math.round(((stats.correct + stats.partial) / stats.finishedPredictions) * 100);
        stats.rating = stats.correct * 3 + stats.partial;
    }

    winston.info(`✅ Статистика для ${username} готова`);
    return stats;
}

async function updateMatchResults() {
    winston.info('🔄 Начало обновления результатов матчей');

    const unfinishedMatches = await new Promise((resolve, reject) => {
        db.all(`
            SELECT DISTINCT p.match_id, m.homeTeam, m.awayTeam 
            FROM predictions p
            LEFT JOIN results r ON p.match_id = r.match_id
            LEFT JOIN matches m ON p.match_id = m.match_id
            WHERE r.home_goals IS NULL OR r.away_goals IS NULL
        `, (err, rows) => {
            if (err) {
                winston.error(`❌ Ошибка получения незавершенных матчей: ${err.message}`);
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });

    if (!unfinishedMatches.length) {
        winston.info('✅ Нет незавершенных матчей для обновления');
        return;
    }

    winston.info(`🔍 Найдено ${unfinishedMatches.length} незавершенных матчей`);

    const apiKey = process.env.API_KEY_SSTATS;
    if (!apiKey) {
        winston.error('❌ Отсутствует API_KEY_SSTATS в переменных окружения');
        throw new Error('API_KEY_SSTATS не найден');
    }

    let updatedCount = 0;

    for (const match of unfinishedMatches) {
        try {
            winston.info(`🔄 Обновление матча ${match.match_id} (${match.homeTeam} vs ${match.awayTeam})`);

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
                                winston.error(`❌ Ошибка сохранения результатов для матча ${match.match_id}: ${err.message}`);
                                reject(err);
                            } else {
                                winston.info(`✅ Результаты матча ${match.match_id} сохранены`);
                                updatedCount++;
                                resolve();
                            }
                        });
                    });
                }
            }
        } catch (err) {
            winston.warn(`⚠️ Ошибка обновления матча ${match.match_id}: ${err.message}`);
        }
    }

    winston.info(`✅ Обновлено ${updatedCount} результатов матчей`);
}

module.exports = router;