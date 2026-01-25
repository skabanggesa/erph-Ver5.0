// assets/js/router.js

import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app, db } from './config.js'; 

const firebaseAuth = getAuth(app); 

// --- SENARAI LALUAN (ROUTES) ---
const routes = {
    // Auth
    'login': { file: 'auth.js', func: 'loadLoginPage' },
    
    // Guru
    'guru-home': { file: 'guru/guru-dashboard.js', func: 'loadGuruDashboard' }, 
    'guru-jadual': { file: 'guru/jadual-editor.js', func: 'loadJadualEditor' },
    'guru-rph-generator': { file: 'guru/rph-generator.js', func: 'loadRphGenerator' },
    'guru-rph-history': { file: 'guru/rph-history.js', func: 'loadRphHistory' },
    'guru-rph-edit': { file: 'guru/rph-edit.js', func: 'loadRphEdit' }, 
    
    // Admin
    'admin-home': { file: 'admin/dashboard.js', func: 'loadAdminDashboard' },
    'admin-rph-review': { file: 'admin/rph-review.js', func: 'loadRphReview' },
    'admin-teachers': { file: 'admin/teachers.js', func: 'loadTeachers' },        
    'admin-analytics': { file: 'admin/analytics.js', func: 'loadAnalytics' },      
    'admin-maintenance': { file: 'admin/admin-maintenance.js', func: 'loadMaintenance' }, 
    
    // Default
    'home': null 
};

// --- FUNGSI NAVIGASI UTAMA ---
window.router = {
    navigate: async function(fullPath) {
        console.log("Navigasi ke:", fullPath);

        const [path, queryString] = fullPath.split('?');
        const route = routes[path];

        if (path === 'home') {
            return; // Logik redirect dikendalikan oleh onAuthStateChanged
        }

        if (!route) {
            console.error(`Laluan '${path}' tidak dijumpai dalam router.`);
            const contentEl = document.getElementById('content');
            if(contentEl) contentEl.innerHTML = `<p style="color:red; text-align:center; margin-top:50px;">Ralat 404: Halaman '${path}' tidak dijumpai.</p>`;
            return;
        }

        try {
            // Import fail secara dinamik
            const module = await import(`./${route.file}`);
            
            let id = null;
            if (queryString) {
                const params = new URLSearchParams(queryString);
                id = params.get('id');
            }

            // Jalankan fungsi
            if (module[route.func]) {
                module[route.func](id); 
            } else {
                console.error(`Fungsi ${route.func} tiada dalam fail ${route.file}`);
            }

        } catch (error) {
            console.error("Ralat memuatkan modul:", error);
            const contentEl = document.getElementById('content');
            if(contentEl) contentEl.innerHTML = `<p style="color:red; text-align:center;">Gagal memuatkan modul: ${error.message}</p>`;
        }
    }
};

const navigate = window.router.navigate;

// --- LOGIK AUTH & PENGHALAAN AUTOMATIK ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(firebaseAuth, async (user) => {
        const contentDiv = document.getElementById('content');
        const navbar = document.getElementById('navbar');
        const userNameEl = document.getElementById('userName');
        const roleStyle = document.getElementById('role-style'); 

        if (user) {
            // 1. User Logged In
            let role = localStorage.getItem('userRole');
            
            // Jika role tiada dalam storage, fetch dari Firestore
            if (!role) {
                try {
                    const docSnap = await getDoc(doc(db, 'users', user.uid));
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        role = userData.role;
                        localStorage.setItem('userRole', role); 
                        localStorage.setItem('userName', userData.name); 
                    } else {
                        await signOut(firebaseAuth);
                        window.location.href = 'index.html';
                        return;
                    }
                } catch (e) {
                    console.error("Ralat sambungan:", e);
                    if(contentDiv) contentDiv.innerHTML = '<p class="error">Masalah sambungan internet.</p>';
                    return;
                }
            }

            // 2. Setup UI
            if (role) {
                if (navbar) navbar.style.display = 'flex';
                
                // KEMASKINI 1: Gunakan CSS Admin untuk Super Admin juga
                if (roleStyle) {
                    roleStyle.href = (role === 'admin' || role === 'superadmin')
                        ? './assets/css/admin.css' 
                        : './assets/css/guru.css';
                }
                
                const name = localStorage.getItem('userName');
                if (userNameEl && name) userNameEl.textContent = name;

                // 3. Tentukan Ke Mana Nak Pergi
                // KEMASKINI 2: Logik 'OR' (||) ditambah di sini
                // Jika Admin ATAU Super Admin -> Pergi ke Dashboard Admin
                if (role === 'admin' || role === 'superadmin') {
                    navigate('admin-home');
                } else {
                    // Jika selain itu (guru) -> Pergi ke Dashboard Guru
                    navigate('guru-home'); 
                }
            }

        } else {
            // 4. User Logged Out / Tiada Sesi
            if (navbar) navbar.style.display = 'none';
            localStorage.clear();
            navigate('login');
        }
    });
});