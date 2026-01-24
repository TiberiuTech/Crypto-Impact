document.addEventListener("DOMContentLoaded", function() {
    const navbarPlaceholder = document.getElementById("navbar-placeholder");

    if (navbarPlaceholder) {

        const candidates = [];
        candidates.push(window.location.origin + '/src/navbar/navbar.html');

        const scriptEl = document.currentScript || Array.from(document.getElementsByTagName('script')).pop();
        const scriptSrc = scriptEl && scriptEl.src ? scriptEl.src : null;
        if (scriptSrc) {
            const base = scriptSrc.substring(0, scriptSrc.lastIndexOf('/'));
            candidates.push(base + '/navbar.html');
        }

        candidates.push('navbar.html');

        (async function tryCandidates() {
            for (const url of candidates) {
                try {
                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.text();
                        navbarPlaceholder.innerHTML = data;

                        const currentPage = window.location.pathname;
                        const navLinks = navbarPlaceholder.querySelectorAll(".nav-links a");

                        navLinks.forEach(link => {
                            const linkPage = new URL(link.href).pathname;
                            if (currentPage.endsWith(linkPage)) {
                                link.classList.add("active");
                            }
                        });
                        updateNavbarAuthStateAfterLoad();
                        
                        loadAuthStateScript();
                        
                        return;
                    }
                } catch (err) {
                    console.error('Error at loading navbar from any attempted location:', candidates);
                }
            }
            console.error('Error at loading navbar from any attempted location:', candidates);
        })();
    }
});

function updateNavbarAuthStateAfterLoad() {
    setTimeout(() => {
        const authButtons = document.getElementById('auth-buttons');
        const userInfoNavbar = document.getElementById('user-info-navbar');
        const userNameNavbar = document.getElementById('user-name-navbar');
        const logoutBtn = document.getElementById('logout-btn');

        if (!authButtons || !userInfoNavbar || !userNameNavbar) {
            setTimeout(updateNavbarAuthStateAfterLoad, 100);
            return;
        }

        const userData = localStorage.getItem('user');
        
        if (userData) {
            try {
                const user = JSON.parse(userData);
                authButtons.style.display = 'none';
                userInfoNavbar.style.display = 'flex';
                
                const displayName = user.displayName || user.email || 'Utilizator';
                userNameNavbar.textContent = displayName;
                
                if (logoutBtn && !logoutBtn.hasAttribute('data-listener-added')) {
                    logoutBtn.setAttribute('data-listener-added', 'true');
                    logoutBtn.addEventListener('click', function() {    
                        localStorage.removeItem('user');
                        
                        if (typeof firebase !== 'undefined' && firebase.auth) {
                            const auth = firebase.auth();
                            if (auth.currentUser) {
                                auth.signOut().then(() => {
                                    console.log('Logout successful');
                                }).catch((error) => {
                                    console.error('Error at logout:', error);
                                });
                            }
                        }
                        
                        updateNavbarAuthStateAfterLoad();
                        
                        window.location.href = '/src/pages/home/home.html';
                    });
                }
            } catch (error) {
                console.error('Error at parsing user data:', error);
                authButtons.style.display = 'flex';
                userInfoNavbar.style.display = 'none';
            }
        } else {
            authButtons.style.display = 'flex';
            userInfoNavbar.style.display = 'none';
        }
    }, 50);
}

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
                        if (typeof updateNavbarAuthState === 'function') {
                            updateNavbarAuthState();
                        }
                    };
                    document.head.appendChild(script);
                    return;
                }
            } catch (err) {
                console.error('Error at loading authState.js:', err);
            }
        }
        console.warn('Error at loading authState.js');
    })();
}