// assets/js/auth.js

import { auth, db } from './config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// DOM Elements
const loginForm = document.getElementById('loginForm');
const errorDiv = document.getElementById('error');
const logoutBtn = document.getElementById('logoutBtn');
const navbar = document.getElementById('navbar');
const userNameEl = document.getElementById('userName');
const welcomeEl = document.getElementById('welcome');

// Helper: Tentukan halaman semasa
const isDashboardPage = window.location.pathname.includes('dashboard.html');
const isLoginPage = !isDashboardPage; 

// --- LOGIK PENGALIHAN (REDIRECT) ---
function handleRedirect(user) {
  // Situasi 1: Pengguna Log Masuk
  if (user) {
    // Dapatkan data pengguna dari Firestore
    getDoc(doc(db, 'users', user.uid)).then((userDoc) => {
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Simpan info penting dalam LocalStorage
        localStorage.setItem('userRole', userData.role);
        localStorage.setItem('userName', userData.name);

        // JIKA berada di halaman Login/Index, Aliaskan ke Dashboard
        if (isLoginPage) {
          console.log('Pengguna sah, mengalih ke Dashboard...');
          window.location.replace('./dashboard.html'); 
        }
      } else {
        alert('Data pengguna tiada. Sila hubungi Admin.');
        signOut(auth);
      }
    }).catch((error) => {
      console.error("Ralat mendapatkan data pengguna:", error);
      if(errorDiv) errorDiv.textContent = "Masalah sambungan server.";
    });
  } 
  
  // Situasi 2: Pengguna TIDAK Log Masuk
  else {
    if (isDashboardPage) {
      console.log('Tiada akses, kembali ke Login...');
      window.location.replace('./index.html');
    }
  }
}

// --- PERISTIWA (EVENTS) ---

// 1. Pantau Status Login
onAuthStateChanged(auth, (user) => {
  handleRedirect(user);
  
  // Jika di dashboard dan user wujud, setup UI
  if (user && isDashboardPage) {
    setupDashboardUI();
  }
});

// 2. Fungsi Login
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if(errorDiv) errorDiv.textContent = 'Sedang menyemak...';

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error(err);
      let msg = 'Ralat log masuk.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = 'Emel atau kata laluan salah.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Terlalu banyak percubaan. Sila tunggu sebentar.';
      }
      if(errorDiv) errorDiv.textContent = msg;
    }
  });
}

// 3. Fungsi Logout
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    const confirmLogout = confirm("Adakah anda pasti mahu log keluar?");
    if (confirmLogout) {
      await signOut(auth);
      localStorage.clear(); 
      window.location.replace('./index.html');
    }
  });
}

// --- UI DASHBOARD ---
function setupDashboardUI() {
  if (navbar) {
    const role = localStorage.getItem('userRole');
    const name = localStorage.getItem('userName');
    
    if (name && userNameEl) userNameEl.textContent = name;
    
    // UI Logic berdasarkan Role (DIKEMASKINI UNTUK SUPERADMIN)
    if (welcomeEl) {
        if (role === 'superadmin') {
          welcomeEl.innerHTML = `Selamat Datang, <span style="color:#7c3aed; font-weight:bold;">Super Admin</span>`;
        } else if (role === 'admin') {
          welcomeEl.innerHTML = `Selamat Datang, <span style="color:#d32f2f; font-weight:bold;">Admin (Penyelia)</span>`;
        } else {
          welcomeEl.innerHTML = `Selamat Datang, <span style="color:#1976d2">Cikgu</span>`;
        }
    }

    navbar.style.display = 'flex';
  }
}