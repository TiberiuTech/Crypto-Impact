// Configurația Firebase pentru aplicația licenta
// Acest fișier este folosit când Firebase este încărcat prin CDN

// Configurația aplicației web Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCUBaBkHSTdHmKdIfZCezkpA-18edvdzew",
  authDomain: "licenta-27ed8.firebaseapp.com",
  projectId: "licenta-27ed8",
  storageBucket: "licenta-27ed8.firebasestorage.app",
  messagingSenderId: "898320210269",
  appId: "1:898320210269:web:3da2b12afc853964a530b4",
  measurementId: "G-H97EH5Q57V"
};

// Inițializăm Firebase (când este disponibil global)
let app, auth;

if (typeof firebase !== 'undefined') {
  app = firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
} else {
  console.error('Firebase nu este încărcat. Asigură-te că incluzi Firebase SDK înainte de acest script.');
}

// Exportăm pentru compatibilitate
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { firebaseConfig, app, auth };
}
