// services/emailService.js
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Конфигурация транспорта (вынесена в отдельную переменную для гибкости)
const mailConfig = {
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
};

// Проверка конфигурации при старте
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ Email credentials not configured! Verification emails will not work.');
}

const transporter = nodemailer.createTransport(mailConfig);

// Генерация 6-значного кода
function generateVerificationCode() {
    return crypto.randomInt(100000, 999999).toString();
}

// Отправка письма с кодом
async function sendVerificationEmail(email, code) {
    if (!process.env.EMAIL_USER) {
        console.warn('⚠️ Email service not configured. Verification code:', code);
        return true; // Для разработки
    }

    try {
        const mailOptions = {
            from: `"LigaPrikolov" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Подтверждение регистрации',
            html: `
                <h2>Добро пожаловать в LigaPrikolov!</h2>
                <p>Ваш код подтверждения: <strong>${code}</strong></p>
                <p>Код действителен 15 минут.</p>
                <p>Если вы не регистрировались, проигнорируйте это письмо.</p>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Verification code sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Email send error:', error);
        return false;
    }
}

module.exports = {
    generateVerificationCode,
    sendVerificationEmail
};