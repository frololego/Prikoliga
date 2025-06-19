// utils/generalUtils.js

/**
 * Форматирует время матча в часовом поясе пользователя
 * @param {string} utcDateStr - Дата в формате ISO
 * @returns {string} Отформатированное время
 */
export function formatMatchTime(utcDateStr) {
    const date = new Date(utcDateStr);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Форматирует дату матча в часовом поясе пользователя
 * @param {string} utcDateStr - Дата в формате ISO
 * @returns {string} Отформатированная дата
 */
export function formatMatchDate(utcDateStr) {
    const date = new Date(utcDateStr);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}