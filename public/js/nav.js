document.addEventListener("DOMContentLoaded", () => {
    // Функция для безопасной инициализации навигации
    function initNavigation() {
        const navbar = document.querySelector('.navbar');
        
        // Если навигации нет на странице - выходим
        if (!navbar) {
            console.log('Навигационное меню отсутствует на этой странице');
            return;
        }

        // 1. Установка отступа для body
        function updateBodyPadding() {
            document.body.style.paddingTop = navbar.offsetHeight + 'px';
        }

        // 2. Подсветка активных ссылок
        function highlightActiveLinks() {
            const path = window.location.pathname;
            const navLinks = document.querySelectorAll('.nav-link');
            
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === path) {
                    link.classList.add('active');
                }
            });
        }

        // 3. Адаптация для мобильных
        function adaptForMobile() {
            if (window.innerWidth < 768) {
                navbar.classList.add('mobile-view');
            } else {
                navbar.classList.remove('mobile-view');
            }
            updateBodyPadding();
        }

        // Инициализация
        updateBodyPadding();
        highlightActiveLinks();
        adaptForMobile();
        
        // Обработчики событий
        window.addEventListener('resize', adaptForMobile);
        
        const navbarToggler = document.querySelector('.navbar-toggler');
        if (navbarToggler) {
            navbarToggler.addEventListener('click', updateBodyPadding);
        }
    }

    // Запускаем инициализацию
    initNavigation();
});