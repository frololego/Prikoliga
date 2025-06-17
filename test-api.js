const fetch = require('node-fetch');

// Функция для получения списка всех лиг
async function fetchLeagues() {
    const API_KEY = '75kwgw7361l0l1ir'; // Публичный API-ключ

    try {
        console.log("🚀 Запрашиваем список всех лиг...");
        const response = await fetch('https://api.sstats.net/leagues',  {
            headers: { 'apikey': API_KEY }
        });

        if (!response.ok) {
            throw new Error(`HTTP ошибка: ${response.status}`);
        }

        const data = await response.json();
        if (data.status !== 'OK') {
            throw new Error("❌ Ошибка сервера при получении списка лиг");
        }

        console.log("⚡️ Список всех лиг:");
        data.data.forEach(league => {
            console.log(`• ID: ${league.id} | Название: ${league.name} (${league.country.name})`);
            league.seasons.forEach(season => {
                console.log(`  - Сезон: ${season.year} (${new Date(season.dateStart).toLocaleDateString('ru-RU')} — ${new Date(season.dateEnd).toLocaleDateString('ru-RU')})`);
            });
        });

        // Поиск конкретных турниров
        const targetLeagues = ['Champions League', 'Europa League', 'Conference League'];
        const filteredLeagues = data.data.filter(league => 
            targetLeagues.includes(league.name) || 
            targetLeagues.some(name => league.name.toLowerCase().includes(name.toLowerCase()))
        );

        console.log("\n⭐️ Турниры UEFA:");
        filteredLeagues.forEach(league => {
            console.log(`• ID: ${league.id} | Название: ${league.name}`);
        });
    } catch (error) {
        console.error('❌ Ошибка при выполнении запроса:', error.message);
    }
    // Сохраняем данные в JSON-файл
const fs = require('fs');

fs.writeFile('leagues.json', JSON.stringify(data.data, null, 2), err => {
    if (err) {
        console.error('❌ Ошибка при записи файла:', err.message);
    } else {
        console.log('✅ Справочник лиг сохранён в файл leagues.json');
    }
});
}

fetchLeagues();