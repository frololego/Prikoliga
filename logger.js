// logger.js

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Путь к папке logs в корне проекта
const logDir = path.resolve(__dirname, 'logs');
const logFile = path.join(logDir, 'app.log');

// Создаем папку logs, если её нет
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Формат даты: YYYY-MM-DD HH:mm:ss
function formatTime(date) {
    const d = new Date(date);
    const datePart = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
    ].join('-');

    const timePart = [
        String(d.getHours()).padStart(2, '0'),
        String(d.getMinutes()).padStart(2, '0'),
        String(d.getSeconds()).padStart(2, '0')
    ].join(':');

    return `${datePart} ${timePart}`;
}

// Кастомный формат логов
const myFormat = winston.format.printf(({ level, message, timestamp }) => {
    const isoTimestamp = timestamp ? new Date(timestamp) : new Date();
    return `[${formatTime(isoTimestamp)}] [${level.toUpperCase()}] ${message}`;
});

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        myFormat
    ),
    transports: [
        new winston.transports.File({ filename: logFile }),
        // new winston.transports.Console() // раскомментировать для вывода в консоль
    ]
});

module.exports = logger;