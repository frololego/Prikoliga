const sqlite3 = require('sqlite3').verbose();
const path = require('node:path');
const fs = require('fs');
const winston = require('logger');

const dbPath = path.resolve(__dirname, 'database.sqlite');

// Проверяем наличие файла базы данных
if (!fs.existsSync(dbPath)) {
    winston.error('Файл базы данных не найден:', dbPath);
    process.exit(1); // Завершаем процесс, если файл базы данных не найден
}

// Подключаемся к базе данных
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        winston.error(`Ошибка подключения к SQLite: ${err.message}`);
        process.exit(1); // Завершаем процесс при ошибке подключения
    } else {
        winston.info('Подключено к SQLite');
    }
});

// Включаем поддержку внешних ключей
db.run('PRAGMA foreign_keys = ON;', function (err) {
    if (err) {
        winston.warn(`Не удалось включить внешние ключи: ${err.message}`);
    } else {
        winston.info('Внешние ключи успешно включены');
    }
});

module.exports = db;