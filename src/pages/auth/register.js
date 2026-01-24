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
        setupRegisterForm();
    }, 200);
});

function setupRegisterForm() {
    const registerForm = document.getElementById('register-form');
    const nameInput = document.getElementById('register-name');
    const emailInput = document.getElementById('register-email');
    const passwordInput = document.getElementById('register-password');
    const nameError = document.getElementById('name-error');
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

    function validateName(name) {
        return name.trim().length >= 3;
    }

    function validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function validatePassword(password) {
        if (password.length < 6) {
            return { valid: false, message: 'password must be at least 6 characters long' };
        }
        
        const hasDigit = /\d/.test(password);
        const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
        const hasLetter = /[a-zA-Z]/.test(password);

        if (!hasDigit) {
            return { valid: false, message: 'Password must contain at least one digit' };
        }
        
        if (!hasSymbol) {
            return { valid: false, message: 'Password must contain at least one symbol' };
        }
        
        if (!hasLetter) {
            return { valid: false, message: 'Password must contain at least one letter' };
        }

        return { valid: true };
    }

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        clearError(nameError);
        clearError(emailError);
        clearError(passwordError);
        nameInput.classList.remove('error');
        emailInput.classList.remove('error');
        passwordInput.classList.remove('error');

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        let hasErrors = false;

        if (!name) {
            showError(nameError, 'Name is required');
            nameInput.classList.add('error');
            hasErrors = true;
        } else if (!validateName(name)) {
            showError(nameError, 'Name must be at least 3 characters long');
            nameInput.classList.add('error');
            hasErrors = true;
        }

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
        } else {
            const passwordValidation = validatePassword(password);
            if (!passwordValidation.valid) {
                showError(passwordError, passwordValidation.message);
                passwordInput.classList.add('error');
                hasErrors = true;
            }
        }

        if (hasErrors) {
            return;
        }

        if (!auth) {
            showError(emailError, 'Firebase not initialized correctly. Reload the page.');
            return;
        }

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            await user.updateProfile({
                displayName: name
            });

            localStorage.setItem('user', JSON.stringify({
                uid: user.uid,
                email: user.email,
                displayName: name
            }));

            if (typeof updateNavbarAuthState === 'function') {
                updateNavbarAuthState();
            }

            window.location.href = '/src/pages/home/home.html';
        } catch (error) {
            console.error('Error at registration:', error);
            
            // Gestionăm erorile Firebase
            let errorMessage = '';
            switch (error.code) {
                case 'auth/api-key-not-valid':
                case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
                    errorMessage = 'API key Firebase invalid. Check the Firebase console and ensure Authentication is activated.';
                    break;
                case 'auth/email-already-in-use':
                    errorMessage = 'This email is already registered. Please login.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Email invalid.';
                    break;
                case 'auth/weak-password':
                        errorMessage = 'Password is too weak.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'Operation not allowed. Contact the administrator.';
                    break;
                default:
                    errorMessage = `Error at registration: ${error.message || 'Please try again.'}`;
            }
            
            showError(emailError, errorMessage);
            emailInput.classList.add('error');
        }
    });
}
