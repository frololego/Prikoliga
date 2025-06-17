// leagues.js
const fs = require('fs');

let LEAGUES = [];
try {
    const rawdata = fs.readFileSync('leagues.json');
    LEAGUES = JSON.parse(rawdata);
    console.log(`✅ Список лиг загружен (${LEAGUES.length} лиг)`);
} catch (err) {
    console.error("❌ Не удалось загрузить список лиг:", err.message);
}

module.exports = LEAGUES;