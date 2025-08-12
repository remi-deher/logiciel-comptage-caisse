// public/js/navbar.js
document.addEventListener('DOMContentLoaded', () => {
    const navbarToggler = document.getElementById('navbar-toggler');
    const navbarMenu = document.getElementById('navbar-menu');
    const themeSwitcher = document.getElementById('theme-switcher');
    const body = document.body;
    const sunIcon = themeSwitcher.querySelector('.fa-sun');
    const moonIcon = themeSwitcher.querySelector('.fa-moon');

    // Toggle mobile menu
    navbarToggler.addEventListener('click', () => {
        navbarMenu.classList.toggle('hidden');
    });

    // Theme switching logic
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme) {
        body.setAttribute('data-theme', currentTheme);
        if (currentTheme === 'dark') {
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
        } else {
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        }
    }

    themeSwitcher.addEventListener('click', () => {
        if (body.getAttribute('data-theme') === 'dark') {
            body.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        } else {
            body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
        }
    });

    // Status indicator logic (You'll need to connect this to your WebSocket logic)
    const statusIndicator = document.getElementById('websocket-status-indicator');
    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('.status-text');

    // Example functions to update status
    // function setStatusConnected() {
    //     statusIndicator.classList.remove('bg-yellow-400', 'bg-red-600');
    //     statusIndicator.classList.add('bg-green-600');
    //     statusDot.classList.remove('bg-white', 'animate-pulse');
    //     statusDot.classList.add('bg-white');
    //     statusText.textContent = 'Connecté';
    // }

    // function setStatusDisconnected() {
    //     statusIndicator.classList.remove('bg-yellow-400', 'bg-green-600');
    //     statusIndicator.classList.add('bg-red-600');
    //     statusDot.classList.remove('bg-white', 'animate-pulse');
    //     statusDot.classList.add('bg-white');
    //     statusText.textContent = 'Déconnecté';
    // }
});
