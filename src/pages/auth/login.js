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
            // Date invalide - continuăm la login
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
        setupLoginForm();
    }, 200);
});

function setupLoginForm() {
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
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

    // Validare email
    function validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Handler pentru submit formular
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Curățăm erorile anterioare
        clearError(emailError);
        clearError(passwordError);
        emailInput.classList.remove('error');
        passwordInput.classList.remove('error');

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        let hasErrors = false;

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
        }

        if (hasErrors) {
            return;
        }

        // Verificăm dacă auth este disponibil
        if (!auth) {
            showError(passwordError, 'Firebase nu este inițializat corect. Reîncarcă pagina.');
            return;
        }

        // Încercăm autentificarea
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Salvez informațiile utilizatorului în localStorage
            const userData = {
                uid: user.uid,
                email: user.email
            };
            
            // Adăugăm displayName dacă există
            if (user.displayName) {
                userData.displayName = user.displayName;
            }
            
            localStorage.setItem('user', JSON.stringify(userData));

            // Actualizăm navbar-ul dacă funcția există
            if (typeof updateNavbarAuthState === 'function') {
                updateNavbarAuthState();
            }

            // Redirecționăm către pagina principală
            window.location.href = '/src/pages/home/home.html';
        } catch (error) {
            console.error('Eroare la autentificare:', error);
            
            // Gestionăm erorile Firebase
            let errorMessage = '';
            switch (error.code) {
                case 'auth/api-key-not-valid':
                case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
                    errorMessage = 'API key Firebase invalid. Verifică configurația în consolă Firebase și asigură-te că Authentication este activat.';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'Contul nu există. Te rugăm să te înregistrezi mai întâi.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Parolă incorectă.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Email invalid.';
                    break;
                case 'auth/invalid-credential':
                    errorMessage = 'Email sau parolă incorectă.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Prea multe încercări. Te rugăm să încerci mai târziu.';
                    break;
                default:
                    errorMessage = `Eroare la autentificare: ${error.message || 'Te rugăm să încerci din nou.'}`;
            }
            
            showError(passwordError, errorMessage);
            passwordInput.classList.add('error');
        }
    });
}
