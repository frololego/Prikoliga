const express = require('express');
const db = require('../db');
const axios = require('axios');
require('dotenv').config();

const router = express.Router();

// Убедитесь, что все ответы имеют Content-Type: application/json
router.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// === Роут: Сохранение/обновление прогноза ===
router.post('/', async (req, res) => {
    try {
        const { username, match_id, forecast } = req.body;
        
        if (!username || !match_id || !forecast) {
            console.error("❌ Отсутствуют необходимые параметры:", req.body);
            return res.status(400).json({ error: 'Заполните все поля' });
        }

        const [homeGoals, awayGoals] = forecast.split(':');
        if (!/^\d+$/.test(homeGoals) || !/^\d+$/.test(awayGoals)) {
            console.error(`❌ Неверный формат прогноза для матча ${match_id}:`, forecast);
            return res.status(400).json({ error: 'Прогноз должен иметь формат "число:число"' });
        }

        // Проверяем информацию о матче
        const matchRow = await new Promise((resolve, reject) => {
            db.get('SELECT utcDate FROM matches WHERE match_id = ?', [match_id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!matchRow) {
            console.warn(`⚠️ Матч ${match_id} не найден в базе`);
            return res.status(404).json({ error: 'Матч не найден в базе' });
        }

        const matchDate = new Date(matchRow.utcDate);
        if (matchDate < new Date()) {
            console.warn(`⚠️ Матч ${match_id} уже начался`);
            return res.status(400).json({ error: 'Матч уже начался. Прогноз изменить нельзя' });
        }

        // Сохраняем или обновляем прогноз
        const result = await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO predictions (username, match_id, forecast, update_count) 
                 VALUES (?, ?, ?, 0)
                 ON CONFLICT(username, match_id) 
                 DO UPDATE SET 
                   forecast = excluded.forecast,
                   updated_at = CURRENT_TIMESTAMP,
                   update_count = update_count + 1`,
                [username, match_id, forecast],
                function(err) {
                    if (err) reject(err);
                    else resolve(this);
                }
            );
        });

        const message = result.changes === 1 ? 'Прогноз сохранён' : 'Прогноз обновлён';
        console.log(`✅ Прогноз для матча ${match_id} (${forecast}) ${message}`);
        return res.json({ success: true, message });

    } catch (err) {
        console.error(`❌ Ошибка при сохранении прогноза:`, err.message);
        return res.status(500).json({ error: 'Ошибка сервера при сохранении прогноза' });
    }
});

// === Роут: Получение прогнозов пользователя ===
router.get('/', async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) {
            console.error("❌ Имя пользователя не указано");
            return res.status(400).json({ error: 'Имя пользователя не указано' });
        }

        // Загружаем все прогнозы пользователя
        const allPredictions = await new Promise((resolve, reject) => {
            db.all(
                `SELECT p.*, m.homeTeam, m.awayTeam, m.utcDate AS matchDate, 
                 r.home_goals AS actualHome, r.away_goals AS actualAway 
                 FROM predictions p 
                 LEFT JOIN matches m ON p.match_id = m.match_id 
                 LEFT JOIN results r ON p.match_id = r.match_id 
                 WHERE p.username = ?`,
                [username],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        console.log(`✅ Прогнозы для ${username} загружены (${allPredictions.length})`);

        // Обновляем результаты при необходимости
        const needsUpdate = await new Promise((resolve) => {
            db.get(
                `SELECT updated_at FROM results 
                 ORDER BY updated_at DESC LIMIT 1`,
                (err, row) => {
                    if (err) resolve(true);
                    else resolve(!row?.updated_at || new Date() - new Date(row.updated_at) > 3600000);
                }
            );
        });

        if (needsUpdate) {
            console.log('🔄 Обновление результатов...');
            await updateMatchResults(allPredictions);
        }

        return res.json(allPredictions);

    } catch (err) {
        console.error("❌ Ошибка загрузки прогнозов:", err.message);
        return res.status(500).json({ error: 'Не удалось загрузить прогнозы' });
    }
});

// Функция обновления результатов (остается без изменений)
async function updateMatchResults(allPredictions) {
    // ... ваш существующий код ...
}

module.exports = router;