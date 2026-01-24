const firebaseConfig = {
  apiKey: "AIzaSyCUBaBkHSTdHmKdIfZCezkpA-I8edvdzew",
  authDomain: "licenta-27ed8.firebaseapp.com",
  projectId: "licenta-27ed8",
  storageBucket: "licenta-27ed8.firebasestorage.app",
  messagingSenderId: "898320210269",
  appId: "1:898320210269:web:3da2b12afc853964a530b4",
  measurementId: "G-H97EH5Q57V"
};

(function checkIfAlreadyAuthenticated() {
    const userData = localStorage.getItem('user');
    if (userData) {
        try {
            const user = JSON.parse(userData);
            if (user.uid && user.email) {
                console.log('User already authenticated. Redirecting to home...');
                window.location.href = '/src/pages/home/home.html';
                return;
            }
        } catch (error) {
            localStorage.removeItem('user');
        }
    }
})();

let auth;

function initializeFirebase() {
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not loaded! Check the scripts in HTML.');
        return false;
    }
    
    try {
        let app;
        try {
            app = firebase.app();
            console.log('Firebase already initialized');
        } catch (e) {
            console.log('Initializing Firebase...');
            app = firebase.initializeApp(firebaseConfig);
            console.log('Firebase initialized successfully');
        }
        auth = firebase.auth();
        console.log('Firebase Auth initialized');
        return true;
    } catch (error) {
        console.error('Error at initializing Firebase:', error);
        return false;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (!initializeFirebase()) {
            console.error('Error at initializing Firebase!');
        }
    }, 100);
});

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupLoginForm();
    }, 200);
});

function setupLoginForm() {
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const emailError = document.getElementById('email-error');
    const passwordError = document.getElementById('password-error');

    function showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
    }

    function clearError(element) {
        element.textContent = '';
        element.style.display = 'none';
    }

    function validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        clearError(emailError);
        clearError(passwordError);
        emailInput.classList.remove('error');
        passwordInput.classList.remove('error');

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        let hasErrors = false;

        if (!email) {
            showError(emailError, 'Email is required');
            emailInput.classList.add('error');
            hasErrors = true;
        } else if (!validateEmail(email)) {
            showError(emailError, 'Email must contain @ and a valid domain');
            emailInput.classList.add('error');
            hasErrors = true;
        }

        if (!password) {
            showError(passwordError, 'Password is required');
            passwordInput.classList.add('error');
            hasErrors = true;
        }

        if (hasErrors) {
            return;
        }

        if (!auth) {
            showError(passwordError, 'Firebase not initialized correctly. Reload the page.');
            return;
        }

        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            const userData = {
                uid: user.uid,
                email: user.email
            };
            
            if (user.displayName) {
                userData.displayName = user.displayName;
            }
            
            localStorage.setItem('user', JSON.stringify(userData));

            if (typeof updateNavbarAuthState === 'function') {
                updateNavbarAuthState();
            }

            window.location.href = '/src/pages/home/home.html';
        } catch (error) {
            console.error('Error at authentication:', error);
            
            let errorMessage = '';
            switch (error.code) {
                case 'auth/api-key-not-valid':
                case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
                    errorMessage = 'API key Firebase invalid. Check the Firebase console and ensure Authentication is activated.';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'Account does not exist. Please register first.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Email invalid.';
                    break;
                case 'auth/invalid-credential':
                    errorMessage = 'Email or password incorrect.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many requests. Please try again later.';
                    break;
                default:
                    errorMessage = `Error at authentication: ${error.message || 'Please try again.'}`;
            }
            
            showError(passwordError, errorMessage);
            passwordInput.classList.add('error');
        }
    });
}
