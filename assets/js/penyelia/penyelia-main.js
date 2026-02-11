/**
 * ==========================================================================================
 * MODUL UTAMA: DASHBOARD PENYELIA (VERSI LENGKAP)
 * ==========================================================================================
 * Fail: assets/js/penyelia/penyelia-main.js
 * * FUNGSI:
 * 1. Memaparkan papan pemuka (Dashboard) dengan statistik masa nyata.
 * 2. Mengambil senarai nama guru dari database untuk menggantikan paparan emel.
 * 3. Menghubungkan modul semakan (penyelia-semak.js) dengan UI utama.
 * 4. Menyediakan analisis ringkas aktiviti guru di bawah seliaan.
 * ==========================================================================================
 */

import { auth, db } from '../config.js'; 
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    getDoc, 
    orderBy, 
    limit 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// IMPORT MODUL SEMAKAN
import { initSemakRPH, loadSemakList } from './penyelia-semak.js';

// GLOBAL CACHE UNTUK NAMA GURU
// Kita simpan mapping "email -> nama" di sini supaya boleh diakses oleh fail semakan juga.
window.teacherMap = {}; 

// ==========================================================================================
// 1. FUNGSI UTILITI (LOGOUT & NAVIGASI)
// ==========================================================================================

window.keluarSistem = async () => {
    if (confirm("Adakah anda pasti mahu log keluar dari Sistem eRPH?")) {
        try {
            await signOut(auth);
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
        } catch (error) {
            console.error("Ralat Log Keluar:", error);
            alert("Ralat sistem: " + error.message);
        }
    }
};

window.tukarKeModGuru = function() {
    const msg = "Anda akan beralih ke paparan Guru untuk membina RPH anda sendiri.\n\nKlik OK untuk teruskan.";
    if(confirm(msg)) {
        sessionStorage.setItem('tempViewMode', 'guru');
        window.location.reload(); 
    }
};

// ==========================================================================================
// 2. FUNGSI UTAMA: MEMUATKAN DASHBOARD
// ==========================================================================================

export async function loadPenyeliaDashboard() {
    const container = document.getElementById('main-content');
    if (!container) return;

    // Paparan Loading Awal
    container.innerHTML = `
        <div style="display:flex; height:80vh; justify-content:center; align-items:center; flex-direction:column;">
            <div style="width:40px; height:40px; border:4px solid #f3f3f3; border-top:4px solid #4f46e5; border-radius:50%; animation:spin 1s linear infinite;"></div>
            <p style="margin-top:15px; color:#64748b; font-weight:500;">Memuatkan Profil Penyelia & Data Guru...</p>
            <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
        </div>
    `;

    const user = auth.currentUser;
    if(!user) { window.location.reload(); return; }
    const userEmail = user.email.toLowerCase();

	window.refreshDashboardPenyelia = loadPenyeliaDashboard;

    // ----------------------------------------------------------------------
    // LANGKAH A: DAPATKAN MAKLUMAT PENYELIA, SEKOLAH & SENARAI GURU
    // ----------------------------------------------------------------------
    let penyeliaName = "Penyelia";
    let schoolName = "Maklumat Sekolah Tidak Dijumpai";
    let schoolId = null;

    try {
        // 1. Cari profil penyelia
        const qP = query(collection(db, 'teachers'), where('email', '==', userEmail));
        let pSnap = await getDocs(qP);

        if(!pSnap.empty) {
            const pData = pSnap.docs[0].data();
            penyeliaName = pData.name || pData.userName || "Penyelia Bertugas";
            schoolId = pData.schoolId;

            // 2. Jika ada School ID, tarik nama sekolah & senarai guru
            if (schoolId) {
                const sDoc = await getDoc(doc(db, 'schools', schoolId));
                if (sDoc.exists()) {
                    schoolName = sDoc.data().schoolName || "Sekolah Tanpa Nama";
                }

                // 3. PEMBAIKAN UTAMA: Tarik semua guru di sekolah ini untuk mapping nama
                // Ini menyelesaikan masalah paparan "hanya email"
                const qTeachers = query(collection(db, 'schools', schoolId, 'teachers')); 
                const tSnap = await getDocs(qTeachers);
                
                // Jika kosong, cuba collection group (backup plan)
                if (tSnap.empty) {
                     const qGroup = query(collection(db, 'teachers'), where('schoolId', '==', schoolId));
                     const tGroupSnap = await getDocs(qGroup);
                     tGroupSnap.forEach(t => {
                        const td = t.data();
                        if(td.email) window.teacherMap[td.email.toLowerCase()] = td.name || td.email;
                     });
                } else {
                    tSnap.forEach(t => {
                        const td = t.data();
                        if(td.email) window.teacherMap[td.email.toLowerCase()] = td.name || td.email;
                    });
                }
                
                console.log("Teacher Map Loaded:", window.teacherMap); // Debugging
            }
        }
    } catch(e) { 
        console.warn("Amaran Profil:", e);
        penyeliaName = user.displayName || "Penyelia";
    }

    // ----------------------------------------------------------------------
    // LANGKAH B: BINA ANTARAMUKA (UI) DASHBOARD
    // ----------------------------------------------------------------------
    container.innerHTML = `
        <style>
            .dashboard-container { padding: 30px; max-width: 1400px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; }
            .header-box { display: flex; justify-content: space-between; align-items: center; margin-bottom: 35px; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
            .user-info h1 { margin: 0; font-size: 1.5rem; color: #1e293b; }
            .user-info p { margin: 5px 0 0; color: #64748b; font-size: 0.9rem; }
            .btn-nav { padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; transition: 0.2s; font-size: 0.9rem; }
            .btn-blue { background: #e0e7ff; color: #4338ca; }
            .btn-red { background: #fee2e2; color: #991b1b; }
            
            .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; margin-bottom: 35px; }
            .stat-card { background: white; padding: 25px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); transition: transform 0.2s; }
            .stat-card:hover { transform: translateY(-3px); }
            .stat-title { font-size: 0.85rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; }
            .stat-value { font-size: 2.8rem; font-weight: 800; color: #0f172a; line-height: 1; }
            .stat-desc { margin-top: 10px; font-size: 0.85rem; color: #4f46e5; font-weight: 600; cursor: pointer; }
            
            .table-section { background: white; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e2e8f0; }
            .table-header { padding: 20px 25px; border-bottom: 1px solid #f1f5f9; background: #f8fafc; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; padding: 15px 25px; font-size: 0.75rem; color: #64748b; text-transform: uppercase; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
            td { padding: 16px 25px; border-bottom: 1px solid #f1f5f9; color: #334155; font-size: 0.9rem; }
            
            .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; }
            .bg-pending { background: #fff7ed; color: #c2410c; }
            .bg-success { background: #f0fdf4; color: #15803d; }
        </style>

        <div class="dashboard-container">
            <div class="header-box">
                <div class="user-info">
                    <h1>${penyeliaName}</h1>
                    <p>🏫 ${schoolName}</p>
                </div>
                <div style="display:flex; gap:10px;">
                    <button onclick="window.tukarKeModGuru()" class="btn-nav btn-blue">Mod Guru</button>
                    <button onclick="window.keluarSistem()" class="btn-nav btn-red">Log Keluar</button>
                </div>
            </div>

            <div id="view-dashboard-overview">
                <div class="stats-grid">
                    <div class="stat-card" id="card-trigger-semak" style="border-left: 5px solid #f59e0b; cursor: pointer;">
                        <div class="stat-title">Menunggu Semakan</div>
                        <div class="stat-value" id="stat-pending">0</div>
                        <div class="stat-desc">Klik untuk proses semakan →</div>
                    </div>
                    <div class="stat-card" style="border-left: 5px solid #10b981;">
                        <div class="stat-title">RPH Disahkan (Bulan Ini)</div>
                        <div class="stat-value" id="stat-approved">0</div>
                        <div class="stat-desc" style="color:#64748b;">Rekod prestasi semasa</div>
                    </div>
                </div>

                <div class="table-section">
                    <div class="table-header">
                        <h3 style="margin:0;">📋 Aktiviti Penghantaran Terkini</h3>
                    </div>
                    <div style="overflow-x:auto;">
                        <table id="table-analisis">
                            <thead>
                                <tr>
                                    <th>Nama Guru</th>
                                    <th>Mata Pelajaran</th>
                                    <th>Status</th>
                                    <th>Tarikh</th>
                                </tr>
                            </thead>
                            <tbody id="tbodyAnalisis">
                                <tr><td colspan="4" style="text-align:center; padding:30px; color:#94a3b8;">Sedang memuatkan data...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div id="view-semakan-rph" style="display:none; animation: fadeIn 0.3s;"></div>
            <style>@keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }</style>
        </div>
    `;

    // ----------------------------------------------------------------------
    // LANGKAH C: EVENT LISTENERS
    // ----------------------------------------------------------------------
    const cardSemak = document.getElementById('card-trigger-semak');
    if(cardSemak) {
        cardSemak.onclick = () => {
            tukarKeModSemakan();
        };
    }

    // ----------------------------------------------------------------------
    // LANGKAH D: TARIK DATA STATISTIK
    // ----------------------------------------------------------------------
    await fetchStatsAndAnalysis(userEmail);
}

// ==========================================================================================
// 3. FUNGSI LOGIK DATA & NAVIGASI
// ==========================================================================================

function tukarKeModSemakan() {
    const dashboard = document.getElementById('view-dashboard-overview');
    const semakan = document.getElementById('view-semakan-rph');

    if(dashboard && semakan) {
        dashboard.style.display = 'none';
        semakan.style.display = 'block';

        if (typeof initSemakRPH === 'function') {
            initSemakRPH();
            loadSemakList();
        } else {
            alert("Ralat: Modul semakan tidak dapat dimuatkan. Sila refresh.");
        }
    }
}

async function fetchStatsAndAnalysis(email) {
    try {
        const recordsRef = collection(db, 'records');

        // 1. Kira Pending
        const qPending = query(recordsRef, where('penyeliaId', '==', email), where('status', '==', 'dihantar'));
        const snapPending = await getDocs(qPending);
        document.getElementById('stat-pending').innerText = snapPending.size;

        // 2. Kira Approved
        const qApproved = query(recordsRef, where('penyeliaId', '==', email), where('status', '==', 'disahkan'));
        const snapApproved = await getDocs(qApproved);
        document.getElementById('stat-approved').innerText = snapApproved.size;

        // 3. Senarai Terkini
        const qList = query(
            recordsRef, 
            where('penyeliaId', '==', email), 
            orderBy('submittedAt', 'desc'), 
            limit(8)
        );
        const snapList = await getDocs(qList);
        
        const tbody = document.getElementById('tbodyAnalisis');
        let html = '';

        if (snapList.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px;">Tiada aktiviti RPH terkini.</td></tr>';
            return;
        }

        snapList.forEach(docSnap => {
            const data = docSnap.data();
            
            // --- LOGIK NAMA GURU (Guna Map jika ada, Fallback ke data RPH) ---
            let namaGuru = data.guruName || data.name || data.userName || data.email;
            if (data.email && window.teacherMap[data.email]) {
                namaGuru = window.teacherMap[data.email];
            }
            
            const badgeClass = data.status === 'disahkan' ? 'status-badge bg-success' : 'status-badge bg-pending';
            const displayDate = data.submittedAt ? data.submittedAt.toDate().toLocaleDateString('ms-MY') : '-';

            html += `
                <tr style="transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="font-weight:600; color:#1e293b;">${namaGuru.toUpperCase()}</td>
                    <td>${data.subject || 'Tiada Subjek'}</td>
                    <td><span class="${badgeClass}">${data.status.toUpperCase()}</span></td>
                    <td style="color:#64748b;">${displayDate}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

    } catch (e) {
        console.error("Ralat Fetch Data:", e);
        const errEl = document.getElementById('tbodyAnalisis');
        if(errEl) errEl.innerHTML = '<tr><td colspan="4" style="color:red; text-align:center; padding:20px;">Gagal memuatkan data. Sila semak sambungan internet.</td></tr>';
    }
}