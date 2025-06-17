// db.js
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error("❌ Ошибка подключения к SQLite:", err.message);
    } else {
        console.log("✅ Подключились к SQLite");
        db.serialize(() => {
            // Таблица матчей
            db.run(`
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
                )
            `);
            
            // Таблица результатов матчей
            db.run(`
                CREATE TABLE IF NOT EXISTS results (
                    match_id INTEGER PRIMARY KEY,
                    home_goals INTEGER,
                    away_goals INTEGER,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Таблица прогнозов пользователей
            db.run(`
                CREATE TABLE IF NOT EXISTS predictions (
                    username TEXT NOT NULL,
                    match_id INTEGER NOT NULL,
                    forecast TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_count INTEGER NOT NULL DEFAULT 0,
                    UNIQUE(username, match_id)
                )
            `);
            
            // Таблица пользователей (обновленная версия)
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL CHECK(length(username) >= 3),
                    email TEXT UNIQUE CHECK(email LIKE '%_@__%.__%'),
                    phone TEXT CHECK(
                        phone IS NULL OR 
                        phone GLOB '+[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' OR 
                        phone GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                    ),
                    password_hash TEXT NOT NULL CHECK(length(password_hash) >= 8),
                    role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
                    is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_login_at DATETIME,
                    is_deleted INTEGER DEFAULT 0 CHECK(is_deleted IN (0, 1)),
                    deleted_at DATETIME
                )
            `);
            
            // Добавляем триггер для обновления времени
            db.run(`
                CREATE TRIGGER IF NOT EXISTS update_users_timestamp
                AFTER UPDATE ON users
                FOR EACH ROW
                BEGIN
                    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
                END
            `);
            
            // Создаем индекс для телефона (опционально)
            db.run(`
                CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)
            `);
        });
    }
});

// Функция для валидации номера телефона
function validatePhone(phone) {
    if (!phone) return true; // Разрешаем NULL значения
    return /^\+?[0-9]{10,15}$/.test(phone);
}

// Расширяем объект db дополнительными методами
db.validatePhone = validatePhone;

module.exports = db;