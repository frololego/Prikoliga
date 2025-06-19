// config/db.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../logger');

const dbPath = path.resolve(__dirname, '../database.sqlite');

function openDatabase() {
    return new sqlite3.Database(dbPath, (err) => {
        if (err) {
            const errorMessage = `Ошибка подключения к SQLite: ${err.message}`;
            logger.error(errorMessage);
            console.error(errorMessage);
            return;
        }

        logger.info('Подключено к SQLite');

        initializeTables();
    });
}

function initializeTables() {
    // --- Таблица matches ---
    const createMatchesTable = `
        CREATE TABLE IF NOT EXISTS matches (
            match_id INTEGER PRIMARY KEY,
            homeTeam TEXT NOT NULL,
            awayTeam TEXT NOT NULL,
            utcDate TEXT NOT NULL,
            status TEXT DEFAULT 'SCHEDULED',
            leagueName TEXT NOT NULL,
            country TEXT NOT NULL,
            round TEXT NOT NULL,
            year INTEGER NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`;

    db.run(createMatchesTable, (err) => {
        if (err) {
            logger.error(`Ошибка при создании таблицы matches: ${err.message}`);
        } else {
            logger.debug('Таблица matches готова');
        }
    });

    // --- Таблица users ---
    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL CHECK(length(username) >= 3),
            email TEXT UNIQUE CHECK(email LIKE '%_@__%.__%'),
            phone TEXT CHECK(phone GLOB '+[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' OR 
                          phone GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
            password_hash TEXT NOT NULL CHECK(length(password_hash) >= 8),
            role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
            is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login_at DATETIME,
            is_deleted INTEGER DEFAULT 0 CHECK(is_deleted IN (0, 1)),
            deleted_at DATETIME,
            verification_code TEXT,
            is_verified INTEGER DEFAULT 0 CHECK(is_verified IN (0, 1))
        )`;

    db.run(createUsersTable, (err) => {
        if (err) {
            logger.error(`Ошибка при создании таблицы users: ${err.message}`);
        } else {
            logger.debug('Таблица users готова');
        }
    });

    // --- Таблица predictions ---
    const createPredictionsTable = `
        CREATE TABLE IF NOT EXISTS predictions (
            username TEXT NOT NULL,
            match_id INTEGER NOT NULL,
            forecast TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            update_count INTEGER DEFAULT 0,
            FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE,
            CHECK (username != '' AND username != 'undefined')
        )`;

    db.run(createPredictionsTable, (err) => {
        if (err) {
            logger.error(`Ошибка при создании таблицы predictions: ${err.message}`);
        } else {
            logger.debug('Таблица predictions готова');
        }
    });

    // --- Таблица results ---
    const createResultsTable = `
        CREATE TABLE IF NOT EXISTS results (
            match_id INTEGER PRIMARY KEY,
            home_goals INTEGER,
            away_goals INTEGER,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`;

    db.run(createResultsTable, (err) => {
        if (err) {
            logger.error(`Ошибка при создании таблицы results: ${err.message}`);
        } else {
            logger.debug('Таблица results готова');
        }
    });

    // --- Индекс idx_unique_user_match ---
    const createIndexUserMatch = `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_match ON predictions(username, match_id)`;

    db.run(createIndexUserMatch, (err) => {
        if (err) {
            logger.error(`Ошибка при создании индекса idx_unique_user_match: ${err.message}`);
        } else {
            logger.debug('Индекс idx_unique_user_match создан');
        }
    });

    // --- Индекс idx_users_phone ---
    const createIndexUsersPhone = `
        CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`;

    db.run(createIndexUsersPhone, (err) => {
        if (err) {
            logger.error(`Ошибка при создании индекса idx_users_phone: ${err.message}`);
        } else {
            logger.debug('Индекс idx_users_phone создан');
        }
    });

    // --- Триггер update_users_timestamp ---
    const createTriggerUpdateUsersTimestamp = `
        CREATE TRIGGER IF NOT EXISTS update_users_timestamp
        AFTER UPDATE ON users
        FOR EACH ROW
        BEGIN
            UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
        END`;

    db.run(createTriggerUpdateUsersTimestamp, (err) => {
        if (err) {
            logger.error(`Ошибка при создании триггера update_users_timestamp: ${err.message}`);
        } else {
            logger.debug('Триггер update_users_timestamp создан');
        }
    });
}

const db = openDatabase();

module.exports = db;