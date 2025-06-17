const sqlite3 = require('sqlite3').verbose();

// Подключаемся к базе
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error("❌ Ошибка подключения к базе:", err.message);
    } else {
        console.log("✅ Подключились к базе");
    }
});

// Получаем все прогнозы пользователя
db.all("SELECT * FROM predictions WHERE username = 'user123'", [], (err, rows) => {
    if (err) {
        console.error("❌ Ошибка запроса к БД:", err.message);
    } else {
        console.log("🎯 Прогнозы пользователя user123:");
        console.table(rows);
    }
});

// Получаем результаты матчей
db.all("SELECT * FROM results", [], (err, rows) => {
    if (err) {
        console.error("❌ Ошибка при получении результатов:", err.message);
    } else {
        console.log("🏆 Результаты матчей:");
        console.table(rows);
    }

    // Закрываем соединение
    db.close();
});