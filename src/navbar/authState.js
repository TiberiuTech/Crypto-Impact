// Script pentru gestionarea stării de autentificare în navbar

// Funcție pentru a actualiza navbar-ul în funcție de starea de autentificare
function updateNavbarAuthState() {
    const authButtons = document.getElementById('auth-buttons');
    const userInfoNavbar = document.getElementById('user-info-navbar');
    const userNameNavbar = document.getElementById('user-name-navbar');
    const logoutBtn = document.getElementById('logout-btn');

    if (!authButtons || !userInfoNavbar || !userNameNavbar || !logoutBtn) {
        // Elementele nu sunt încă încărcate, așteptăm puțin
        setTimeout(updateNavbarAuthState, 100);
        return;
    }

    // Verificăm dacă utilizatorul este autentificat
    const userData = localStorage.getItem('user');
    
    if (userData) {
        try {
            const user = JSON.parse(userData);
            // Utilizatorul este autentificat - afișăm numele și butonul de logout
            authButtons.style.display = 'none';
            userInfoNavbar.style.display = 'flex';
            
            // Afișăm numele utilizatorului (displayName sau email)
            const displayName = user.displayName || user.email || 'Utilizator';
            userNameNavbar.textContent = displayName;
        } catch (error) {
            console.error('Eroare la parsarea datelor utilizatorului:', error);
            // Dacă există o eroare, afișăm butoanele de login/register
            authButtons.style.display = 'flex';
            userInfoNavbar.style.display = 'none';
        }
    } else {
        // Utilizatorul NU este autentificat - afișăm butoanele de login/register
        authButtons.style.display = 'flex';
        userInfoNavbar.style.display = 'none';
    }
}

// Funcție pentru logout
function handleLogout() {
    // Ștergem datele utilizatorului din localStorage
    localStorage.removeItem('user');
    
    // Dacă Firebase este disponibil, facem logout și de acolo
    if (typeof firebase !== 'undefined' && firebase.auth) {
        const auth = firebase.auth();
        if (auth.currentUser) {
            auth.signOut().then(() => {
                console.log('Logout reușit');
            }).catch((error) => {
                console.error('Eroare la logout:', error);
            });
        }
    }
    
    // Actualizăm navbar-ul
    updateNavbarAuthState();
    
    // Redirecționăm către pagina principală
    window.location.href = '/src/pages/home/home.html';
}

// Inițializăm când DOM-ul este gata
document.addEventListener('DOMContentLoaded', function() {
    // Așteptăm puțin pentru ca navbar-ul să fie încărcat
    setTimeout(() => {
        updateNavbarAuthState();
        
        // Adăugăm event listener pentru butonul de logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn && !logoutBtn.hasAttribute('data-listener-added')) {
            logoutBtn.setAttribute('data-listener-added', 'true');
            logoutBtn.addEventListener('click', handleLogout);
        }
    }, 300);
});

// Actualizăm și când pagina se încarcă complet
window.addEventListener('load', function() {
    setTimeout(updateNavbarAuthState, 100);
});

// Ascultăm pentru schimbări în localStorage (când utilizatorul se loghează/înregistrează)
window.addEventListener('storage', function(e) {
    if (e.key === 'user') {
        updateNavbarAuthState();
    }
});

// Exportăm funcțiile pentru a fi folosite în alte scripturi
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { updateNavbarAuthState, handleLogout };
}
