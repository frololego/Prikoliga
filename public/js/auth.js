// ===== Аутентификация и авторизация =====
function getToken() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('No token found');
        window.location.href = '/login.html';
        return null;
    }
    return token;
}

function decodeToken(token) {
    try {
        const payload = token.split('.')[1];
        return JSON.parse(atob(payload));
    } catch (e) {
        console.error('Token decode error:', e);
        return null;
    }
}

/**
 * Проверка авторизации через токен
 */
export async function checkAuth(token) {
    try {
        console.log("🔐 Используется токен:", token);

        const decoded = decodeToken(token);
        if (!decoded) {
            console.warn('❌ Не удалось декодировать токен');
            clearAuthData();
            window.location.href = '/login.html';
            return null;
        }

        console.log("🔓 Декодированный токен:", decoded);

        const response = await fetch('/api/users/me', {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });

        console.log(`📡 Ответ от /api/users/me: статус ${response.status}`);

        if (response.status === 401) {
            console.warn('❌ Сервер вернул 401 → токен недействителен или истёк');
            clearAuthData();
            window.location.href = '/login.html';
            return null;
        }

        if (response.status === 304 || response.ok) {
            let userData;
            try {
                userData = await response.json();
            } catch (e) {
                console.error("Ошибка парсинга JSON", e);
                clearAuthData();
                window.location.href = '/login.html';
                return null;
            }

            // Проверка совпадения данных из токена и API
            if (decoded.id !== userData.id || decoded.email !== userData.email) {
                console.warn('❌ Данные токена и пользователя не совпадают');
                clearAuthData();
                window.location.href = '/login.html';
                return null;
            }

            return userData;
        }

        throw new Error(`HTTP error! status: ${response.status}`);
    } catch (error) {
        console.error('🚫 Ошибка проверки авторизации:', error.message);
        clearAuthData();
        window.location.href = '/login.html';
        return null;
    }
}

/**
 * Проверка ролей пользователя
 */
export async function checkRole(token, allowedRoles) {
    const userData = await checkAuth(token);
    return userData ? allowedRoles.includes(userData.role) : false;
}

/**
 * Очистка данных аутентификации
 */
export function clearAuthData() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('email');
    localStorage.removeItem('role');
    localStorage.removeItem('last_active');
}

/**
 * Инициализация аутентификации
 */
export async function initAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        redirectToLogin();
        return;
    }

    const userData = await checkAuth(token);
    if (!userData) {
        clearAuthData();
        redirectToLogin();
    } else {
        storeUserData(userData);
        checkSessionExpiry();
    }
}

// Внутренние вспомогательные функции
function storeUserData(userData) {
    localStorage.setItem('username', userData.username);
    localStorage.setItem('email', userData.email);
    localStorage.setItem('role', userData.role);
    localStorage.setItem('last_active', new Date().toISOString());
}

function redirectToLogin() {
    if (!window.location.pathname.includes('/login.html')) {
        console.log('🔴 Перенаправление на страницу входа...');
        window.location.href = '/login.html';
    }
}

function checkSessionExpiry() {
    const lastActive = localStorage.getItem('last_active');
    if (lastActive) {
        const inactiveTime = (new Date() - new Date(lastActive)) / (1000 * 60); // в минутах
        if (inactiveTime > 30) {
            console.warn('⏳ Сессия истекла из-за неактивности');
            clearAuthData();
            redirectToLogin();
        }
    }
}

console.log("Auth.js version: 1.0." + Date.now());