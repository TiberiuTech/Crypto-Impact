document.addEventListener("DOMContentLoaded", function() {
    const navbarPlaceholder = document.getElementById("navbar-placeholder");

    if (navbarPlaceholder) {
        // Try multiple candidate URLs for the navbar partial in order of preference
        const candidates = [];
        // 1) Absolute known location (works with Live Server and proxy)
        candidates.push(window.location.origin + '/src/navbar/navbar.html');

        // 2) Derived from the script's src (works if the script was included relatively)
        const scriptEl = document.currentScript || Array.from(document.getElementsByTagName('script')).pop();
        const scriptSrc = scriptEl && scriptEl.src ? scriptEl.src : null;
        if (scriptSrc) {
            const base = scriptSrc.substring(0, scriptSrc.lastIndexOf('/'));
            candidates.push(base + '/navbar.html');
        }

        // 3) Relative fallback (same folder as page)
        candidates.push('navbar.html');

        // Helper: attempt to fetch candidates sequentially
        (async function tryCandidates() {
            for (const url of candidates) {
                try {
                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.text();
                        navbarPlaceholder.innerHTML = data;

                        // --- Partea de "Activ" ---
                        const currentPage = window.location.pathname;
                        const navLinks = navbarPlaceholder.querySelectorAll(".nav-links a");

                        navLinks.forEach(link => {
                            const linkPage = new URL(link.href).pathname;
                            if (currentPage.endsWith(linkPage)) {
                                link.classList.add("active");
                            }
                        });
                        // --- Sfârșit parte "Activ" ---
                        
                        // Actualizăm starea de autentificare imediat după ce navbar-ul este încărcat
                        updateNavbarAuthStateAfterLoad();
                        
                        // Încărcăm scriptul pentru gestionarea stării de autentificare
                        loadAuthStateScript();
                        
                        return;
                    }
                } catch (err) {
                    // ignore and try next
                }
            }
            console.error('Eroare: nu am putut încărca navbar-ul din niciun loc încercat:', candidates);
        })();
    }
});

// Funcție pentru actualizarea stării de autentificare (fără a depinde de scriptul extern)
function updateNavbarAuthStateAfterLoad() {
    // Așteptăm puțin pentru ca DOM-ul să fie actualizat
    setTimeout(() => {
        const authButtons = document.getElementById('auth-buttons');
        const userInfoNavbar = document.getElementById('user-info-navbar');
        const userNameNavbar = document.getElementById('user-name-navbar');
        const logoutBtn = document.getElementById('logout-btn');

        if (!authButtons || !userInfoNavbar || !userNameNavbar) {
            // Elementele nu sunt încă încărcate, încercăm din nou
            setTimeout(updateNavbarAuthStateAfterLoad, 100);
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
                
                // Adăugăm event listener pentru butonul de logout
                if (logoutBtn && !logoutBtn.hasAttribute('data-listener-added')) {
                    logoutBtn.setAttribute('data-listener-added', 'true');
                    logoutBtn.addEventListener('click', function() {
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
                        updateNavbarAuthStateAfterLoad();
                        
                        // Redirecționăm către pagina principală
                        window.location.href = '/src/pages/home/home.html';
                    });
                }
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
    }, 50);
}

// Funcție pentru încărcarea scriptului de autentificare
function loadAuthStateScript() {
    const candidates = [];
    candidates.push(window.location.origin + '/src/navbar/authState.js');
    
    const scriptEl = document.currentScript || Array.from(document.getElementsByTagName('script')).pop();
    const scriptSrc = scriptEl && scriptEl.src ? scriptEl.src : null;
    if (scriptSrc) {
        const base = scriptSrc.substring(0, scriptSrc.lastIndexOf('/'));
        candidates.push(base + '/authState.js');
    }
    
    candidates.push('authState.js');
    
    (async function tryCandidates() {
        for (const url of candidates) {
            try {
                const res = await fetch(url);
                if (res.ok) {
                    const script = document.createElement('script');
                    script.src = url;
                    script.onload = function() {
                        // După ce scriptul s-a încărcat, actualizăm starea
                        if (typeof updateNavbarAuthState === 'function') {
                            updateNavbarAuthState();
                        }
                    };
                    document.head.appendChild(script);
                    return;
                }
            } catch (err) {
                // ignore and try next
            }
        }
        console.warn('Nu s-a putut încărca authState.js');
    })();
}