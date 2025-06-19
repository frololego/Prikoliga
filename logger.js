// logger.js
const fs = require('fs');
const path = require('path');
const moment = require('moment');

const logFilePath = path.join(__dirname, 'logs', 'app.log');

// Проверяем, существует ли директория logs
if (!fs.existsSync(path.dirname(logFilePath))) {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
}

function _log(level, message) {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

    // Пишем в файл
    fs.appendFile(logFilePath, logMessage, err => {
        if (err) console.error('Ошибка записи лога:', err);
    });

    // Выводим в консоль
    switch (level) {
        case 'error':
            console.error(logMessage.trim());
            break;
        case 'warn':
            console.warn(logMessage.trim());
            break;
        default:
            console.log(logMessage.trim());
    }
}

module.exports = {
    log: (msg) => _log('info', msg),
    info: (msg) => _log('info', msg),
    warn: (msg) => _log('warn', msg),
    error: (msg) => _log('error', msg),
    debug: (msg) => {
        if (process.env.NODE_ENV !== 'production') {
            _log('debug', msg);
        }
    }
};