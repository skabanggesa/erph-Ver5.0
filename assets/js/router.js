// assets/js/router.js

import { auth, db } from './config.js'; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =========================================================
// 1. DEFINISI LALUAN (ROUTES)
// =========================================================
const routes = {
    'login': { id: 'login-screen', isApp: false },
    
    'superadmin-home': { 
        id: 'dashboard-screen', isApp: true,
        file: './admin/superadmin-dashboard.js', 
        func: 'loadSuperAdminDashboard', targetId: 'main-content'
    },

    'school-admin-home': { 
        id: 'dashboard-screen', isApp: true,
        file: './admin/school-dashboard.js',
        func: 'loadSchoolAdminDashboard', targetId: 'main-content'
    },

    'penyelia-home': { 
        id: 'dashboard-screen', isApp: true,
        file: './penyelia/penyelia-main.js', 
        func: 'loadPenyeliaDashboard', targetId: 'main-content'
    },

    'guru-home': { 
        id: 'dashboard-screen', isApp: true,
        file: './guru/guru-main.js', 
        func: 'loadGuruMain', targetId: 'main-content'
    }
};

// =========================================================
// 2. FUNGSI NAVIGASI UTAMA
// =========================================================
async function navigate(routeKey) {
    console.log("[Router] Menghala ke:", routeKey);
    const route = routes[routeKey];
    
    if (!route) return;

    const loginScreen = document.getElementById('login-screen');
    const dashScreen = document.getElementById('dashboard-screen');
    const targetDiv = document.getElementById(route.targetId);

    // Toggle Paparan Skrin
    if (route.isApp) {
        if(loginScreen) loginScreen.style.display = 'none';
        if(dashScreen) dashScreen.style.display = 'block';
    } else {
        if(loginScreen) loginScreen.style.display = 'flex';
        if(dashScreen) dashScreen.style.display = 'none';
        return; 
    }

    // Muatkan Modul Secara Dinamik
    if (route.file && targetDiv) {
        targetDiv.innerHTML = `
            <div style="text-align:center; margin-top:50px;">
                <div class="loading-spinner"></div>
                <p>Memuatkan modul...</p>
            </div>`;

        try {
            const module = await import(route.file);
            if (module[route.func]) {
                module[route.func](); 
            } else {
                throw new Error(`Fungsi ${route.func} tidak dijumpai.`);
            }
        } catch (error) {
            console.error("Router Load Error:", error);
            targetDiv.innerHTML = `<div style="color:red; padding:20px;">Ralat: Gagal memuatkan komponen ${route.file}</div>`;
        }
    }
}

// =========================================================
// 3. INISIALISASI ROUTER
// =========================================================
export function initRouter() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Set emel di navbar
            const navEmail = document.getElementById('navUserEmail');
            if(navEmail) navEmail.textContent = user.email;

            // Semak Role
            let role = localStorage.getItem('userRole');
            
            if (!role || role === 'undefined') {
                try {
                    // Cek Superadmin
                    const adminSnap = await getDoc(doc(db, 'users', user.uid));
                    if (adminSnap.exists()) {
                        role = 'superadmin';
                    } else {
                        // Cek Admin Sekolah (Gunakan format emel ikut auth.js anda)
                        const schoolSnap = await getDoc(doc(db, 'schools', user.email.toLowerCase()));
                        if (schoolSnap.exists()) {
                            role = 'admin_sekolah';
                        } else {
                            // Cek Teachers (Guru/Penyelia)
                            const q = query(collection(db, 'teachers'), where('email', '==', user.email.toLowerCase()));
                            const qSnap = await getDocs(q);
                            if (!qSnap.empty) {
                                role = qSnap.docs[0].data().role || 'guru';
                            } else {
                                role = 'guru';
                            }
                        }
                    }
                    localStorage.setItem('userRole', role);
                } catch (e) {
                    role = 'guru';
                }
            }

            // Hala ke Dashboard yang betul
            if (role === 'superadmin') navigate('superadmin-home');
            else if (role === 'admin_sekolah' || role === 'admin') navigate('school-admin-home');
            else if (role === 'penyelia') navigate('penyelia-home');
            else navigate('guru-home');

        } else {
            navigate('login');
        }
    });
}