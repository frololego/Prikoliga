// routes/matchRoutes.js
const express = require('express');
const fetch = require('node-fetch');
const db = require('../db');
const LEAGUES = require('../leagues');

const router = express.Router();
const API_KEY = process.env.SSTATS_API_KEY || '75kwgw7361l0l1ir';

// ========================
// Вспомогательные функции
// ========================

/**
 * Группирует матчи по локализованным датам
 */
function groupMatchesByDay(matches) {
    const matchesByDay = {};
    
    matches.forEach(match => {
        try {
            const matchDate = new Date(match.utcDate);
            const localeDate = matchDate.toLocaleDateString('ru-RU', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            if (!matchesByDay[localeDate]) {
                matchesByDay[localeDate] = [];
            }

            matchesByDay[localeDate].push({
                match_id: match.match_id,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                utcDate: match.utcDate, // ISO строка
                status: match.status,
                leagueName: match.leagueName,
                country: match.country,
                round: match.round
            });
        } catch (e) {
            console.error("❌ Ошибка обработки матча:", e);
        }
    });

    return matchesByDay;
}

/**
 * Загружает матчи из API и сохраняет в БД
 */
async function fetchAndSaveMatches(leagueId) {
    let allMatches = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        const response = await fetch(
            `https://api.sstats.net/games/list?LeagueId=${leagueId}&Year=2025&offset=${offset}`,
            { headers: { 'apikey': API_KEY } }
        );

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        if (!data.data || data.data.length === 0) break;

        // Преобразуем матчи API в наш формат
        const league = LEAGUES.find(l => l.id == leagueId) || {};
        const matches = data.data.map(match => ({
            match_id: match.id,
            homeTeam: match.homeTeam?.name || 'Unknown',
            awayTeam: match.awayTeam?.name || 'Unknown',
            utcDate: new Date(match.dateUtc * 1000).toISOString(),
            status: match.status === 8 ? 'FINISHED' : 'SCHEDULED',
            leagueName: league.name || 'Unknown',
            country: league.country || 'Unknown',
            round: match.roundName || 'Unknown',
            year: match.season?.year || new Date().getFullYear()
        }));

        allMatches = [...allMatches, ...matches];
        offset += data.data.length;
        hasMore = data.data.length >= 1000;
    }

    // Сохраняем в БД
    const insertPromises = allMatches.map(match => 
        new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO matches (
                    match_id, homeTeam, awayTeam, utcDate, status, 
                    leagueName, country, round, year
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    match.match_id,
                    match.homeTeam,
                    match.awayTeam,
                    match.utcDate,
                    match.status,
                    match.leagueName,
                    match.country,
                    match.round,
                    match.year
                ],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        })
    );

    await Promise.all(insertPromises);
    return allMatches;
}

// ========================
// Основные роуты
// ========================

/**
 * @api {get} /leagues Получить список лиг
 * @apiName GetLeagues
 */
router.get('/leagues', (req, res) => {
    try {
        res.json(LEAGUES.map(league => ({
            id: league.id,
            name: league.name,
            country: league.country
        })));
    } catch (err) {
        console.error("❌ Ошибка при получении лиг:", err);
        res.status(500).json({ 
            error: "Internal server error",
            details: err.message 
        });
    }
});

/**
 * @api {get} /matches Получить матчи
 * @apiName GetMatches
 */
router.get('/matches', async (req, res) => {
    try {
        // 1. Пробуем получить матчи из БД
        db.all('SELECT * FROM matches', [], async (err, dbMatches) => {
            if (err) {
                console.error("❌ Ошибка БД:", err);
                return res.status(500).json({ 
                    error: "Database error",
                    details: err.message 
                });
            }

            // 2. Если в БД есть данные - возвращаем их
            if (dbMatches && dbMatches.length > 0) {
                return res.json(groupMatchesByDay(dbMatches));
            }

            // 3. Если БД пуста - загружаем из API
            try {
                console.log("⚡ Загрузка матчей из API...");
                const allMatches = [];
                
                for (const league of LEAGUES) {
                    try {
                        const matches = await fetchAndSaveMatches(league.id);
                        allMatches.push(...matches);
                    } catch (apiErr) {
                        console.error(`❌ Ошибка для лиги ${league.id}:`, apiErr);
                    }
                }

                if (allMatches.length === 0) {
                    return res.status(404).json({ 
                        error: "No matches found",
                        details: "Failed to fetch matches from API" 
                    });
                }

                res.json(groupMatchesByDay(allMatches));
            } catch (apiError) {
                console.error("❌ Ошибка API:", apiError);
                res.status(500).json({ 
                    error: "Failed to fetch matches",
                    details: apiError.message 
                });
            }
        });
    } catch (err) {
        console.error("❌ Необработанная ошибка:", err);
        res.status(500).json({ 
            error: "Internal server error",
            details: err.message 
        });
    }
});

/**
 * @api {post} /matches/update Обновить матчи из API
 * @apiName UpdateMatches
 */
router.post('/matches/update', async (req, res) => {
    try {
        console.log("🔄 Запуск обновления матчей...");
        
        const allMatches = [];
        for (const league of LEAGUES) {
            try {
                const matches = await fetchAndSaveMatches(league.id);
                allMatches.push(...matches);
                console.log(`✅ Лига ${league.name}: ${matches.length} матчей`);
            } catch (apiErr) {
                console.error(`❌ Ошибка для лиги ${league.name}:`, apiErr);
            }
        }

        res.json({
            success: true,
            message: `Обновлено ${allMatches.length} матчей`,
            updated: new Date().toISOString()
        });
    } catch (err) {
        console.error("❌ Ошибка обновления:", err);
        res.status(500).json({ 
            error: "Update failed",
            details: err.message 
        });
    }
});

module.exports = router;