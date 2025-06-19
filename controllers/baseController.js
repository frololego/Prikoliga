// controllers/baseController.js

const winston = require('services/logger');

/**
 * Обёртка для асинхронных контроллеров
 * @param {Function} fn - Асинхронный контроллер
 */
const wrapAsync = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch((err) => {
            winston.error(`❌ Ошибка в контроллере: ${err.message}`, { error: err });
            res.status(500).json({ error: 'Внутренняя ошибка сервера' });
        });
    };
};

module.exports = { wrapAsync };