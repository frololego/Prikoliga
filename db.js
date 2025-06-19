// db.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const winston = require('services/logger');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        winston.error(`Ошибка подключения к SQLite: ${err.message}`);
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