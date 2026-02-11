// assets/js/router.js
// VERSI DIKEMASKINI: LOGIK HYBRID (ROLE & FLAGS)

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
        func: 'loadGuruDashboard', targetId: 'main-content'
    }
};

// =========================================================
// 2. FUNGSI NAVIGASI
// =========================================================
async function navigate(routeName) {
    const route = routes[routeName];
    if (!route) return;

    // Sembunyikan semua skrin
    document.querySelectorAll('.screen').forEach(el => el.style.display = 'none');
    
    // Paparkan skrin sasaran
    const targetEl = document.getElementById(route.id);
    if (targetEl) targetEl.style.display = (route.id === 'login-screen') ? 'flex' : 'block';

    // Jika perlukan fail JS modul
    if (route.isApp && route.file) {
        try {
            const module = await import(route.file);
            if (module[route.func]) {
                module[route.func]();
            }
        } catch (e) {
            console.error("Gagal memuatkan modul:", e);
        }
    }
}

// =========================================================
// 3. PEMANTAUAN STATUS AUTH (AUTH STATE OBSERVER)
// =========================================================
export function initRouter() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // console.log("User detected:", user.email); // Debug
            
            // Cuba dapatkan role dari LocalStorage dahulu (untuk prestasi)
            let role = localStorage.getItem('userRole');

            // Jika tiada dalam cache, atau user refresh page, semak DB semula
            if (!role) {
                try {
                    // 1. Cek SuperAdmin
                    const superDoc = await getDoc(doc(db, 'users', user.uid));
                    if (superDoc.exists() && superDoc.data().role === 'superadmin') {
                        role = 'superadmin';
                    } else {
                        // 2. Cek Admin Sekolah (ID Dokumen = Emel)
                        const schoolSnap = await getDoc(doc(db, 'schools', user.email.toLowerCase()));
                        if (schoolSnap.exists()) {
                            role = 'admin_sekolah';
                        } else {
                            // 3. Cek Teachers (Hybrid Logic: Guru & Penyelia)
                            const q = query(collection(db, 'teachers'), where('email', '==', user.email.toLowerCase()));
                            const qSnap = await getDocs(q);
                            
                            if (!qSnap.empty) {
                                const data = qSnap.docs[0].data();
                                
                                // --- LOGIK PEMBETULAN DI SINI ---
                                // Kita semak flag 'isPenyelia' dahulu
                                if (data.isPenyelia === true || data.role === 'penyelia') {
                                    role = 'penyelia';
                                } else {
                                    // Jika bukan penyelia, maka dia guru
                                    role = 'guru';
                                }
                                // -------------------------------

                            } else {
                                // Jika rekod tiada langsung, default ke guru
                                role = 'guru';
                            }
                        }
                    }
                    localStorage.setItem('userRole', role);
                } catch (e) {
                    console.error("Ralat Router Auth:", e);
                    role = 'guru'; // Fallback selamat
                }
            }

            // Hala ke Dashboard yang betul berdasarkan role
            if (role === 'superadmin') navigate('superadmin-home');
            else if (role === 'admin_sekolah' || role === 'admin') navigate('school-admin-home');
            else if (role === 'penyelia') navigate('penyelia-home');
            else navigate('guru-home');

        } else {
            // Jika tiada user, pergi ke login
            localStorage.removeItem('userRole');
            navigate('login');
        }
    });
}
