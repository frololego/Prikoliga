// services/emailService.js

const nodemailer = require('nodemailer');
const crypto = require('crypto');
const logger = require('../logger');

// === Конфигурация транспорта ===
const mailConfig = {
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
};

// === Проверка конфигурации при старте ===
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn('⚠️ Email credentials not configured → verification emails will not work');
}

// === Создание транспорта ===
const transporter = nodemailer.createTransport(mailConfig);

// === Генерация 6-значного кода ===
function generateVerificationCode() {
    return crypto.randomInt(100000, 999999).toString();
}

// === Отправка письма с кодом ===
async function sendVerificationEmail(email, code) {
    if (!process.env.EMAIL_USER) {
        logger.warn(`⚠️ Email service not configured. Verification code: ${code}`);
        return true; // Для разработки
    }

    try {
        const mailOptions = {
            from: `"PRIKOLIGA" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Подтверждение регистрации',
            html: `
                <h2>Добро пожаловать в PRIKOLIGA!</h2>
                <p>Ваш код подтверждения: <strong>${code}</strong></p>
                <p>Код действителен 15 минут.</p>
                <p>Если вы не регистрировались, проигнорируйте это письмо.</p>
            `
        };

        await transporter.sendMail(mailOptions);
        logger.info(`📧 Код подтверждения отправлен: ${email}`);
        return true;
    } catch (error) {
        logger.error(`❌ Ошибка отправки email: ${error.message}`);
        return false;
    }
}

// === Экспорт сервиса ===
module.exports = {
    generateVerificationCode,
    sendVerificationEmail
};