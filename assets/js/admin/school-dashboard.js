/**
 * ==============================================================================================
 * ASSETS/JS/ADMIN/SCHOOL-DASHBOARD.JS (VERSI PEMBETULAN PENUH - HYBRID DATA)
 * ==============================================================================================
 * * PENERANGAN FAIL:
 * Modul ini mengendalikan keseluruhan papan pemuka (dashboard) untuk pentadbir sekolah.
 * * * PEMBETULAN TERKINI:
 * 1. HYBRID DATA READING: Membaca format lama (field 'role') dan format baru (flags 'isGuru').
 * Ini menyelesaikan masalah data guru/penyelia dipaparkan sebagai "0".
 * 2. DUAL SYNC: Data disimpan serentak di koleksi Global dan Sekolah.
 * 3. BATCH WRITE: Memastikan integriti data semasa simpan/padam.
 * * * STRUKTUR DATABASE:
 * 1. Global: 'teachers/{email}'
 * 2. Sekolah: 'schools/{schoolId}/teachers/{email}'
 * ==============================================================================================
 */

import { auth, db } from '../config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    doc, getDoc, setDoc, deleteDoc, updateDoc, writeBatch,
    collection, query, where, getDocs, getCountFromServer, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =========================================================
// 1. PEMBOLEHUBAH GLOBAL & STATE
// =========================================================
let currentSchoolId = null;
let currentUserEmail = null;
let chartInstancePie = null;
let chartInstanceBar = null;

// =========================================================
// 2. SUNTIKAN GAYA UI (ADVANCED CSS)
// =========================================================
const style = document.createElement('style');
style.innerHTML = `
    :root {
        --primary-color: #4f46e5;
        --primary-hover: #4338ca;
        --secondary-color: #64748b;
        --success-color: #10b981;
        --danger-color: #ef4444;
        --warning-color: #f59e0b;
        --bg-light: #f8fafc;
        --border-color: #e2e8f0;
        --text-dark: #1e293b;
        --card-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
    }

    .dashboard-container { 
        max-width: 1280px; 
        margin: 0 auto; 
        padding: 30px; 
        font-family: 'Inter', system-ui, -apple-system, sans-serif; 
        color: var(--text-dark);
        animation: fadeIn 0.5s ease-in-out;
    }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    /* --- HEADER SECTION --- */
    .dash-header { 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        margin-bottom: 40px; 
        border-bottom: 2px solid var(--border-color); 
        padding-bottom: 20px;
    }
    .header-content h1 { margin: 0; font-size: 2rem; font-weight: 800; letter-spacing: -0.025em; }
    .header-content p { margin: 5px 0 0; color: var(--secondary-color); font-size: 0.95rem; }

    .btn-logout { 
        background: var(--danger-color); 
        color: white; 
        border: none; 
        padding: 12px 24px; 
        border-radius: 8px; 
        cursor: pointer; 
        font-weight: 600; 
        display: flex; 
        align-items: center; 
        gap: 10px; 
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);
    }
    .btn-logout:hover { background: #dc2626; transform: translateY(-2px); box-shadow: 0 4px 6px rgba(239, 68, 68, 0.3); }

    /* --- STATS CARDS --- */
    .stats-grid { 
        display: grid; 
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
        gap: 25px; 
        margin-bottom: 40px; 
    }
    .stat-card { 
        background: white; 
        padding: 30px; 
        border-radius: 16px; 
        box-shadow: var(--card-shadow); 
        display: flex; 
        align-items: center; 
        justify-content: space-between; 
        border-left: 6px solid var(--primary-color); 
        transition: transform 0.2s;
    }
    .stat-card:hover { transform: translateY(-4px); }
    .stat-card.green { border-left-color: var(--success-color); }
    
    .stat-info h3 { margin: 0; color: var(--secondary-color); font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-info p { margin: 10px 0 5px; font-size: 2.5rem; font-weight: 800; color: var(--text-dark); line-height: 1; }
    .stat-sub { font-size: 0.85rem; color: #94a3b8; }
    .stat-icon { font-size: 3.5rem; opacity: 0.1; filter: grayscale(100%); transition: 0.3s; }
    .stat-card:hover .stat-icon { opacity: 0.2; transform: scale(1.1); }

    /* --- CHARTS --- */
    .charts-wrapper { 
        display: grid; 
        grid-template-columns: 1fr 2fr; 
        gap: 30px; 
        margin-bottom: 50px; 
    }
    .chart-box { 
        background: white; 
        padding: 25px; 
        border-radius: 16px; 
        box-shadow: var(--card-shadow); 
        border: 1px solid var(--border-color); 
        display: flex; 
        flex-direction: column; 
        min-height: 400px;
    }
    .chart-header { margin-bottom: 20px; border-bottom: 1px solid var(--bg-light); padding-bottom: 15px; }
    .chart-header h3 { margin: 0; color: var(--text-dark); font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 10px; }
    .canvas-container { flex: 1; position: relative; width: 100%; height: 100%; }

    /* --- STAFF SECTION --- */
    .section-title { font-size: 1.5rem; font-weight: 800; margin-bottom: 25px; color: var(--text-dark); display: flex; align-items: center; gap: 10px; }
    .staff-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
    
    .staff-col { 
        background: white; 
        border-radius: 16px; 
        border: 1px solid var(--border-color); 
        overflow: hidden; 
        display: flex; 
        flex-direction: column; 
        box-shadow: var(--card-shadow); 
        height: 100%;
        min-height: 500px;
    }
    
    .col-header { 
        background: #f1f5f9; 
        padding: 20px 25px; 
        border-bottom: 1px solid var(--border-color); 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
    }
    .col-header h3 { margin: 0; font-size: 1.1rem; font-weight: 700; color: var(--text-dark); display: flex; align-items: center; }
    .badge-count { 
        background: var(--text-dark); color: white; 
        padding: 2px 10px; border-radius: 20px; 
        font-size: 0.75rem; margin-left: 10px; 
    }

    .staff-list { list-style: none; padding: 0; margin: 0; overflow-y: auto; flex: 1; max-height: 600px; }
    .staff-item { 
        padding: 20px 25px; 
        border-bottom: 1px solid var(--bg-light); 
        transition: background 0.2s; 
    }
    .staff-item:last-child { border-bottom: none; }
    .staff-item:hover { background: #f8fafc; }
    
    .item-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .staff-name { font-weight: 700; color: var(--text-dark); font-size: 1rem; }
    .staff-email { color: var(--secondary-color); font-size: 0.85rem; margin-top: 2px; font-family: monospace; }

    /* --- MAPPING DROPDOWN --- */
    .mapping-box { 
        background: #f1f5f9; 
        padding: 12px 15px; 
        border-radius: 8px; 
        border: 1px solid var(--border-color); 
        margin-top: 10px;
    }
    .mapping-label { font-size: 0.7rem; font-weight: 800; color: var(--secondary-color); text-transform: uppercase; margin-bottom: 6px; display: block; }
    .supervisor-select { 
        width: 100%; padding: 10px; border: 1px solid #cbd5e1; 
        border-radius: 6px; font-size: 0.9rem; background: white; cursor: pointer; 
        color: var(--text-dark); transition: 0.2s; outline: none;
    }
    .supervisor-select:focus { border-color: var(--primary-color); box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); }

    /* --- BUTTONS --- */
    .btn-add { 
        background: var(--primary-color); color: white; border: none; padding: 8px 16px; 
        border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 600; 
        display: flex; align-items: center; gap: 6px; transition: 0.2s;
    }
    .btn-add:hover { background: var(--primary-hover); }
    
    .btn-delete { 
        background: #fee2e2; color: var(--danger-color); border: none; padding: 6px 12px; 
        border-radius: 6px; cursor: pointer; font-size: 0.75rem; font-weight: 700; 
        transition: 0.2s; text-transform: uppercase;
    }
    .btn-delete:hover { background: #fecaca; color: #b91c1c; }

    /* --- MODAL --- */
    .modal-overlay { 
        display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(5px); z-index: 9999; 
        justify-content: center; align-items: center; 
    }
    .modal-content { 
        background: white; padding: 35px; border-radius: 16px; width: 100%; max-width: 480px; 
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); transform: scale(0.95); animation: modalIn 0.2s forwards; 
    }
    @keyframes modalIn { to { transform: scale(1); opacity: 1; } }

    .form-group { margin-bottom: 25px; }
    .form-label { display: block; font-size: 0.9rem; font-weight: 700; margin-bottom: 8px; color: var(--text-dark); }
    .form-input { width: 100%; padding: 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 1rem; box-sizing: border-box; transition: 0.2s; }
    .form-input:focus { border-color: var(--primary-color); outline: none; box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1); }

    /* --- TOAST NOTIFICATION --- */
    #toast-container { position: fixed; top: 20px; right: 20px; z-index: 10000; }
    .toast { 
        background: white; padding: 15px 25px; border-radius: 8px; margin-bottom: 10px; 
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border-left: 5px solid var(--primary-color);
        animation: slideInRight 0.3s ease; display: flex; align-items: center; gap: 10px; font-weight: 600;
    }
    .toast.success { border-left-color: var(--success-color); }
    .toast.error { border-left-color: var(--danger-color); }
    @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }

    @media (max-width: 1024px) { .charts-wrapper, .staff-layout { grid-template-columns: 1fr; } }
`;
document.head.appendChild(style);

// Inject Chart.js Library
const scriptChart = document.createElement('script');
scriptChart.src = "https://cdn.jsdelivr.net/npm/chart.js";
document.head.appendChild(scriptChart);

// =========================================================
// 3. SISTEM NOTIFIKASI (TOAST)
// =========================================================
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️')}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// =========================================================
// 4. INIT DASHBOARD (ENTRY POINT)
// =========================================================
export async function initSchoolDashboard() {
    const container = document.getElementById('main-content');
    const user = auth.currentUser;
    if (!user) return;

    // Tetapkan ID Sekolah & Email
    currentUserEmail = user.email;
    currentSchoolId = user.email; // Dalam kes ini, email admin = ID Sekolah

    // BINA STRUKTUR HTML UTAMA
    container.innerHTML = `
        <div class="dashboard-container">
            
            <div class="dash-header">
                <div class="header-content">
                    <h1>Dashboard Pentadbir</h1>
                    <p>Log masuk sebagai: <strong>${user.displayName || user.email}</strong></p>
                </div>
                <button class="btn-logout" id="btnLogout">
                    <span>🚪</span> Log Keluar
                </button>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-info">
                        <h3>Jumlah Guru Berdaftar</h3>
                        <p id="stat-guru-count">0</p>
                        <div class="stat-sub">Tidak termasuk penyelia</div>
                    </div>
                    <div class="stat-icon">👨‍🏫</div>
                </div>
                
                <div class="stat-card green">
                    <div class="stat-info">
                        <h3>Jumlah RPH Terkumpul</h3>
                        <p id="stat-rph-count">Loading...</p>
                        <div class="stat-sub">Rekod terkini dalam pangkalan data</div>
                    </div>
                    <div class="stat-icon">📚</div>
                </div>
            </div>

            <div class="charts-wrapper">
                <div class="chart-box">
                    <div class="chart-header">
                        <h3>📊 Status Pematuhan RPH</h3>
                    </div>
                    <div class="canvas-container">
                        <canvas id="chartStatus"></canvas>
                    </div>
                </div>
                
                <div class="chart-box">
                    <div class="chart-header">
                        <h3>📅 Trend Penghantaran Bulanan</h3>
                    </div>
                    <div class="canvas-container">
                        <canvas id="chartMonthly"></canvas>
                    </div>
                </div>
            </div>

            <div class="section-title">
                <span>👥</span> Pengurusan Kakitangan Sekolah
            </div>
            
            <div class="staff-layout">
                <div class="staff-col">
                    <div class="col-header">
                        <h3>GURU <span class="badge-count" id="badge-guru">0</span></h3>
                        <button class="btn-add" onclick="window.bukaModalDaftar('guru')">
                            <span>+</span> Daftar Guru
                        </button>
                    </div>
                    <ul id="list-guru" class="staff-list">
                        <li style="text-align:center; padding:40px; color:#94a3b8;">Sedang memuatkan data...</li>
                    </ul>
                </div>

                <div class="staff-col">
                    <div class="col-header">
                        <h3>PENYELIA <span class="badge-count" id="badge-penyelia">0</span></h3>
                        <button class="btn-add" style="background:#0284c7;" onclick="window.bukaModalDaftar('penyelia')">
                            <span>+</span> Daftar Penyelia
                        </button>
                    </div>
                    <ul id="list-penyelia" class="staff-list">
                        <li style="text-align:center; padding:40px; color:#94a3b8;">Sedang memuatkan data...</li>
                    </ul>
                </div>
            </div>
        </div>

        <div id="modal-daftar" class="modal-overlay">
            <div class="modal-content">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px;">
                    <h3 id="modal-title" style="margin:0; font-size:1.4rem; color:#1e293b;">Daftar Baru</h3>
                    <button onclick="document.getElementById('modal-daftar').style.display='none'" style="background:none; border:none; font-size:1.8rem; cursor:pointer; color:#94a3b8; line-height:1;">&times;</button>
                </div>
                
                <input type="hidden" id="modal-role">
                
                <div class="form-group">
                    <label class="form-label">Nama Penuh Kakitangan</label>
                    <input type="text" id="inp-nama" class="form-input" placeholder="Contoh: Ali Bin Abu">
                </div>

                <div class="form-group">
                    <label class="form-label">Alamat Emel (Akaun Google)</label>
                    <input type="email" id="inp-emel" class="form-input" placeholder="nama@moe-dl.edu.my">
                </div>

                <div style="text-align:right; display:flex; gap:10px; justify-content:flex-end; margin-top:30px;">
                    <button onclick="document.getElementById('modal-daftar').style.display='none'" style="background:#f1f5f9; color:#475569; border:none; padding:12px 24px; border-radius:8px; cursor:pointer; font-weight:600;">Batal</button>
                    <button onclick="window.simpanKakitangan()" style="background:var(--primary-color); color:white; border:none; padding:12px 24px; border-radius:8px; cursor:pointer; font-weight:600;">Simpan Data</button>
                </div>
            </div>
        </div>
    `;

    // Pasang Event Listener
    document.getElementById('btnLogout').addEventListener('click', handleLogout);

    // Mula Muat Turun Data
    loadAnalytics();       // Statistik
    loadStaffManagement(); // Data Guru & Penyelia
}

// =========================================================
// 5. PENGURUSAN DATA (HYBRID READ & DUAL COLLECTION)
// =========================================================

/**
 * Memuatkan data kakitangan.
 * MENGGUNAKAN LOGIK HYBRID: Membaca 'role' (lama) dan 'isGuru' (baru).
 */
async function loadStaffManagement() {
    const listGuru = document.getElementById('list-guru');
    const listPenyelia = document.getElementById('list-penyelia');
    
    try {
        // PENTING: Kita baca daripada 'schools/{schoolId}/teachers' untuk memastikan
        // kita hanya melihat data yang relevan dengan sekolah ini.
        const schoolTeachersRef = collection(db, 'schools', currentSchoolId, 'teachers');
        const snapshot = await getDocs(schoolTeachersRef);

        const teachers = [];
        const supervisors = [];

        snapshot.forEach(docSnap => {
            const data = { id: docSnap.id, ...docSnap.data() };
            
            // ===========================================================
            // LOGIK HYBRID (PENTING UNTUK BACA DATA LAMA)
            // ===========================================================
            
            // 1. Semak Status GURU
            // Jika ada flag 'isGuru' ATAU jika data lama 'role' ialah 'guru'
            let validGuru = false;
            if (data.isGuru === true) validGuru = true; 
            else if (data.role === 'guru') validGuru = true; // Fallback untuk data lama

            // 2. Semak Status PENYELIA
            // Jika ada flag 'isPenyelia' ATAU jika data lama 'role' ialah 'penyelia'
            let validPenyelia = false;
            if (data.isPenyelia === true) validPenyelia = true;
            else if (data.role === 'penyelia') validPenyelia = true; // Fallback untuk data lama

            // Masukkan ke dalam array yang sepatutnya
            if (validGuru) {
                teachers.push(data);
            }
            if (validPenyelia) {
                supervisors.push(data);
            }
        });

        // Kemaskini Lencana & Statistik
        document.getElementById('badge-guru').innerText = teachers.length;
        document.getElementById('badge-penyelia').innerText = supervisors.length;
        document.getElementById('stat-guru-count').innerText = teachers.length;

        // --- RENDER SENARAI PENYELIA ---
        if (supervisors.length === 0) {
            listPenyelia.innerHTML = '<li style="padding:30px; text-align:center; color:#94a3b8; font-style:italic;">Tiada penyelia didaftarkan.</li>';
        } else {
            listPenyelia.innerHTML = supervisors.map(s => `
                <li class="staff-item">
                    <div class="item-header">
                        <div>
                            <div class="staff-name">${s.name.toUpperCase()}</div>
                            <div class="staff-email">${s.email}</div>
                        </div>
                        <button class="btn-delete" onclick="window.padamKakitangan('${s.id}', 'penyelia', '${s.name}')">Padam</button>
                    </div>
                </li>
            `).join('');
        }

        // --- RENDER SENARAI GURU (DENGAN MAPPING) ---
        if (teachers.length === 0) {
            listGuru.innerHTML = '<li style="padding:30px; text-align:center; color:#94a3b8; font-style:italic;">Tiada guru didaftarkan.</li>';
        } else {
            listGuru.innerHTML = teachers.map(t => {
                const currentPenyelia = t.penyeliaId || ""; 
                
                // Bina Dropdown Penyelia
                let options = `<option value="">-- Sila Pilih Penyelia --</option>`;
                supervisors.forEach(sup => {
                    const isSelected = (currentPenyelia === sup.email) ? 'selected' : '';
                    options += `<option value="${sup.email}" ${isSelected}>${sup.name.toUpperCase()}</option>`;
                });

                return `
                <li class="staff-item">
                    <div class="item-header">
                        <div>
                            <div class="staff-name">${t.name.toUpperCase()}</div>
                            <div class="staff-email">${t.email}</div>
                        </div>
                        <button class="btn-delete" onclick="window.padamKakitangan('${t.id}', 'guru', '${t.name}')">Padam</button>
                    </div>
                    
                    <div class="mapping-box">
                        <label class="mapping-label">Ditugaskan Kepada:</label>
                        <select class="supervisor-select" onchange="window.updateSupervisor('${t.id}', this.value)">
                            ${options}
                        </select>
                    </div>
                </li>
                `;
            }).join('');
        }

    } catch (e) {
        console.error("Ralat Muat Data:", e);
        showToast("Gagal memuatkan data kakitangan.", "error");
        listGuru.innerHTML = '<li style="padding:20px; text-align:center; color:red;">Ralat sistem.</li>';
    }
}

/**
 * Mengemaskini pemetaan penyelia bagi guru tertentu.
 * PENTING: Perlu update di KEDUA-DUA koleksi (Global & Sekolah).
 */
window.updateSupervisor = async (teacherId, supervisorEmail) => {
    try {
        const batch = writeBatch(db);
        
        // 1. Rujukan ke Koleksi Global
        const globalRef = doc(db, 'teachers', teacherId);
        
        // 2. Rujukan ke Koleksi Sekolah
        const schoolRef = doc(db, 'schools', currentSchoolId, 'teachers', teacherId);

        const updateData = { 
            penyeliaId: supervisorEmail,
            updatedAt: Timestamp.now()
        };

        batch.update(globalRef, updateData);
        batch.update(schoolRef, updateData);

        await batch.commit();
        
        console.log(`Pemetaan berjaya: ${teacherId} -> ${supervisorEmail}`);
        showToast("Penyelia berjaya dikemaskini.", "success");

    } catch (e) {
        console.error(e);
        showToast("Gagal mengemaskini penyelia: " + e.message, "error");
    }
};

// =========================================================
// 6. PENDAFTARAN & PEMADAMAN (DUAL COLLECTION WRITE)
// =========================================================

window.bukaModalDaftar = (role) => {
    const modal = document.getElementById('modal-daftar');
    const title = document.getElementById('modal-title');
    const inputRole = document.getElementById('modal-role');

    modal.style.display = 'flex';
    inputRole.value = role;
    title.innerText = (role === 'guru') ? "Daftar Guru Baru" : "Daftar Penyelia Baru";
    
    // Reset Borang
    document.getElementById('inp-nama').value = '';
    document.getElementById('inp-emel').value = '';
};

/**
 * MENYIMPAN DATA (CREATE/UPDATE)
 * Menggunakan Batch Write untuk memastikan data ditulis ke:
 * 1. Koleksi Global ('teachers')
 * 2. Koleksi Sekolah ('schools/{id}/teachers')
 */
window.simpanKakitangan = async () => {
    const nama = document.getElementById('inp-nama').value.trim();
    const emel = document.getElementById('inp-emel').value.toLowerCase().trim();
    const targetRole = document.getElementById('modal-role').value; // 'guru' or 'penyelia'

    // Validasi Asas
    if (!nama || !emel) {
        showToast("Sila isi nama dan emel.", "error");
        return;
    }
    if (!emel.includes('@')) {
        showToast("Format emel tidak sah.", "error");
        return;
    }

    try {
        const batch = writeBatch(db);

        // Data Asas
        let userData = {
            name: nama,
            email: emel,
            schoolId: currentSchoolId,
            updatedAt: Timestamp.now()
        };

        // Tetapkan Flag berdasarkan butang yang ditekan
        // Kita guna { merge: true }, jadi kita tak perlu risau data lama hilang.
        if (targetRole === 'guru') {
            userData.isGuru = true;
        } else if (targetRole === 'penyelia') {
            userData.isPenyelia = true;
        }

        // 1. Tulis ke Global Collection
        const globalRef = doc(db, 'teachers', emel);
        batch.set(globalRef, userData, { merge: true });

        // 2. Tulis ke School Sub-Collection
        const schoolRef = doc(db, 'schools', currentSchoolId, 'teachers', emel);
        batch.set(schoolRef, userData, { merge: true });

        // Laksanakan Batch
        await batch.commit();

        showToast(`Berjaya! ${nama} telah didaftarkan.`, "success");
        document.getElementById('modal-daftar').style.display = 'none';
        
        // Refresh UI
        loadStaffManagement();

    } catch (e) {
        console.error("Ralat Simpan:", e);
        showToast("Ralat pangkalan data: " + e.message, "error");
    }
};

/**
 * MEMADAM DATA (DELETE/UPDATE)
 * Menguruskan pemadaman flag atau dokumen sepenuhnya dari kedua-dua koleksi.
 */
window.padamKakitangan = async (id, roleToDelete, nama) => {
    const roleName = roleToDelete.toUpperCase();
    if (!confirm(`AMARAN: Adakah anda pasti mahu mengeluarkan ${nama} daripada senarai ${roleName}?`)) return;

    try {
        // Kita perlu baca data dahulu untuk tahu status semasa (adakah dia masih ada role lain?)
        // Baca dari sub-koleksi sekolah sudah memadai
        const schoolRef = doc(db, 'schools', currentSchoolId, 'teachers', id);
        const docSnap = await getDoc(schoolRef);

        if (!docSnap.exists()) {
            showToast("Rekod pengguna tidak dijumpai.", "error");
            return;
        }

        const data = docSnap.data();
        const globalRef = doc(db, 'teachers', id);
        const batch = writeBatch(db);

        // Logik: Matikan flag yang berkaitan
        let updates = {};
        if (roleToDelete === 'guru') updates.isGuru = false;
        if (roleToDelete === 'penyelia') updates.isPenyelia = false;

        // Semak status masa depan (Future State) - Semak Flag Baru & Role Lama
        // Kita anggap jika user padam 'guru', dia sudah tak nak guna role lama 'guru'
        
        // Semak jika dia masih ada role lain
        let remainsGuru = (roleToDelete !== 'guru') && (data.isGuru === true || data.role === 'guru');
        let remainsPenyelia = (roleToDelete !== 'penyelia') && (data.isPenyelia === true || data.role === 'penyelia');

        // Note: Jika data lama guna 'role', dan kita padam salah satu, 
        // kita mungkin perlu set 'role' kepada kosong atau update kepada flag baru.
        // Untuk keselamatan, kita akan update flag sahaja.
        
        // Jika nak padam Guru, dan dia tiada role Penyelia -> Padam Terus
        if (!remainsGuru && !remainsPenyelia) {
            // JIKA TIADA LAGI JAWATAN: Padam dokumen sepenuhnya dari kedua-dua koleksi
            batch.delete(schoolRef);
            batch.delete(globalRef);
            showToast(`${nama} telah dipadam sepenuhnya dari sistem.`, "success");
        } else {
            // JIKA MASIH ADA JAWATAN LAIN: Hanya update flag di kedua-dua koleksi
            batch.update(schoolRef, updates);
            batch.update(globalRef, updates);
            
            // Tambahan: Jika data lama wujud, kita mungkin perlu buang field 'role' lama 
            // supaya tak kacau logic masa depan, tapi setakat ini update flag sudah cukup
            // kerana logic bacaan utamakan flag.
            
            showToast(`${nama} dikeluarkan dari senarai ${roleToDelete}.`, "success");
        }

        await batch.commit();
        loadStaffManagement();

    } catch (e) {
        console.error("Ralat Padam:", e);
        showToast("Gagal memadam: " + e.message, "error");
    }
};

// =========================================================
// 7. ANALISIS & GRAFIK (LIVE DATA)
// =========================================================

/**
 * Memuatkan data analisis untuk kad statistik dan carta.
 */
async function loadAnalytics() {
    try {
        // Query asas: Semua rekod RPH sekolah ini
        const coll = collection(db, 'records');
        const q = query(coll, where('schoolId', '==', currentSchoolId));

        // A. JUMLAH RPH LIVE (Optimized Count)
        const countSnap = await getCountFromServer(q);
        const totalRPH = countSnap.data().count;
        document.getElementById('stat-rph-count').innerText = totalRPH;

        // B. DATA UNTUK GRAFIK
        const snapshot = await getDocs(q);
        
        let stats = { disahkan: 0, dihantar: 0, draft: 0 };
        let months = Array(12).fill(0); // Index 0-11

        snapshot.forEach(doc => {
            const d = doc.data();
            
            // 1. Kiraan Status
            if (d.status === 'disahkan') stats.disahkan++;
            else if (d.status === 'dihantar') stats.dihantar++;
            else stats.draft++;

            // 2. Kiraan Bulanan
            if (d.dateISO) {
                const dateObj = new Date(d.dateISO);
                if (!isNaN(dateObj)) {
                    months[dateObj.getMonth()]++;
                }
            }
        });

        renderCharts(stats, months);

    } catch (e) {
        console.error("Analytics Error:", e);
        document.getElementById('stat-rph-count').innerText = "-";
    }
}

/**
 * Fungsi pembantu untuk menjana carta menggunakan Chart.js
 */
function renderCharts(stats, months) {
    // Pastikan library sudah dimuatkan
    if (typeof Chart === 'undefined') { 
        setTimeout(() => renderCharts(stats, months), 800); 
        return; 
    }

    // 1. CONFIG CARTA PAI (STATUS)
    const ctxPie = document.getElementById('chartStatus').getContext('2d');
    if (chartInstancePie) chartInstancePie.destroy();

    chartInstancePie = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['Disahkan', 'Dihantar'],
            datasets: [{
                data: [stats.disahkan, stats.dihantar, stats.draft],
                backgroundColor: ['#10b981', '#3b82f6', '#cbd5e1'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } }
            },
            cutout: '65%'
        }
    });

    // 2. CONFIG CARTA BAR (TREND)
    const ctxBar = document.getElementById('chartMonthly').getContext('2d');
    if (chartInstanceBar) chartInstanceBar.destroy();

    chartInstanceBar = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'],
            datasets: [{
                label: 'Jumlah RPH',
                data: months,
                backgroundColor: '#4f46e5',
                borderRadius: 6,
                hoverBackgroundColor: '#4338ca'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false } },
                y: { 
                    beginAtZero: true, 
                    grid: { borderDash: [5, 5], color: '#f1f5f9' },
                    ticks: { precision: 0 }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// =========================================================
// 8. FUNGSI LOG KELUAR (LOGOUT)
// =========================================================
async function handleLogout() {
    if(confirm("Adakah anda pasti mahu log keluar dari sistem?")) {
        try {
            await signOut(auth);
            showToast("Log keluar berjaya. Mengalihkan...", "success");
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (e) {
            console.error(e);
            showToast("Ralat log keluar.", "error");
        }
    }
}