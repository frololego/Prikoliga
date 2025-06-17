const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'ваш@gmail.com',
    pass: 'пароль' // Используйте "Пароль приложений" из Google Аккаунта
  }
});

async function sendVerificationCode(email, code) {
  await transporter.sendMail({
    from: '"LigaPrikolov" <ваш@gmail.com>',
    to: email,
    subject: 'Код подтверждения',
    text: `Ваш код: ${code}`
  });
}

module.exports = { sendVerificationCode };