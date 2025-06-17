// models/User.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

const User = {
    // === Поиск пользователя по имени ===
    findByUsername: function(username, callback) {
        db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
            if (err) return callback(err);
            callback(null, row);
        });
    },

    // === Создание пользователя ===
    create: function(username, hashedPassword, callback) {
        db.run(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username, hashedPassword],
            function (err) {
                if (err) return callback(err);
                callback(null, this.lastID); // возвращаем ID нового пользователя
            }
        );
    },

    // === Получение пользователя по ID ===
    findById: function(id, callback) {
        db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
            if (err) return callback(err);
            callback(null, row);
        });
    },

    // === Все пользователи ===
    getAll: function(callback) {
        db.all('SELECT id, username, created_at FROM users', [], (err, rows) => {
            if (err) return callback(err);
            callback(null, rows);
        });
    }
};

module.exports = User;