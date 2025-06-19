// public/js/analytics.js

const { checkAuth } = require('./auth');
const { formatMatchTime, formatMatchDate } = require('./utils/utils');
const {
    renderPredictions,
    filterPredictions,
    updateAccuracyChart
} = require('./utils/predictionUtils');

// === Инициализация аналитики при загрузке страницы ===
async function initAnalytics() {
    console.log('Инициализация аналитики...');

    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');

    if (!token || !username) {
        console.warn('Нет токена или имени пользователя - перенаправление на логин');
        window.location.href = '/login.html';
        return;
    }

    try {
        console.log('Проверка авторизации...');
        const verifiedUsername = await checkAuth(token);
        if (!verifiedUsername) {
            console.warn('Авторизация не пройдена - очистка хранилища');
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            window.location.href = '/login.html';
            return;
        }

        console.log('Загрузка аналитических данных...');
        const response = await fetch('/api/analytics', {
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        });

        console.log('Ответ сервера:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Ошибка API:', errorText);
            throw new Error(`Ошибка загрузки данных: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const responseData = await response.text();
            console.error('Неверный content-type:', contentType, 'Ответ:', responseData);
            throw new Error('Сервер вернул не JSON данные');
        }

        const analyticsData = await response.json();
        console.log('Получены данные:', analyticsData);

        if (!Array.isArray(analyticsData)) {
            console.error('Некорректный формат данных:', analyticsData);
            throw new Error('Ожидался массив данных');
        }

        renderAnalyticsTable(analyticsData);
        console.log('Таблица успешно отрисована');

    } catch (err) {
        console.error('Ошибка в initAnalytics:', err);
        showError('users-table', err.message || 'Не удалось загрузить данные');
    }
}

// === Рендеринг таблицы пользователей с аналитикой ===
function renderAnalyticsTable(users) {
    console.log('Рендеринг таблицы для', users.length, 'пользователей');

    const container = document.getElementById('users-table');
    if (!container) {
        console.error('Контейнер users-table не найден в DOM');
        return;
    }

    container.innerHTML = '';

    if (!users || !users.length) {
        console.warn('Нет данных для отображения');
        container.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4 text-muted">
                    Нет данных для отображения
                </td>
            </tr>`;
        return;
    }

    // Сортируем по рейтингу
    const sortedUsers = [...users].sort((a, b) => (b.rating || 0) - (a.rating || 0));

    sortedUsers.forEach((user, index) => {
        const row = document.createElement('tr');

        // Добавляем классы для топ-3
        if (index < 3) {
            row.classList.add(index === 0 ? 'table-warning' : index === 1 ? 'table-light' : 'table-secondary');
        }

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${user.username || 'N/A'}</td>
            <td>${user.totalPredictions || 0}</td>
            <td>${user.correct || 0}</td>
            <td>${user.partial || 0}</td>
            <td>${user.wrong || 0}</td>
            <td>${user.accuracyPercentage != null ? user.accuracyPercentage + '%' : 'N/A'}</td>
            <td>${user.rating || 0}</td>
        `;
        container.appendChild(row);
    });
}

// === Показ ошибки в таблице ===
function showError(elementId, message) {
    console.error('Показ ошибки:', message);
    const container = document.getElementById(elementId);
    if (container) {
        container.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-danger py-4">
                    ${message}
                </td>
            </tr>`;
    } else {
        console.error('Контейнер для ошибки не найден:', elementId);
    }
}

// === Автозапуск при наличии таблицы ===
if (document.getElementById('users-table')) {
    document.addEventListener("DOMContentLoaded", initAnalytics);
} else {
    console.warn('Элемент users-table не найден - скрипт аналитики не будет запущен');
}

// Экспортируем функции
module.exports = {
    initAnalytics,
    renderAnalyticsTable,
    showError
};