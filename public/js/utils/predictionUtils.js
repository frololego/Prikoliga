// public/js/predictionUtils.js

const { formatMatchTime, formatMatchDate } = window.app.utils;

window.app = window.app || {};
window.app.predictionUtils = {
    renderPredictions,
    filterPredictions,
    updateAccuracyChart,
    calculateStats,
    createPredictionCard,
    getPredictionStatus,
    updateAccuracyLegend
};

/**
 * Отображает список прогнозов в контейнере
 * @param {Array} predictions - Прогнозы для отображения
 * @param {Array} [allPredictions] - Все прогнозы для расчета статистики (опционально)
 */
function renderPredictions(predictions, allPredictions = []) {
    const container = document.getElementById('predictions-container');
    if (!container) {
        console.warn('❌ predictions-container не найден');
        return;
    }

    container.innerHTML = '';

    if (!predictions.length) {
        container.innerHTML = `
            <div class="alert alert-info text-center">
                Нет прогнозов для отображения
            </div>
        `;
        return;
    }

    const stats = allPredictions.length > 0 ? calculateStats(allPredictions) : calculateStats(predictions);

    predictions.forEach(prediction => {
        const card = createPredictionCard(prediction);
        container.appendChild(card);
    });

    updateAccuracyChart(stats);
}

/**
 * Фильтрует прогнозы по статусу матча
 * @param {Array} predictions - Массив прогнозов
 * @param {string} filterType - Тип фильтра ('all', 'finished', 'upcoming')
 * @returns {Array} Отфильтрованный массив прогнозов
 */
function filterPredictions(predictions, filterType) {
    const now = new Date();
    return predictions.filter(prediction => {
        const matchDate = new Date(prediction.utcDate || prediction.matchDate);
        const isFinished = prediction.status === 'FINISHED' ||
                         (prediction.actualHome !== null && prediction.actualAway !== null);

        switch (filterType) {
            case 'finished':
                return isFinished;
            case 'upcoming':
                return !isFinished && matchDate > now;
            default:
                return true;
        }
    }).sort((a, b) => {
        const dateA = new Date(a.utcDate || a.matchDate);
        const dateB = new Date(b.utcDate || b.matchDate);
        return dateA - dateB; // Сортировка по возрастанию времени (ближайшие сверху)
    });
}

/**
 * Обновляет диаграмму точности прогнозов
 * @param {Object} stats - Статистика
 */
function updateAccuracyChart(stats) {
    const ctx = document.getElementById('accuracyChart')?.getContext('2d');
    if (!ctx) return;

    if (window.accuracyChart) {
        window.accuracyChart.destroy();
    }

    if (stats.finished === 0) {
        const parent = document.getElementById('accuracyChart')?.parentElement;
        if (parent) {
            parent.innerHTML = `
                <div class="alert alert-info text-center">
                    Нет данных для расчета точности
                </div>
            `;
        }
        return;
    }

    window.accuracyChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Точные', 'Частичные', 'Неверные'],
            datasets: [{
                data: [stats.correct, stats.partial, stats.wrong],
                backgroundColor: ['#28a745', '#ffc107', '#dc3545']
            }]
        },
        options: {
            responsive: true,
            cutout: '65%',
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: context => {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((context.raw / total) * 100);
                            return `${context.label}: ${context.raw} (${percentage}%)`;
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'centerText',
            beforeDraw(chart) {
                const { ctx, width, height } = chart;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 20px Arial';
                ctx.fillStyle = '#333';
                ctx.fillText(`${stats.accuracy}%`, width / 2, height / 2);
            }
        }]
    });

    updateAccuracyLegend(stats);
}

/**
 * Рассчитывает статистику прогнозов
 * @param {Array} predictions - Массив прогнозов
 * @returns {Object} Статистика
 */
function calculateStats(predictions) {
    const finished = predictions.filter(p =>
        p.status === 'FINISHED' ||
        (p.actualHome !== null && p.actualAway !== null)
    );

    let correct = 0, partial = 0, wrong = 0;

    finished.forEach(pred => {
        const [predHome, predAway] = pred.forecast.split(':').map(Number);
        const actualHome = pred.actualHome ?? pred.homeScore;
        const actualAway = pred.actualAway ?? pred.awayScore;

        if (predHome === actualHome && predAway === actualAway) {
            correct++;
        } else {
            const predOutcome = Math.sign(predHome - predAway);
            const actualOutcome = Math.sign(actualHome - actualAway);
            if (predOutcome === actualOutcome) {
                partial++;
            } else {
                wrong++;
            }
        }
    });

    const accuracy = finished.length > 0 ? Math.round(((correct + partial) / finished.length) * 100) : 0;

    return { total: predictions.length, finished: finished.length, correct, partial, wrong, accuracy };
}

/**
 * Создаёт карточку прогноза
 * @param {Object} prediction - Прогноз
 * @returns {HTMLElement}
 */
function createPredictionCard(prediction) {
    const {
        homeTeam = 'Команда 1',
        awayTeam = 'Команда 2',
        forecast = '0:0',
        actualHome = null,
        actualAway = null,
        utcDate,
        matchDate,
        status
    } = prediction;

    const date = utcDate || matchDate;
    const isFinished = status === 'FINISHED' ||
                       (actualHome !== null && actualAway !== null);
    const predictionStatus = getPredictionStatus(prediction);

    const card = document.createElement('div');
    card.className = `card mb-3 ${predictionStatus.class}`;
    card.innerHTML = `
        <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h5 class="card-title mb-0">${homeTeam} vs ${awayTeam}</h5>
                <span class="badge ${predictionStatus.badgeClass}">${forecast}</span>
            </div>
            <div class="d-flex justify-content-between text-muted mb-2">
                ${isFinished ? `
                    <small><i class="bi bi-check-circle"></i> Результат: ${actualHome ?? '-'}:${actualAway ?? '-'}</small>
                ` : `
                    <small><i class="bi bi-clock"></i> ${formatMatchDate(date)} в ${formatMatchTime(date)}</small>
                `}
            </div>
            ${isFinished ? `
                <div class="mt-2">
                    ${predictionStatus.icon} ${predictionStatus.text}
                </div>
            ` : ''}
        </div>
    `;

    return card;
}

/**
 * Возвращает статус прогноза
 * @param {Object} prediction - Прогноз
 * @returns {Object} Классы и текст статуса
 */
function getPredictionStatus(prediction) {
    const { status, actualHome, actualAway, forecast } = prediction;

    if (status !== 'FINISHED' &&
        (actualHome === null || actualAway === null)) {
        return {
            class: '',
            badgeClass: 'bg-secondary',
            icon: '<i class="bi bi-hourglass text-warning"></i>',
            text: 'Ожидается результат'
        };
    }

    const [predHome, predAway] = forecast.split(':').map(Number);
    const actualH = actualHome ?? prediction.homeScore;
    const actualA = actualAway ?? prediction.awayScore;

    if (predHome === actualH && predAway === actualA) {
        return {
            class: 'border-success',
            badgeClass: 'bg-success',
            icon: '<i class="bi bi-check-circle-fill text-success"></i>',
            text: 'Точный прогноз'
        };
    }

    const predOutcome = Math.sign(predHome - predAway);
    const actualOutcome = Math.sign(actualH - actualA);

    if (predOutcome === actualOutcome) {
        return {
            class: 'border-warning',
            badgeClass: 'bg-warning text-dark',
            icon: '<i class="bi bi-exclamation-triangle-fill text-warning"></i>',
            text: 'Частично верно'
        };
    }

    return {
        class: 'border-danger',
        badgeClass: 'bg-danger',
        icon: '<i class="bi bi-x-circle-fill text-danger"></i>',
        text: 'Неверный прогноз'
    };
}

/**
 * Обновляет легенду точности
 * @param {Object} stats - Статистика
 */
function updateAccuracyLegend(stats) {
    const legend = document.getElementById('accuracyLegend');
    if (!legend) return;

    legend.innerHTML = `
        <div class="d-flex align-items-center mb-2">
            <span class="badge bg-success me-2"></span>
            Точные: ${stats.correct}
        </div>
        <div class="d-flex align-items-center mb-2">
            <span class="badge bg-warning me-2"></span>
            Частичные: ${stats.partial}
        </div>
        <div class="d-flex align-items-center">
            <span class="badge bg-danger me-2"></span>
            Неверные: ${stats.wrong}
        </div>
    `;
}