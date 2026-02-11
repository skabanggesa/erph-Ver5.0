// assets/js/router.js
// VERSI: STRICT BOOLEAN (isPenyelia / isGuru SAHAJA)

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
            // console.log("User detected:", user.email);

            // PENTING: Kita TIDAK LAGI percaya bulat-bulat pada LocalStorage
            // Kita akan semak database untuk pastikan role sentiasa tepat (terutama bila tukar role)
            
            let finalRoute = 'login'; // Default

            try {
                // 1. Cek SuperAdmin (Users Collection)
                const superDoc = await getDoc(doc(db, 'users', user.uid));
                if (superDoc.exists() && superDoc.data().role === 'superadmin') {
                    finalRoute = 'superadmin-home';
                } else {
                    
                    // 2. Cek Admin Sekolah (Schools Collection)
                    // (Menggunakan ID dokumen = email)
                    const schoolSnap = await getDoc(doc(db, 'schools', user.email.toLowerCase()));
                    
                    if (schoolSnap.exists()) {
                        finalRoute = 'school-admin-home';
                    } else {
                        
                        // 3. Cek Teachers (Teachers Collection)
                        // KITA GUNA LOGIK "FLAGS" SAHAJA DI SINI
                        const q = query(collection(db, 'teachers'), where('email', '==', user.email.toLowerCase()));
                        const qSnap = await getDocs(q);
                        
                        if (!qSnap.empty) {
                            const data = qSnap.docs[0].data();
                            
                            // LOGIK KEUTAMAAN:
                            // Jika isPenyelia == true, dia Penyelia (tak kira isGuru true atau false)
                            if (data.isPenyelia === true) {
                                finalRoute = 'penyelia-home';
                            } 
                            // Jika bukan penyelia, tapi isGuru == true
                            else if (data.isGuru === true) {
                                finalRoute = 'guru-home';
                            }
                            else {
                                // Akaun wujud tapi tiada flag true
                                alert("Akaun anda wujud tetapi tidak aktif (Tiada 'isGuru' atau 'isPenyelia').");
                                finalRoute = 'login';
                            }

                        } else {
                            // Tiada rekod langsung
                            console.log("Tiada rekod guru/penyelia dijumpai.");
                            finalRoute = 'login'; 
                        }
                    }
                }
            } catch (e) {
                console.error("Ralat Router:", e);
                finalRoute = 'login';
            }

            // Simpan status terkini (pilihan)
            localStorage.setItem('lastRoute', finalRoute);
            
            // Laksanakan Navigasi
            navigate(finalRoute);

        } else {
            // Tiada user login
            localStorage.removeItem('lastRoute');
            navigate('login');
        }
    });
}
