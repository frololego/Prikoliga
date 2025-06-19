// public/js/utils/utils.js

// === Функция для форматирования времени матча в часовом поясе пользователя ===
function formatMatchTime(utcDateStr) {
    const date = new Date(utcDateStr);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// === Функция для форматирования даты матча в часовом поясе пользователя ===
function formatMatchDate(utcDateStr) {
    const date = new Date(utcDateStr);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

// Экспортируем функции
module.exports = {
    formatMatchTime,
    formatMatchDate
};