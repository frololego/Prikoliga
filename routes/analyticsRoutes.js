const express = require('express');
const db = require('../db');
const axios = require('axios');
require('dotenv').config();

const router = express.Router();

// Устанавливаем заголовки для всех ответов
router.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// === Основной роут для получения аналитики ===
router.get('/', async (req, res) => {
  console.log('➡️ Запрос аналитики получен');
  
  try {
    // 1. Проверяем авторизацию
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      console.warn('⚠️ Запрос без токена авторизации');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    // 2. Проверяем и обновляем результаты матчей
    console.log('🔄 Проверка необходимости обновления результатов...');
    await checkAndUpdateResults();

    // 3. Получаем аналитику только по завершенным матчам
    console.log('📊 Расчет аналитики пользователей...');
    const analyticsData = await calculateUserAnalytics();

    if (!analyticsData.length) {
      console.warn('⚠️ Нет данных для отображения');
      return res.status(404).json({ error: 'Нет данных для отображения' });
    }

    console.log(`✅ Отправлено ${analyticsData.length} записей`);
    return res.json(analyticsData);

  } catch (err) {
    console.error('❌ Ошибка в основном роуте:', err.message);
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
          console.error('❌ Ошибка БД при проверке результатов:', err.message);
          reject(err);
        } else {
          resolve(row?.updated_at);
        }
      });
    });

    const oneHourAgo = new Date(Date.now() - 3600000);
    const needsUpdate = !lastUpdate || new Date(lastUpdate) < oneHourAgo;

    if (needsUpdate) {
      console.log('🔄 Требуется обновление результатов');
      await updateMatchResults();
    } else {
      console.log('🕒 Результаты актуальны, обновление не требуется');
    }
  } catch (err) {
    console.error('❌ Критическая ошибка при проверке результатов:', err.message);
    throw err;
  }
}

async function calculateUserAnalytics() {
  try {
    console.log('🔍 Получение списка пользователей...');
    const users = await new Promise((resolve, reject) => {
      db.all(`
        SELECT DISTINCT username 
        FROM predictions 
        WHERE username IS NOT NULL 
        AND username != ''
        AND TRIM(username) != ''
      `, (err, rows) => {
        if (err) {
          console.error('❌ Ошибка при получении пользователей:', err.message);
          reject(err);
        } else {
          // Дополнительная фильтрация на случай, если БД пропустила NULL
          resolve(rows
            .map(row => row.username)
            .filter(username => username && username.trim() !== '')
          );
        }
      });
    });

    if (!users.length) {
      console.warn('⚠️ В базе нет пользователей с прогнозами');
      return [];
    }

    console.log(`📝 Найдено ${users.length} пользователей`);
    const statsPromises = users.map(username => getUserStats(username));
    return (await Promise.all(statsPromises)).filter(Boolean); // Фильтруем возможные undefined
  } catch (err) {
    console.error('❌ Ошибка расчета аналитики:', err.message);
    throw err;
  }
}

async function getUserStats(username) {
  console.log(`📊 Расчет статистики для ${username}`);
  if (!username || username.trim() === '') {
    console.warn(`⚠️ Пустое имя пользователя, пропускаем`);
    return null; // Вернем null, который потом отфильтруется
  }

  try {
    // Получаем только прогнозы по завершенным матчам
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
          console.error(`❌ Ошибка при получении прогнозов для ${username}:`, err.message);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });

    const stats = {
      username,
      totalPredictions: 0, // Общее количество прогнозов (включая незавершенные)
      finishedPredictions: predictions.length, // Только по завершенным матчам
      correct: 0,
      partial: 0,
      wrong: 0,
      accuracyPercentage: 0,
      rating: 0
    };

    // Получаем общее количество прогнозов пользователя
    const totalCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM predictions WHERE username = ?', [username], (err, row) => {
        if (err) {
          console.error(`❌ Ошибка при подсчете прогнозов для ${username}:`, err.message);
          reject(err);
        } else {
          resolve(row?.count || 0);
        }
      });
    });

    stats.totalPredictions = totalCount;

    // Анализируем только завершенные матчи
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

    // Рассчитываем процент точности только по завершенным матчам
    if (stats.finishedPredictions > 0) {
      stats.accuracyPercentage = Math.round(
        ((stats.correct + stats.partial) / stats.finishedPredictions) * 100
      );
      stats.rating = stats.correct * 3 + stats.partial;
    }

    console.log(`✅ Статистика для ${username} готова`);
    return stats;
  } catch (err) {
    console.error(`❌ Ошибка расчета статистики для ${username}:`, err.message);
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
  console.log('🔄 Начало обновления результатов матчей');
  
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
          console.error('❌ Ошибка при получении незавершенных матчей:', err.message);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });

    if (!unfinishedMatches.length) {
      console.log('✅ Нет незавершенных матчей для обновления');
      return;
    }

    console.log(`🔍 Найдено ${unfinishedMatches.length} незавершенных матчей`);
    const apiKey = process.env.API_KEY_SSTATS;
    
    if (!apiKey) {
      throw new Error('❌ Отсутствует API_KEY_SSTATS в переменных окружения');
    }

    let updatedCount = 0;
    
    for (const match of unfinishedMatches) {
      try {
        console.log(`🔄 Обновление матча ${match.match_id} (${match.homeTeam} vs ${match.awayTeam})`);
        
        const response = await axios.get(`https://api.sstats.net/games/${match.match_id}`, {
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
                  console.error(`❌ Ошибка сохранения результатов для матча ${match.match_id}:`, err.message);
                  reject(err);
                } else {
                  console.log(`✅ Результаты матча ${match.match_id} сохранены`);
                  updatedCount++;
                  resolve();
                }
              });
            });
          }
        }
      } catch (err) {
        console.error(`⚠️ Ошибка при обновлении матча ${match.match_id}:`, err.message);
      }
    }

    console.log(`✅ Обновлено ${updatedCount} результатов матчей`);
  } catch (err) {
    console.error('❌ Критическая ошибка при обновлении результатов:', err.message);
    throw err;
  }
}

module.exports = router;