(function() {
    const userData = localStorage.getItem('user');
    
    if (!userData) {
        console.log('User not authenticated. Redirecting to login...');
        window.location.href = '/src/pages/auth/login.html';
        return;
    }
    
    try {
        const user = JSON.parse(userData);
        if (!user.uid || !user.email) {
            console.log('Invalid authentication data. Redirecting to login...');
            localStorage.removeItem('user');
            window.location.href = '/src/pages/auth/login.html';
        }
    } catch (error) {
        console.error('Error at checking authentication:', error);
        localStorage.removeItem('user');
        window.location.href = '/src/pages/auth/login.html';
    }
})();
