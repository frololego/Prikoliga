// js/utils/commonUtils.js

// === Функция для обработки ошибок ===
export function handleError(message, error) {
    console.error(`❌ ${message}:`, error.message);
    const container = document.getElementById('predictions-container');
    if (container) {
        container.innerHTML = `<div class="alert alert-danger">${message}</div>`;
    }
}

// === Функция для инициализации Bootstrap Tooltip ===
export function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
}