function updateNavbarAuthState() {
    const authButtons = document.getElementById('auth-buttons');
    const userInfoNavbar = document.getElementById('user-info-navbar');
    const userNameNavbar = document.getElementById('user-name-navbar');
    const logoutBtn = document.getElementById('logout-btn');

    if (!authButtons || !userInfoNavbar || !userNameNavbar || !logoutBtn) {
        setTimeout(updateNavbarAuthState, 100);
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
        } catch (error) {
            console.error('Error at parsing user data:', error);
            authButtons.style.display = 'flex';
            userInfoNavbar.style.display = 'none';
        }
    } else {
        authButtons.style.display = 'flex';
        userInfoNavbar.style.display = 'none';
    }
}

function handleLogout() {
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
    
    updateNavbarAuthState();
    
    window.location.href = '/src/pages/home/home.html';
}

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        updateNavbarAuthState();
        
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn && !logoutBtn.hasAttribute('data-listener-added')) {
            logoutBtn.setAttribute('data-listener-added', 'true');
            logoutBtn.addEventListener('click', handleLogout);
        }
    }, 300);
});

window.addEventListener('load', function() {
    setTimeout(updateNavbarAuthState, 100);
});

window.addEventListener('storage', function(e) {
    if (e.key === 'user') {
        updateNavbarAuthState();
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { updateNavbarAuthState, handleLogout };
}
