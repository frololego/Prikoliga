// utils/domUtils.js

/**
 * Обрабатывает ошибки и выводит сообщение на страницу
 * @param {string} message - Сообщение об ошибке
 * @param {Error} error - Объект ошибки
 */
export function handleError(message, error) {
    console.error(`❌ ${message}:`, error.message);
    const container = document.getElementById('predictions-container');
    if (container) {
        container.innerHTML = `<div class="alert alert-danger">${message}</div>`;
    }
}

/**
 * Инициализирует Bootstrap Tooltip
 */
export function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
}