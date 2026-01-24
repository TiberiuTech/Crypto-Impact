// Script de protecție pentru paginile care necesită autentificare
// Verifică dacă utilizatorul este autentificat și redirecționează către login dacă nu este

(function() {
    // Verificăm dacă utilizatorul este autentificat
    const userData = localStorage.getItem('user');
    
    if (!userData) {
        // Utilizatorul nu este autentificat - redirecționăm către login
        console.log('Utilizator neautentificat. Redirecționare către login...');
        window.location.href = '/src/pages/auth/login.html';
        return;
    }
    
    try {
        // Verificăm dacă datele sunt valide
        const user = JSON.parse(userData);
        if (!user.uid || !user.email) {
            // Date invalide - redirecționăm către login
            console.log('Date de autentificare invalide. Redirecționare către login...');
            localStorage.removeItem('user');
            window.location.href = '/src/pages/auth/login.html';
        }
    } catch (error) {
        // Eroare la parsare - redirecționăm către login
        console.error('Eroare la verificarea autentificării:', error);
        localStorage.removeItem('user');
        window.location.href = '/src/pages/auth/login.html';
    }
})();
