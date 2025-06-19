// public\js\utils\logger.js

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Создаём папку logs, если её нет
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Формат лога: timestamp + уровень + сообщение
const format = winston.format(({ level, message, timestamp }) => {
  return { message: `${timestamp} [${level.toUpperCase()}]: ${message}` };
})();

const logger = winston.createLogger({
  level: 'debug', // минимальный уровень логов
  format: winston.format.combine(
    winston.format.timestamp(),
    format,
    winston.format.printf(info => info.message)
  ),
  transports: [
    // Только запись в файл
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      level: 'info' // можно изменить на 'debug' или 'warn' при необходимости
    })
  ]
});

module.exports = logger;