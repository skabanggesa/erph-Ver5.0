/**
 * ==========================================================================================
 * MODUL SEMAKAN RPH: LOGIK PENYELIA (VERSI PENUH & DIPERBAIKI)
 * ==========================================================================================
 * Fail: assets/js/penyelia/penyelia-semak.js
 * * FUNGSI UTAMA:
 * 1. Senarai RPH dengan FILTER (Nama, Subjek, Tarikh).
 * 2. Semakan Individu & Pukal (Bulk Approval).
 * 3. Tandatangan Digital (Canvas) & Ulasan Dinamik.
 * 4. MENYIMPAN NAMA PENYELIA (verifiedBy) untuk paparan guru.
 * 5. [FIX] Menggunakan 'penyeliaId' untuk padanan terus emel penyelia.
 * ==========================================================================================
 */

import { auth, db } from '../config.js';
import { 
    collection, query, where, getDocs, doc, updateDoc, getDoc, Timestamp, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================================================================================
// 1. VARIABLES & CONFIGURATION
// ==========================================================================================

let canvas, ctx, isDrawing = false;
let bulkCanvas, bulkCtx; 
let currentRphId = null;
let allPendingRPH = []; // Cache Data untuk filtering pantas
let currentPenyeliaName = "Penyelia"; // Default sementara loading

// Bank Ulasan untuk pilihan pantas
const ulasanBank = [
    "RPH disediakan dengan baik dan lengkap. Tahniah.",
    "Objektif pembelajaran jelas dan aktiviti sesuai dengan tahap murid.",
    "Persediaan mengajar yang sangat rapi. Teruskan kecemerlangan.",
    "Langkah pengajaran tersusun dan mudah difahami.",
    "Penggunaan BBM yang menarik dalam PdP membantu kefahaman murid.",
    "Refleksi ditulis dengan baik dan menunjukkan impak sebenar.",
    "Sangat baik. Pastikan kawalan kelas diutamakan semasa aktiviti.",
    "Disahkan. RPH mematuhi standard yang ditetapkan."
];

// ==========================================================================================
// 2. INJECT CSS (GAYA UI)
// ==========================================================================================
// Menyuntik CSS secara dinamik untuk memastikan layout kemas, responsif dan tidak bertindih.
const style = document.createElement('style');
style.innerHTML = `
    .semak-container { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #334155; max-width: 100%; margin: 0 auto; }
    
    /* FILTER SECTION */
    .filter-box {
        background: #f8fafc; 
        padding: 25px; 
        border-radius: 12px; 
        border: 1px solid #e2e8f0; 
        margin-bottom: 25px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .filter-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        align-items: end;
    }
    .filter-group label {
        display: block;
        font-size: 0.85rem;
        font-weight: 600;
        color: #64748b;
        margin-bottom: 8px;
    }
    .filter-input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: white;
        box-sizing: border-box;
        outline: none;
        transition: all 0.2s;
        font-size: 0.9rem;
    }
    .filter-input:focus { 
        border-color: #4f46e5; 
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); 
    }
    
    /* TABLE STYLES */
    .table-responsive {
        overflow-x: auto;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        background: white;
    }
    .table-semak { width: 100%; border-collapse: collapse; }
    .table-semak th { 
        background: #f1f5f9; 
        padding: 15px; 
        text-align: left; 
        font-size: 0.85rem; 
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 700;
        color: #475569; 
        white-space: nowrap;
        border-bottom: 2px solid #e2e8f0;
    }
    .table-semak td { 
        padding: 15px; 
        border-bottom: 1px solid #f1f5f9; 
        font-size: 0.95rem; 
        vertical-align: middle; 
    }
    .row-hover:hover { background: #f8fafc; transition: background 0.15s ease; }

    /* STATUS BADGES */
    .badge { padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; display: inline-block; }
    .badge-hantar { background: #e0f2fe; color: #0284c7; }
    
    /* BUTTONS */
    .btn-semak { 
        background: #4f46e5; 
        color: white; 
        border: none; 
        padding: 8px 16px; 
        border-radius: 6px; 
        cursor: pointer; 
        font-weight: 500; 
        font-size: 0.9rem; 
        white-space: nowrap;
        transition: background 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 5px;
    }
    .btn-semak:hover { background: #4338ca; }
    
    .btn-reset { 
        width: 100%; 
        padding: 10px; 
        background: white; 
        border: 1px solid #cbd5e1; 
        color: #475569; 
        border-radius: 8px; 
        cursor: pointer; 
        font-weight: 600;
        transition: background 0.2s;
    }
    .btn-reset:hover { background: #f1f5f9; border-color: #94a3b8; }
    
    /* MODAL */
    .modal-overlay { 
        position: fixed; 
        top: 0; left: 0; 
        width: 100%; height: 100%; 
        background: rgba(15, 23, 42, 0.6); 
        backdrop-filter: blur(4px);
        z-index: 9999; 
        display: flex; 
        justify-content: center; 
        align-items: center; 
        padding: 20px; 
        box-sizing: border-box; 
    }
    .modal-content { 
        background: white; 
        padding: 30px; 
        border-radius: 16px; 
        width: 100%; 
        max-width: 550px; 
        max-height: 90vh; 
        overflow-y: auto; 
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); 
        position: relative;
        animation: modalFadeIn 0.3s ease-out;
    }
    @keyframes modalFadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }

    /* RPH VIEWER STYLES */
    .rph-section { margin-bottom: 25px; }
    .rph-label { 
        font-size: 0.85rem; 
        text-transform: uppercase; 
        color: #64748b; 
        font-weight: 700; 
        margin-bottom: 8px; 
        display: block;
    }
    .rph-value {
        background: #f8fafc;
        padding: 15px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        line-height: 1.6;
        color: #334155;
    }
`;
document.head.appendChild(style);

// ==========================================================================================
// 3. INIT SEMAKAN (HTML STRUKTUR)
// ==========================================================================================

export function initSemakRPH() {
    const container = document.getElementById('view-semakan-rph');
    if(!container) return;
    
    // 1. DAPATKAN NAMA PENYELIA SEBELUM MULA (PENTING)
    fetchPenyeliaProfile();

    container.innerHTML = `
        <div class="semak-container">
            <div id="semak-list-mode" style="background:white; border-radius:16px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05); padding:30px;">
                
                <div style="display:flex; flex-wrap:wrap; gap:15px; justify-content:space-between; align-items:center; margin-bottom:25px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px;">
                    <div>
                        <h2 style="margin:0; color:#1e293b; font-size:1.5rem; display:flex; align-items:center; gap:10px;">
                            📋 Semakan RPH Guru
                        </h2>
                        <p style="margin:5px 0 0; color:#64748b; font-size:0.9rem;" id="lblPenyeliaName">
                            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Memuatkan profil penyelia...
                        </p>
                    </div>
                    <button id="btnBulkApprove" style="display:none; background:#059669; color:white; padding:10px 24px; border:none; border-radius:8px; font-weight:bold; cursor:pointer; box-shadow:0 4px 6px rgba(5, 150, 105, 0.2); transition:0.2s; align-items:center; gap:8px;" onclick="window.bukaModalPukal()">
                        <span>✍️</span> Sahkan Pukal (<span id="countSelected">0</span>)
                    </button>
                </div>

                <div class="filter-box">
                    <div class="filter-grid">
                        <div class="filter-group">
                            <label>Cari Nama Guru</label>
                            <input type="text" id="f-nama" class="filter-input" placeholder="Contoh: Ahmad..." onkeyup="window.applyFilter()">
                        </div>
                        <div class="filter-group">
                            <label>Subjek</label>
                            <input type="text" id="f-subjek" class="filter-input" placeholder="Contoh: Matematik..." onkeyup="window.applyFilter()">
                        </div>
                        <div class="filter-group">
                            <label>Dari Tarikh</label>
                            <input type="date" id="f-mula" class="filter-input" onchange="window.applyFilter()">
                        </div>
                        <div class="filter-group">
                            <label>Hingga Tarikh</label>
                            <input type="date" id="f-tamat" class="filter-input" onchange="window.applyFilter()">
                        </div>
                        <div class="filter-group">
                            <label>&nbsp;</label>
                            <button onclick="window.resetFilter()" class="btn-reset">Reset Filter</button>
                        </div>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="table-semak">
                        <thead>
                            <tr>
                                <th style="width:50px; text-align:center;">
                                    <input type="checkbox" id="selectAll" onclick="window.toggleSelectAll(this)" style="transform:scale(1.2); cursor:pointer;">
                                </th>
                                <th>Nama Guru</th>
                                <th>Mata Pelajaran</th>
                                <th>Status</th>
                                <th>Tarikh Hantar</th>
                                <th style="text-align:center;">Tindakan</th>
                            </tr>
                        </thead>
                        <tbody id="tbodySemakList">
                            <tr>
                                <td colspan="6" style="text-align:center; padding:50px; color:#94a3b8;">
                                    <div style="display:inline-block; animation:spin 1s linear infinite; border:3px solid #cbd5e1; border-top:3px solid #4f46e5; border-radius:50%; width:24px; height:24px;"></div>
                                    <div style="margin-top:10px;">Sedang memuatkan senarai RPH...</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <div style="margin-top:25px; border-top:1px solid #f1f5f9; padding-top:20px;">
                    <button onclick="window.kembaliKeDashboard()" style="background:none; border:none; color:#64748b; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:8px; padding:8px 0;">
                        <span>←</span> Kembali ke Dashboard Utama
                    </button>
                </div>
            </div>

            <div id="semak-detail-mode" style="display:none;"></div>

            <div id="modal-bulk" class="modal-overlay" style="display:none;">
                <div class="modal-content">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:15px; margin-bottom:20px;">
                        <h3 style="margin:0; color:#1e293b;">Pengesahan Pukal</h3>
                        <button onclick="document.getElementById('modal-bulk').style.display='none'" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#94a3b8;">&times;</button>
                    </div>
                    
                    <p style="color:#64748b; font-size:0.95rem; margin-bottom:20px;">
                        Anda sedang mengesahkan <strong id="bulk-count-display" style="color:#4f46e5; font-size:1.1rem;">0</strong> RPH yang dipilih.
                    </p>
                    
                    <div style="background:#f8fafc; padding:20px; border-radius:10px; margin-bottom:20px; border:1px solid #e2e8f0;">
                        <label style="font-weight:600; display:block; margin-bottom:8px; color:#334155; font-size:0.9rem;">Pilih Templat Ulasan:</label>
                        <select onchange="document.getElementById('bulk-ulasan').value = this.value" class="filter-input" style="margin-bottom:15px; cursor:pointer;">
                            <option value="">-- Sila Pilih Ulasan --</option>
                            ${ulasanBank.map(u => `<option value="${u}">${u}</option>`).join('')}
                        </select>

                        <label style="font-weight:600; display:block; margin-bottom:8px; color:#334155; font-size:0.9rem;">Ulasan Akhir:</label>
                        <textarea id="bulk-ulasan" class="filter-input" style="height:80px; resize:vertical; font-family:inherit;">Disahkan. RPH mematuhi standard.</textarea>
                    </div>

                    <label style="font-weight:600; display:block; margin-bottom:8px; color:#334155;">Tandatangan:</label>
                    <div style="border:2px dashed #94a3b8; height:150px; background:white; position:relative; margin-bottom:10px; border-radius:8px; overflow:hidden;">
                        <canvas id="bulk-canvas" style="width:100%; height:100%; cursor:crosshair; touch-action:none;"></canvas>
                        <div style="position:absolute; bottom:5px; right:5px; font-size:0.7rem; color:#cbd5e1; pointer-events:none;">Ruang Tandatangan</div>
                    </div>
                    <button onclick="window.clearBulkSig()" style="color:#ef4444; background:none; border:none; cursor:pointer; font-size:0.85rem; font-weight:600; display:flex; align-items:center; gap:5px;">
                        <span>🗑️</span> Padam Tandatangan
                    </button>

                    <div style="display:grid; grid-template-columns: 1fr 2fr; gap:15px; margin-top:25px; border-top:1px solid #eee; padding-top:20px;">
                        <button onclick="document.getElementById('modal-bulk').style.display='none'" class="btn-reset" style="border:none; background:#f1f5f9;">Batal</button>
                        <button onclick="window.submitBulkSah()" style="background:#059669; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; padding:12px; transition:0.2s;">
                            SAHKAN SEMUA
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Inisialisasi helper functions global untuk akses dari HTML
    setupGlobalFunctions();
}

// ==========================================================================================
// 4. FUNGSI DAPATKAN NAMA PENYELIA (BARU)
// ==========================================================================================
async function fetchPenyeliaProfile() {
    try {
        const user = auth.currentUser;
        if(!user) return;
        
        // Cari rekod penyelia di koleksi 'teachers' menggunakan emel
        const q = query(collection(db, 'teachers'), where('email', '==', user.email.toLowerCase()));
        const snap = await getDocs(q);
        
        if(!snap.empty) {
            const data = snap.docs[0].data();
            currentPenyeliaName = data.name || data.userName || user.displayName || "Penyelia";
        } else {
            currentPenyeliaName = user.displayName || "Penyelia";
        }

        // Kemaskini label di UI jika wujud
        const lbl = document.getElementById('lblPenyeliaName');
        if(lbl) {
            lbl.style.color = "#059669";
            lbl.style.fontWeight = "600";
            lbl.innerText = "✅ Log Masuk sebagai: " + currentPenyeliaName;
        }
        
    } catch(e) {
        console.error("Gagal dapatkan nama penyelia:", e);
        currentPenyeliaName = "Penyelia";
        const lbl = document.getElementById('lblPenyeliaName');
        if(lbl) lbl.innerText = "Log Masuk sebagai: Penyelia";
    }
}

// ==========================================================================================
// 5. LOGIK LOAD DATA (FIX: SUBMITTEDAT)
// ==========================================================================================

export async function loadSemakList() {
    const user = auth.currentUser;
    if(!user) return;
    
    // Bersihkan email penyelia
    const userEmail = user.email.toLowerCase().trim().replace(/^\./, ''); 
    const tbody = document.getElementById('tbodySemakList');

    try {
        console.log(`[Semak] User: ${userEmail}`);
        
        // Cari dalam 'records' dahulu
        let q = query(collection(db, 'records'), where('penyeliaId', '==', userEmail));
        let snap = await getDocs(q);
        
        // Jika kosong, cari dalam 'rph' (Backup)
        if (snap.empty) {
            q = query(collection(db, 'rph'), where('penyeliaId', '==', userEmail));
            snap = await getDocs(q);
        }

        allPendingRPH = []; 
        snap.forEach(docSnap => {
            const data = docSnap.data();
            
            // ----------------------------------------------------------------
            // 1. LOGIK TARIKH KHUSUS (submittedAt)
            // ----------------------------------------------------------------
            let finalDate = new Date(); // Default: Tarikh Harini (Jika error)

            if (data.submittedAt) {
                // Semak jika ia adalah Firestore Timestamp (Ada fungsi toDate)
                if (typeof data.submittedAt.toDate === 'function') {
                    finalDate = data.submittedAt.toDate();
                } else {
                    // Jika ia string atau format lain
                    finalDate = new Date(data.submittedAt);
                }
            } else {
                // Jika field submittedAt TIADA dalam database untuk rekod ini
                // Kita guna created_at sebagai backup, atau tarikh harini
                if (data.created_at && typeof data.created_at.toDate === 'function') {
                    finalDate = data.created_at.toDate();
                }
            }

            // ----------------------------------------------------------------
            // 2. PENAPISAN STATUS
            // ----------------------------------------------------------------
            const statusRaw = (data.status || '').toLowerCase();
            const statusValid = ['hantar', 'dihantar', 'submit', 'submitted', 'pending', 'menunggu'];

            if (statusValid.includes(statusRaw)) {
                
                // Logik Nama Guru
                let nama = data.guruName || data.name || data.userName || data.email;
                if (data.email && window.teacherMap && window.teacherMap[data.email]) {
                    nama = window.teacherMap[data.email];
                }

                allPendingRPH.push({
                    id: docSnap.id,
                    raw: data,
                    nama: nama,
                    subjek: data.subject || data.subjek || 'Tiada Subjek',
                    status: data.status,
                    
                    // Simpan Tarikh Object untuk sorting
                    tarikhSubmit: finalDate, 
                    
                    // Format Tarikh untuk paparan (DD/MM/YYYY)
                    tarikhDisplay: finalDate.toLocaleDateString('ms-MY', { 
                        day: '2-digit', month: '2-digit', year: 'numeric' 
                    })
                });
            }
        });

        // Susun Data (Terkini di atas)
        allPendingRPH.sort((a, b) => b.tarikhSubmit - a.tarikhSubmit);

        renderTable(allPendingRPH);
        
    } catch (e) {
        console.error("Ralat loadSemakList:", e);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Ralat: ${e.message}</td></tr>`;
    }
}

function renderTable(dataList) {
    const tbody = document.getElementById('tbodySemakList');
    let html = '';

    if (dataList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:60px; color:#94a3b8;">
                    <div style="font-size:2rem; margin-bottom:10px;">📭</div>
                    <div style="font-size:1rem; font-weight:500;">Tiada RPH yang perlu disemak.</div>
                    <div style="font-size:0.85rem; margin-top:5px;">RPH yang dihantar akan muncul di sini.</div>
                </td>
            </tr>
        `;
        // Sembunyikan butang pukal jika tiada data
        const btnBulk = document.getElementById('btnBulkApprove');
        if(btnBulk) btnBulk.style.display = 'none';
        return;
    }

    dataList.forEach(item => {
        html += `
            <tr class="row-hover">
                <td style="text-align:center;">
                    <input type="checkbox" class="rph-checkbox" value="${item.id}" onchange="window.handleCheckboxChange()" style="cursor:pointer; width:18px; height:18px; accent-color:#4f46e5;">
                </td>
                <td style="font-weight:600; color:#334155;">
                    ${item.nama.toUpperCase()}
                    <div style="font-size:0.75rem; color:#94a3b8; font-weight:400;">${item.raw.email || ''}</div>
                </td>
                <td>
                    <span style="font-weight:500; color:#0f172a;">${item.subjek}</span>
                    <div style="font-size:0.75rem; color:#64748b;">${item.raw.kelas || ''}</div>
                </td>
                <td><span class="badge badge-hantar">${item.status.toUpperCase()}</span></td>
                <td style="color:#64748b; font-family:monospace;">${item.tarikhDisplay}</td>
                <td style="text-align:center;">
                    <button onclick="window.semakRPH('${item.id}')" class="btn-semak">
                        👁️ Semak
                    </button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
    
    // Reset checkbox header
    const chkAll = document.getElementById('selectAll');
    if(chkAll) chkAll.checked = false;
    
    // Kemaskini status butang pukal
    window.handleCheckboxChange();
}

window.applyFilter = () => {
    const namaQ = document.getElementById('f-nama').value.toLowerCase();
    const subjekQ = document.getElementById('f-subjek').value.toLowerCase();
    const mulaStr = document.getElementById('f-mula').value;
    const tamatStr = document.getElementById('f-tamat').value;

    const mulaDate = mulaStr ? new Date(mulaStr) : null;
    const tamatDate = tamatStr ? new Date(tamatStr) : null;
    if (tamatDate) tamatDate.setHours(23, 59, 59);

    const filtered = allPendingRPH.filter(item => {
        const matchNama = item.nama.toLowerCase().includes(namaQ);
        const matchSubjek = item.subjek.toLowerCase().includes(subjekQ);
        let matchTarikh = true;
        if (mulaDate && item.tarikhSubmit < mulaDate) matchTarikh = false;
        if (tamatDate && item.tarikhSubmit > tamatDate) matchTarikh = false;

        return matchNama && matchSubjek && matchTarikh;
    });

    renderTable(filtered);
};

window.resetFilter = () => {
    document.getElementById('f-nama').value = '';
    document.getElementById('f-subjek').value = '';
    document.getElementById('f-mula').value = '';
    document.getElementById('f-tamat').value = '';
    renderTable(allPendingRPH);
};

// ==========================================================================================
// 6. KANDUNGAN & DETAIL VIEW (PAPARAN TERPERINCI)
// ==========================================================================================
function renderRphContent(data) {
    // Jika data disimpan sebagai satu blok HTML penuh
    if (data.content || data.contentHtml || data.html || data.fullContent) {
        return `<div class="rph-content" style="line-height:1.6; font-size:1rem;">${data.content || data.contentHtml || data.html || data.fullContent}</div>`;
    }
    
    // Jika data disimpan secara berstruktur (field by field)
    const fieldsToCheck = [
        'tema', 'tajuk', 'theme', 'topic', 
        'standardKandungan', 'standardPembelajaran', 'learningObjective', 
        'objektif', 'aktiviti', 'activities', 
        'refleksi', 'reflection', 'impak'
    ];
    
    let structuredHtml = '';
    let foundStructured = false;
    
    fieldsToCheck.forEach(key => {
        if (data[key]) {
            foundStructured = true;
            // Format label: camelCase -> Title Case (contoh: learningObjective -> Learning Objective)
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            
            structuredHtml += `
                <div class="rph-section">
                    <span class="rph-label">${label}</span>
                    <div class="rph-value">${data[key]}</div>
                </div>`;
        }
    });

    if (foundStructured) return structuredHtml;

    // Fallback jika format data tidak dikenali
    return `
        <div style="background:#fee2e2; padding:20px; color:#991b1b; border-radius:8px; border:1px solid #fecaca;">
            <strong>⚠️ Format RPH Tidak Dikenali</strong>
            <p style="margin:5px 0 0; font-size:0.9rem;">Sistem tidak dapat memaparkan kandungan RPH ini secara automatik. Sila rujuk data mentah di bawah:</p>
            <pre style="background:rgba(255,255,255,0.5); padding:10px; margin-top:10px; border-radius:6px; font-size:0.75rem; overflow-x:auto;">${JSON.stringify(data, null, 2)}</pre>
        </div>
    `;
}

window.semakRPH = async (id) => {
    currentRphId = id;
    document.getElementById('semak-list-mode').style.display = 'none';
    const detailDiv = document.getElementById('semak-detail-mode');
    detailDiv.style.display = 'block';
    
    // Cuba dapatkan dari cache dulu untuk kepantasan
    const cachedItem = allPendingRPH.find(i => i.id === id);
    
    let data, nama;
    
    if (cachedItem) {
        data = cachedItem.raw;
        nama = cachedItem.nama;
    } else {
        // Jika user reload page di detail view atau cache kosong
        try {
            const docSnap = await getDoc(doc(db, 'records', id));
            if (!docSnap.exists()) {
                alert("Dokumen tidak dijumpai!");
                window.backToList();
                return;
            }
            data = docSnap.data();
            nama = data.guruName || data.email;
        } catch(e) {
            alert("Ralat memuatkan dokumen: " + e.message);
            window.backToList();
            return;
        }
    }

    // Render Paparan Detail
    detailDiv.innerHTML = `
        <div style="background:white; border-radius:16px; padding:40px; max-width:900px; margin:0 auto; box-shadow:0 10px 25px -5px rgba(0,0,0,0.1);">
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding-bottom:20px; margin-bottom:30px; align-items:flex-start;">
                <div>
                    <h1 style="margin:0 0 5px 0; font-size:1.8rem; color:#1e293b;">${nama.toUpperCase()}</h1>
                    <p style="margin:0; color:#64748b; font-size:1rem;">
                        <span style="background:#f1f5f9; padding:2px 8px; border-radius:4px; font-weight:600; color:#475569;">${data.subject || 'Tiada Subjek'}</span> 
                        • ${data.kelas || 'Tiada Kelas'} 
                        • ${data.submittedAt ? data.submittedAt.toDate().toLocaleDateString('ms-MY') : '-'}
                    </p>
                </div>
                <button onclick="window.backToList()" class="btn-reset" style="width:auto; padding:8px 16px;">Tutup</button>
            </div>

            <div class="rph-viewer" style="margin-bottom:40px;">
                ${renderRphContent(data)}
            </div>

            <div style="background:#f8fafc; padding:30px; border-radius:12px; border:1px solid #cbd5e1; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                <h3 style="margin-top:0; color:#1e293b; border-bottom:1px solid #e2e8f0; padding-bottom:15px; margin-bottom:20px;">
                    📝 Pengesahan Penyelia
                </h3>
                
                <p style="font-size:0.9rem; color:#64748b; margin-bottom:15px;">
                    Disemak oleh: <strong style="color:#4f46e5;">${currentPenyeliaName}</strong>
                </p>

                <label class="rph-label">Pilih Ulasan Pantas:</label>
                <select onchange="document.getElementById('ulasan').value=this.value" class="filter-input" style="margin-bottom:15px; cursor:pointer;">
                    <option value="">-- Pilih Templat Ulasan --</option>
                    ${ulasanBank.map(u => `<option value="${u}">${u}</option>`).join('')}
                </select>

                <label class="rph-label">Ulasan / Komen Tambahan:</label>
                <textarea id="ulasan" class="filter-input" style="height:100px; margin-bottom:20px; resize:vertical; font-family:inherit;"></textarea>

                <label class="rph-label">Tandatangan:</label>
                <div style="background:white; border:2px dashed #94a3b8; height:180px; position:relative; border-radius:8px; margin-bottom:10px; overflow:hidden;">
                    <canvas id="sig-canvas" style="width:100%; height:100%; cursor:crosshair; touch-action:none;"></canvas>
                    <div style="position:absolute; bottom:10px; right:10px; font-size:0.75rem; color:#cbd5e1; pointer-events:none;">Ruang Tandatangan Digital</div>
                </div>
                
                <div style="display:flex; justify-content:space-between; margin-bottom:25px;">
                    <button onclick="window.clearSig()" style="color:#ef4444; background:none; border:none; cursor:pointer; font-weight:600; font-size:0.85rem;">
                        🗑️ Padam Tandatangan
                    </button>
                </div>

                <button onclick="window.submitSah()" style="width:100%; background:#059669; color:white; padding:15px; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:1rem; transition:0.2s; box-shadow:0 4px 6px rgba(5, 150, 105, 0.2);">
                    ✅ SAHKAN & HANTAR SEMAKAN
                </button>
            </div>
        </div>
    `;
    
    // Inisialisasi Canvas (Delay sedikit untuk pastikan elemen wujud dalam DOM)
    setTimeout(() => initCanvas('sig-canvas', false), 200);
    
    // Scroll ke atas
    window.scrollTo(0, 0);
};

window.backToList = () => {
    document.getElementById('semak-detail-mode').style.display = 'none';
    document.getElementById('semak-list-mode').style.display = 'block';
    // Refresh list mungkin idea yang baik
    // loadSemakList(); 
};

// ==========================================================================================
// 7. CANVAS & ACTIONS (SIMPAN NAMA PENYELIA)
// ==========================================================================================
function initCanvas(elemId, isBulk = false) {
    const c = document.getElementById(elemId);
    if(!c) return;
    
    // Resize canvas mengikut saiz sebenar container
    const rect = c.parentElement.getBoundingClientRect();
    c.width = rect.width; 
    c.height = rect.height;
    
    const cx = c.getContext('2d');
    cx.lineWidth = 2.5; 
    cx.strokeStyle = "#1e293b"; 
    cx.lineCap = "round";
    cx.lineJoin = "round";
    
    if(isBulk) { bulkCanvas = c; bulkCtx = cx; } else { canvas = c; ctx = cx; }
    
    let drawing = false;
    
    // Helper untuk dapatkan koordinat tepat (mouse & touch)
    const getPos = (e) => { 
        const r = c.getBoundingClientRect(); 
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        return { 
            x: clientX - r.left, 
            y: clientY - r.top 
        }; 
    };

    const start = (e) => { 
        e.preventDefault(); 
        drawing = true; 
        cx.beginPath(); 
        const p = getPos(e); 
        cx.moveTo(p.x, p.y); 
    };
    
    const draw = (e) => { 
        if(!drawing) return; 
        e.preventDefault(); 
        const p = getPos(e); 
        cx.lineTo(p.x, p.y); 
        cx.stroke(); 
    };
    
    const stop = () => drawing = false;
    
    // Event Listeners
    c.addEventListener('mousedown', start);
    c.addEventListener('mousemove', draw);
    c.addEventListener('mouseup', stop);
    c.addEventListener('mouseout', stop);
    
    c.addEventListener('touchstart', start, {passive: false});
    c.addEventListener('touchmove', draw, {passive: false});
    c.addEventListener('touchend', stop);
}

window.clearSig = () => {
    if(ctx && canvas) ctx.clearRect(0,0,canvas.width,canvas.height);
}
window.clearBulkSig = () => {
    if(bulkCtx && bulkCanvas) bulkCtx.clearRect(0,0,bulkCanvas.width,bulkCanvas.height);
}

// --- SUBMIT INDIVIDU ---
window.submitSah = async () => {
    const ulasan = document.getElementById('ulasan').value.trim();
    
    // Semak tandatangan (compare dengan blank canvas)
    const blank = document.createElement('canvas'); 
    blank.width = canvas.width; 
    blank.height = canvas.height;
    if(canvas.toDataURL() === blank.toDataURL()) {
        alert("Sila turunkan tandatangan sebelum mengesahkan.");
        return;
    }
    
    if(!ulasan) {
        if(!confirm("Anda tidak memasukkan ulasan. Adakah anda pasti mahu meneruskan?")) return;
    }
    
    const confirmMsg = `Sahkan RPH ini dengan ulasan:\n"${ulasan || 'Tiada Ulasan'}"?`;
    if(!confirm(confirmMsg)) return;

    // UI Loading State
    const btn = document.querySelector('button[onclick="window.submitSah()"]');
    const originalText = btn.innerText;
    btn.innerText = "Sedang Menyimpan...";
    btn.disabled = true;

    try {
        await updateDoc(doc(db, 'records', currentRphId), { 
            status: 'disahkan', 
            ulasan: ulasan, 
            signature: canvas.toDataURL(), 
            verifiedAt: Timestamp.now(),
            verifiedBy: currentPenyeliaName // <--- SIMPAN NAMA PENYELIA
        });
        
        alert("RPH Berjaya Disahkan! 🎉"); 
        
        window.backToList(); 
        loadSemakList(); // Reload senarai
        
        // Refresh Dashboard (jika ada fungsi ini di penyelia-main.js)
        if(typeof window.refreshDashboardPenyelia === 'function') window.refreshDashboardPenyelia();

    } catch (e) {
        console.error(e);
        alert("Ralat semasa menyimpan: " + e.message);
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

window.bukaModalPukal = () => {
    const count = document.querySelectorAll('.rph-checkbox:checked').length;
    if(count === 0) return alert("Sila pilih sekurang-kurangnya satu RPH.");

    document.getElementById('bulk-count-display').innerText = count;
    document.getElementById('modal-bulk').style.display = 'flex'; 
    document.getElementById('bulk-ulasan').value = "Disahkan. RPH mematuhi standard.";
    
    // Init canvas dalam modal
    setTimeout(() => initCanvas('bulk-canvas', true), 200);
};

// --- SUBMIT PUKAL ---
window.submitBulkSah = async () => {
    const checkboxes = document.querySelectorAll('.rph-checkbox:checked');
    const ids = Array.from(checkboxes).map(b => b.value);
    const ulasan = document.getElementById('bulk-ulasan').value.trim();
    
    // Validation Signature
    const blank = document.createElement('canvas'); 
    blank.width = bulkCanvas.width; 
    blank.height = bulkCanvas.height;
    if(bulkCanvas.toDataURL() === blank.toDataURL()) return alert("Sila turunkan tandatangan pukal.");

    if(!confirm(`Adakah anda pasti mahu mengesahkan ${ids.length} RPH yang dipilih?`)) return;

    // UI Loading
    const btn = document.querySelector('button[onclick="window.submitBulkSah()"]');
    const originalText = btn.innerText;
    btn.innerText = "Memproses...";
    btn.disabled = true;

    try {
        const batch = writeBatch(db);
        const sigData = bulkCanvas.toDataURL();
        const timestamp = Timestamp.now();
        
        ids.forEach(id => {
            const docRef = doc(db, 'records', id);
            batch.update(docRef, { 
                status: 'disahkan', 
                verifiedAt: timestamp, 
                ulasan: ulasan, 
                signature: sigData,
                verifiedBy: currentPenyeliaName // <--- SIMPAN NAMA PENYELIA DALAM BATCH
            });
        });
        
        await batch.commit();
        
        alert(`Berjaya mengesahkan ${ids.length} RPH!`);
        document.getElementById('modal-bulk').style.display = 'none';
        loadSemakList();
        
        // Refresh Dashboard
        if(typeof window.refreshDashboardPenyelia === 'function') window.refreshDashboardPenyelia();
        
    } catch (e) { 
        console.error(e);
        alert("Ralat Batch Update: " + e.message); 
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// ==========================================================================================
// 8. GLOBAL HELPERS
// ==========================================================================================
function setupGlobalFunctions() {
    // Fungsi navigasi
    window.kembaliKeDashboard = () => { 
        document.getElementById('view-semakan-rph').style.display = 'none'; 
        document.getElementById('view-dashboard-overview').style.display = 'block'; 
        
        // Panggil refresh jika wujud
        if(typeof window.refreshDashboardPenyelia === 'function') {
            window.refreshDashboardPenyelia();
        }
    };

    // Fungsi checkbox pukal
    window.toggleSelectAll = (src) => { 
        document.querySelectorAll('.rph-checkbox').forEach(c => c.checked = src.checked); 
        window.handleCheckboxChange(); 
    };
    
    window.handleCheckboxChange = () => {
        const checked = document.querySelectorAll('.rph-checkbox:checked');
        const btn = document.getElementById('btnBulkApprove');
        const countSpan = document.getElementById('countSelected');
        
        if(btn && countSpan) {
            if(checked.length > 0) { 
                btn.style.display = 'flex'; // Guna flex untuk align icon
                countSpan.innerText = checked.length; 
            } else { 
                btn.style.display = 'none'; 
            }
        }
    };

    // Expose filter functions
    window.applyFilter = applyFilter;
    window.resetFilter = resetFilter;
    
    // Expose detail functions
    window.semakRPH = semakRPH;
    window.backToList = backToList;
    window.submitSah = submitSah;
    window.submitBulkSah = submitBulkSah;
    window.bukaModalPukal = bukaModalPukal;
    window.clearSig = clearSig;
    window.clearBulkSig = clearBulkSig;
}


