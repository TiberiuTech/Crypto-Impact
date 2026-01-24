// Configurația Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCUBaBkHSTdHmKdIfZCezkpA-I8edvdzew",
  authDomain: "licenta-27ed8.firebaseapp.com",
  projectId: "licenta-27ed8",
  storageBucket: "licenta-27ed8.firebasestorage.app",
  messagingSenderId: "898320210269",
  appId: "1:898320210269:web:3da2b12afc853964a530b4",
  measurementId: "G-H97EH5Q57V"
};

// Verificăm dacă utilizatorul este deja autentificat
(function checkIfAlreadyAuthenticated() {
    const userData = localStorage.getItem('user');
    if (userData) {
        try {
            const user = JSON.parse(userData);
            if (user.uid && user.email) {
                // Utilizatorul este deja autentificat - redirecționăm către home
                console.log('Utilizator deja autentificat. Redirecționare către home...');
                window.location.href = '/src/pages/home/home.html';
                return;
            }
        } catch (error) {
            // Date invalide - continuăm la register
            localStorage.removeItem('user');
        }
    }
})();

// Declarăm auth global
let auth;

// Funcție pentru inițializarea Firebase
function initializeFirebase() {
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK nu este încărcat! Verifică scripturile din HTML.');
        return false;
    }
    
    try {
        // Verificăm dacă Firebase este deja inițializat
        let app;
        try {
            app = firebase.app();
            console.log('Firebase deja inițializat');
        } catch (e) {
            // Nu există app inițializat, inițializăm
            console.log('Inițializăm Firebase...');
            app = firebase.initializeApp(firebaseConfig);
            console.log('Firebase inițializat cu succes');
        }
        auth = firebase.auth();
        console.log('Firebase Auth inițializat');
        return true;
    } catch (error) {
        console.error('Eroare la inițializarea Firebase:', error);
        return false;
    }
}

// Inițializăm Firebase când DOM-ul este gata
document.addEventListener('DOMContentLoaded', function() {
    // Așteptăm puțin pentru a ne asigura că Firebase SDK este încărcat
    setTimeout(() => {
        if (!initializeFirebase()) {
            console.error('Nu s-a putut inițializa Firebase!');
        }
    }, 100);
});

// Așteptăm ca Firebase să fie inițializat înainte de a continua
document.addEventListener('DOMContentLoaded', () => {
    // Așteptăm puțin mai mult pentru a ne asigura că Firebase este gata
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

    // Funcție pentru afișarea erorilor
    function showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
    }

    function clearError(element) {
        element.textContent = '';
        element.style.display = 'none';
    }

    // Validare nume (minim 3 caractere)
    function validateName(name) {
        return name.trim().length >= 3;
    }

    // Validare email
    function validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Validare parolă: minim 6 caractere, o cifră, un simbol și o literă
    function validatePassword(password) {
        if (password.length < 6) {
            return { valid: false, message: 'Parola trebuie să aibă minim 6 caractere' };
        }
        
        const hasDigit = /\d/.test(password);
        const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
        const hasLetter = /[a-zA-Z]/.test(password);

        if (!hasDigit) {
            return { valid: false, message: 'Parola trebuie să conțină cel puțin o cifră' };
        }
        
        if (!hasSymbol) {
            return { valid: false, message: 'Parola trebuie să conțină cel puțin un simbol' };
        }
        
        if (!hasLetter) {
            return { valid: false, message: 'Parola trebuie să conțină cel puțin o literă' };
        }

        return { valid: true };
    }

    // Handler pentru submit formular
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Curățăm erorile anterioare
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

        // Validare nume
        if (!name) {
            showError(nameError, 'Numele este obligatoriu');
            nameInput.classList.add('error');
            hasErrors = true;
        } else if (!validateName(name)) {
            showError(nameError, 'Numele trebuie să aibă minim 3 caractere');
            nameInput.classList.add('error');
            hasErrors = true;
        }

        // Validare email
        if (!email) {
            showError(emailError, 'Email-ul este obligatoriu');
            emailInput.classList.add('error');
            hasErrors = true;
        } else if (!validateEmail(email)) {
            showError(emailError, 'Email-ul trebuie să conțină @ și un domeniu valid');
            emailInput.classList.add('error');
            hasErrors = true;
        }

        // Validare parolă
        if (!password) {
            showError(passwordError, 'Parola este obligatorie');
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

        // Verificăm dacă auth este disponibil
        if (!auth) {
            showError(emailError, 'Firebase nu este inițializat corect. Reîncarcă pagina.');
            return;
        }

        // Încercăm crearea contului
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Actualizăm profilul cu numele
            await user.updateProfile({
                displayName: name
            });

            // Salvez informațiile utilizatorului în localStorage
            localStorage.setItem('user', JSON.stringify({
                uid: user.uid,
                email: user.email,
                displayName: name
            }));

            // Actualizăm navbar-ul dacă funcția există
            if (typeof updateNavbarAuthState === 'function') {
                updateNavbarAuthState();
            }

            // Redirecționăm către pagina principală
            window.location.href = '/src/pages/home/home.html';
        } catch (error) {
            console.error('Eroare la înregistrare:', error);
            
            // Gestionăm erorile Firebase
            let errorMessage = '';
            switch (error.code) {
                case 'auth/api-key-not-valid':
                case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
                    errorMessage = 'API key Firebase invalid. Verifică configurația în consolă Firebase și asigură-te că Authentication este activat.';
                    break;
                case 'auth/email-already-in-use':
                    errorMessage = 'Acest email este deja înregistrat. Te rugăm să te autentifici.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Email invalid.';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Parola este prea slabă.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'Operația nu este permisă. Contactează administratorul.';
                    break;
                default:
                    errorMessage = `Eroare la înregistrare: ${error.message || 'Te rugăm să încerci din nou.'}`;
            }
            
            showError(emailError, errorMessage);
            emailInput.classList.add('error');
        }
    });
}
