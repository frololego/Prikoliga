// ===== Аутентификация и авторизация =====

/**
 * Проверка авторизации через токен
 */
async function checkAuth(token) {
    try {
        const res = await fetch('/api/auth/check', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await res.json();
        
        if (res.ok) {
            console.log("✅ [auth.js] Пользователь авторизован", data.user);
            return {
                username: data.user.username,
                email: data.user.email,
                role: data.user.role
            };
        }
        console.error("❌ [auth.js] Ошибка авторизации:", data.error);
        return null;
    } catch (err) {
        console.error("❌ [auth.js] Ошибка сети:", err.message);
        return null;
    }
}

/**
 * Проверка ролей пользователя
 */
async function checkRole(token, allowedRoles) {
    const userData = await checkAuth(token);
    return userData ? allowedRoles.includes(userData.role) : false;
}

/**
 * Хранение данных пользователя
 */
function storeUserData(userData) {
    localStorage.setItem('username', userData.username);
    localStorage.setItem('email', userData.email);
    localStorage.setItem('role', userData.role);
    localStorage.setItem('last_active', new Date().toISOString());
}

/**
 * Очистка данных аутентификации
 */
function clearAuthData() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('email');
    localStorage.removeItem('role');
    localStorage.removeItem('last_active');
}

/**
 * Перенаправление на страницу входа
 */
function redirectToLogin() {
    if (!window.location.pathname.includes('/login.html')) {
        window.location.href = '/login.html';
    }
}

/**
 * Проверка истечения сессии
 */
function checkSessionExpiry() {
    const lastActive = localStorage.getItem('last_active');
    if (lastActive) {
        const inactiveTime = (new Date() - new Date(lastActive)) / (1000 * 60);
        if (inactiveTime > 30) {
            clearAuthData();
            redirectToLogin();
        }
    }
}

/**
 * Инициализация аутентификации
 */
async function initAuth() {
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

// Экспортируем только необходимые функции
export { 
    checkAuth, 
    checkRole, 
    clearAuthData,
    initAuth 
};

console.log("Auth.js version: 1.0." + Date.now());