// public/js/settings.js

const { checkAuth } = require('./auth');
const { formatMatchTime, formatMatchDate } = require('./utils/utils');

// === Инициализация при загрузке страницы ===
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔄 Загрузка страницы /settings начата');

    const token = localStorage.getItem('token');
    console.log('🗝️ Токен из localStorage:', token ? 'есть' : 'отсутствует');

    if (!token) {
        console.warn('❌ Токен отсутствует → перенаправляем на /login.html');
        window.location.href = '/login.html';
        return;
    }

    try {
        const response = await fetch('/api/users/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log(`📡 Ответ от /api/users/me: статус ${response.status}`);

        if (!response.ok) {
            if (response.status === 401) {
                console.warn('❌ Сервер вернул 401 → токен недействителен или истёк');
                clearAuthAndRedirect();
            } else {
                console.error(`❌ Ошибка сервера: ${response.status}`);
                alert('Не удалось загрузить данные пользователя');
            }
            return;
        }

        let userData;
        try {
            userData = await response.json();
        } catch (e) {
            console.error("Ошибка парсинга JSON", e);
            alert('Получен некорректный ответ от сервера');
            clearAuthAndRedirect();
            return;
        }

        console.log('✅ Авторизация успешна:', userData);
        updateUserUI(userData);
        setupEventHandlers(token);

    } catch (error) {
        console.error('🚫 Произошла ошибка:', error.message);
        clearAuthAndRedirect();
    }
});

// === Core Functions ===

async function loadNavbar() {
    try {
        const response = await fetch('/nav.html');
        if (!response.ok) throw new Error('Navbar load failed');
        document.getElementById('navbar-container').innerHTML = await response.text();
    } catch (error) {
        console.error('Navbar error:', error);
    }
}

async function checkAuthAndLoadUser() {
    const token = localStorage.getItem('token');
    if (!token) {
        redirectToLogin();
        return null;
    }

    const response = await fetch('/api/users/me', {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-store'
        },
        cache: 'no-store'
    });

    if (response.status === 401) {
        redirectToLogin();
        return null;
    }

    if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
    }

    return await response.json();
}

function updateUserUI(user) {
    const usernameElement = document.getElementById('current-username');
    if (usernameElement) {
        usernameElement.textContent = user.username || 'Not specified';
    }
}

function setupEventHandlers() {
    const renameForm = document.getElementById('rename-form');
    if (renameForm) {
        renameForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleRename();
        });
    }

    const deleteBtn = document.getElementById('delete-account-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', handleDelete);
    }
}

// === Action Handlers ===

async function handleRename() {
    const newUsername = document.getElementById('new-username')?.value.trim();
    if (!newUsername) {
        alert('Введите новое имя пользователя');
        return;
    }

    try {
        const response = await fetch('/api/users/rename', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ newUsername })
        });

        if (response.ok) {
            const data = await response.json();
            updateUserUI({ username: data.newUsername });
            alert('Имя успешно изменено!');
        } else if (response.status === 401) {
            clearAuthAndRedirect();
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Не удалось изменить имя');
        }
    } catch (error) {
        console.error('Rename error:', error);
        alert(error.message);
    }
}

async function handleDelete() {
    if (!confirm('Вы уверены? Это действие нельзя отменить!')) return;

    try {
        const response = await fetch('/api/users/delete', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            clearAuthAndRedirect();
        } else if (response.status === 401) {
            clearAuthAndRedirect();
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Не удалось удалить аккаунт');
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert(error.message);
    }
}

// === Utility Functions ===

function redirectToLogin() {
    window.location.href = '/login.html';
}

function clearAuthAndRedirect() {
    localStorage.clear();
    alert('Аккаунт удален');
    window.location.href = '/';
}

function handleAuthError(error) {
    console.error('Authentication error:', error);
    localStorage.removeItem('token');
    redirectToLogin();
}

// Экспортируем функции
module.exports = {
    loadNavbar,
    checkAuthAndLoadUser,
    updateUserUI,
    setupEventHandlers,
    handleRename,
    handleDelete,
    redirectToLogin,
    clearAuthAndRedirect,
    handleAuthError
};