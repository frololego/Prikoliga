document.addEventListener('DOMContentLoaded', async () => {
    console.log('Страница настроек загружена');

    // Проверка авторизации
    const token = localStorage.getItem('token');
    if (!token) {
        alert('Вы не авторизованы');
        window.location.href = '/login.html';
        return;
    }

    // Загрузка текущего имени пользователя
    try {
        const userData = await loadUserData(token);
        if (!userData || userData.error === 'User not found') {
            localStorage.clear();
            alert('Аккаунт не найден или был удалён');
            window.location.href = '/login.html';
            return;
        }
        
        const currentUsername = userData.username || 'Не указано';
        localStorage.setItem('username', currentUsername);
        document.getElementById('current-username').textContent = currentUsername;
    } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        alert('Не удалось загрузить данные профиля');
        window.location.href = '/login.html';
    }

    // Обработчик формы изменения имени
    document.getElementById('rename-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newUsername = document.getElementById('new-username').value.trim();
        if (!newUsername) {
            alert('Введите новое имя');
            return;
        }

        try {
            const response = await fetch('/api/user/rename', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ newUsername })
            });

            const data = await parseResponse(response);
            
            if (response.ok) {
                localStorage.setItem('username', data.newUsername);
                document.getElementById('current-username').textContent = data.newUsername;
                alert('Имя успешно изменено!');
            } else {
                throw new Error(data.error || 'Ошибка сервера');
            }
        } catch (err) {
            console.error('Ошибка:', err);
            alert(err.message || 'Не удалось изменить имя');
        }
    });

    // Обработчик удаления аккаунта
    document.getElementById('delete-account-btn').addEventListener('click', async () => {
        if (!confirm('Вы уверены? Это действие нельзя отменить!')) return;

        try {
            const response = await fetch('/api/user/delete', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            await parseResponse(response);
            
            localStorage.clear();
            alert('Аккаунт удалён');
            window.location.href = '/';
        } catch (err) {
            console.error('Ошибка:', err);
            alert(err.message || 'Не удалось удалить аккаунт');
        }
    });
});

// Вспомогательные функции
async function loadUserData(token) {
    const response = await fetch('/api/user/me', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return await parseResponse(response);
}

async function parseResponse(response) {
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(text || 'Неверный формат ответа');
    }
    return await response.json();
}