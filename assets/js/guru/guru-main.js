// 1. IMPORT
// Pastikan path config betul (../config.js jika dalam folder sama parent, atau sesuaikan)
import { db, auth } from '../config.js'; 
import { 
    collectionGroup, query, where, getDocs, limit 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// TAMBAHAN: Import signOut
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// IMPORT SEMUA MODUL (Kekalkan modul anda)
import { initJadualModule } from './guru-jadual.js';
import { initJanaRPH } from './guru-jana.js';
import { initSejarahModule } from './guru-sejarah.js'; 

// Variable Global
let currentTeacherRef = null;
let currentTeacherData = null;

// =========================================================
// FUNGSI UTAMA (INIT)
// =========================================================
export async function initGuruDashboard() {
    const targetDiv = document.getElementById('main-content');
    const user = auth.currentUser;

    if (!user) {
        targetDiv.innerHTML = '<p style="text-align:center; padding:20px;">Sila log masuk semula.</p>';
        return;
    }

    // 1. Paparan UI Utama
    // Saya tambah butang LOG KELUAR di bahagian header (top-right)
    targetDiv.innerHTML = `
        <div class="guru-container">
            <header class="dashboard-header" style="position:relative;">
                
                <button id="btnGuruLogout" style="position:absolute; top:20px; right:20px; background:#ef4444; color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    🚪 Log Keluar
                </button>

                <h1 id="welcome-text">Memuatkan profil...</h1>
                <p>Portal Pengurusan RPH Digital</p>
            </header>

            <section class="menu-section">
                <h3>Menu Utama</h3>
                <div class="button-grid">
                    <button class="menu-btn" id="btnOpenJadual">
                        <div class="icon">📅</div>
                        <span>Jadual Waktu</span>
                    </button>
                    
                    <button class="menu-btn btn-highlight" id="btnOpenJana">
                        <div class="icon">📝</div>
                        <span>Jana RPH</span>
                    </button>
                    
                    <button class="menu-btn" id="btnOpenSejarah">
                        <div class="icon">📚</div>
                        <span>Sejarah RPH</span>
                    </button>
                </div>
            </section>

            <div id="dashboard-status" style="margin-top:30px; text-align:center; color:#666;">
                <p>Pilih menu di atas untuk bermula.</p>
            </div>
        </div>
    `;

    // Masukkan CSS
    injectMainStyles();

    // 2. Event Listener: LOG KELUAR (Penting!)
    document.getElementById('btnGuruLogout').addEventListener('click', async () => {
        if(confirm("Adakah anda pasti mahu log keluar?")) {
            try {
                await signOut(auth);
                localStorage.clear(); // Bersihkan cache
                sessionStorage.clear();
                window.location.reload(); // Refresh page
            } catch (error) {
                alert("Gagal log keluar: " + error.message);
            }
        }
    });

    try {
        // 3. Dapatkan Data Guru dari Firestore
        // Gunakan query collectionGroup 'teachers' seperti kod asal anda
        const q = query(collectionGroup(db, 'teachers'), where('email', '==', user.email.toLowerCase()), limit(1));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
            const docSnap = snap.docs[0];
            currentTeacherRef = docSnap.ref;
            currentTeacherData = docSnap.data();

            // Kemaskini Nama di Header
            document.getElementById('welcome-text').textContent = `Selamat Datang, ${currentTeacherData.name || currentTeacherData.nama || 'Cikgu'}`;

            // --- EVENT LISTENERS MODUL ---
            
            // 1. Jadual Waktu
            document.getElementById('btnOpenJadual').addEventListener('click', () => {
                initJadualModule(currentTeacherRef, currentTeacherData);
            });

            // 2. Jana RPH
            document.getElementById('btnOpenJana').addEventListener('click', () => {
                initJanaRPH(currentTeacherRef, currentTeacherData);
            });

            // 3. Sejarah RPH
            document.getElementById('btnOpenSejarah').addEventListener('click', () => {
                initSejarahModule(currentTeacherData);
            });

        } else {
            // Jika profil guru tiada dalam database
            targetDiv.innerHTML = `
                <div style="text-align:center; padding:50px;">
                    <h2 style="color:red;">Profil Tidak Dijumpai</h2>
                    <p>Emel <b>${user.email}</b> tiada dalam pangkalan data guru.</p>
                    <button id="btnGuruLogoutError" style="background:#333; color:white; padding:10px 20px; border:none; margin-top:20px; cursor:pointer;">Log Keluar</button>
                </div>
            `;
            // Listener logout untuk skrin error
            document.getElementById('btnGuruLogoutError').addEventListener('click', async () => {
                await signOut(auth);
                window.location.reload();
            });
        }
    } catch (e) {
        console.error("Ralat Utama:", e);
        targetDiv.innerHTML = `<p style="color:red; text-align:center; padding:20px;">Ralat Sistem: ${e.message}</p>`;
    }
}

// =========================================================
// HELPER: CSS INJECTION
// =========================================================
function injectMainStyles() {
    if(document.getElementById('guru-main-css')) return;
    const css = `
        .guru-container { max-width: 1000px; margin: 0 auto; padding: 20px; animation: fadeIn 0.5s ease; }
        .dashboard-header { margin-bottom: 30px; text-align: center; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .dashboard-header h1 { margin: 0; color: #1e293b; }
        
        .button-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 20px; }
        
        .menu-btn { 
            background: white; padding: 30px; border-radius: 16px; 
            border: 2px solid #f1f5f9; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
            display: flex; flex-direction: column; align-items: center; gap: 15px; 
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .menu-btn:hover { transform: translateY(-5px); border-color: #4f46e5; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
        
        .menu-btn .icon { font-size: 2.5rem; margin-bottom: 5px; }
        .menu-btn span { font-weight: 700; color: #334155; font-size: 1.1rem; }
        
        .btn-highlight { background: #eef2ff; border-color: #c7d2fe; }
        .btn-highlight:hover { background: #e0e7ff; border-color: #4f46e5; }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    `;
    const style = document.createElement('style');
    style.id = 'guru-main-css';
    style.textContent = css;
    document.head.appendChild(style);
}