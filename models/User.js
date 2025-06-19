// models/User.js

const sqlite3 = require('sqlite3').verbose();
const db = require('config/db');
const logger = require('logger');

const User = {
    // === Поиск пользователя по имени ===
    findByUsername: async function(username) {
        logger.debug(`🔍 Поиск пользователя по имени: ${username}`);
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
                if (err) {
                    logger.error(`❌ Ошибка при поиске пользователя: ${err.message}`);
                    return reject(err);
                }
                resolve(row);
            });
        });
    },

    // === Создание пользователя ===
    create: async function(username, hashedPassword) {
        logger.info(`🆕 Создание пользователя: ${username}`);
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO users (username, password_hash) VALUES (?, ?)',
                [username, hashedPassword],
                function (err) {
                    if (err) {
                        logger.error(`❌ Ошибка при создании пользователя: ${err.message}`);
                        return reject(err);
                    }
                    logger.info(`✅ Пользователь создан, ID: ${this.lastID}`);
                    resolve({ id: this.lastID });
                }
            );
        });
    },

    // === Получение пользователя по ID ===
    findById: async function(id) {
        logger.debug(`🔍 Получение пользователя по ID: ${id}`);
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
                if (err) {
                    logger.error(`❌ Ошибка при получении пользователя по ID: ${err.message}`);
                    return reject(err);
                }
                resolve(row);
            });
        });
    },

    // === Все пользователи ===
    getAll: async function() {
        logger.debug(`📚 Запрос всех пользователей`);
        return new Promise((resolve, reject) => {
            db.all('SELECT id, username, created_at FROM users', [], (err, rows) => {
                if (err) {
                    logger.error(`❌ Ошибка при запросе всех пользователей: ${err.message}`);
                    return reject(err);
                }
                resolve(rows);
            });
        });
    }
};

module.exports = User;