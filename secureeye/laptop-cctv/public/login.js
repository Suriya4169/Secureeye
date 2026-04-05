// ===================================================================
// SecureEye — Login Authentication (Firebase)
// ===================================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// Firebase config from hackee mailapp
const firebaseConfig = {
    // FIREBASE CONFIG HAS BEEN REMOVED FOR SECURITY.
    // Please load these from your backend or environment variables safely.
    apiKey: "REMOVED",
    authDomain: "REMOVED",
    projectId: "REMOVED",
    storageBucket: "REMOVED",
    messagingSenderId: "REMOVED",
    appId: "REMOVED",
    measurementId: "REMOVED"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const $ = (id) => document.getElementById(id);
const loginForm = $('loginForm');
const btnLogin = $('btnLogin');
const errorMessage = $('errorMessage');

// Check if already logged in
onAuthStateChanged(auth, (user) => {
    if (user && window.location.pathname === '/login.html') {
        window.location.href = '/index.html';
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = $('email').value.trim();
    const password = $('password').value;

    if (!email || !password) {
        showError('Please enter both email and password');
        return;
    }

    // Show loading state
    btnLogin.disabled = true;
    btnLogin.innerHTML = '<span class="spinner"></span>Signing in...';
    hideError();

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // Success - redirect to dashboard
        if (userCredential.user) {
            window.location.href = '/index.html';
        }
    } catch (err) {
        let errorMsg = 'Login failed. Please try again.';
        
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
            errorMsg = 'Invalid email or password';
        } else if (err.code === 'auth/user-not-found') {
            errorMsg = 'No account found with this email';
        } else if (err.code === 'auth/too-many-requests') {
            errorMsg = 'Too many failed attempts. Please try again later.';
        } else if (err.code === 'auth/invalid-email') {
            errorMsg = 'Invalid email address';
        }
        
        showError(errorMsg);
        btnLogin.disabled = false;
        btnLogin.textContent = 'Sign In to Dashboard';
        console.error('Login error:', err);
    }
});

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
}

function hideError() {
    errorMessage.classList.remove('show');
}
