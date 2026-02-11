/**
 * ==========================================================================================
 * MODUL SEMAKAN RPH: LOGIK PENYELIA (VERSI PENUH - DENGAN NAMA PENYELIA)
 * ==========================================================================================
 * Fail: assets/js/penyelia/penyelia-semak.js
 * * FUNGSI UTAMA:
 * 1. Senarai RPH dengan FILTER (Nama, Subjek, Tarikh).
 * 2. Semakan Individu & Pukal.
 * 3. Tandatangan Digital & Ulasan Dinamik.
 * 4. MENYIMPAN NAMA PENYELIA (verifiedBy) untuk paparan guru.
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

const ulasanBank = [
    "RPH disediakan dengan baik dan lengkap. Tahniah.",
    "Objektif pembelajaran jelas dan aktiviti sesuai.",
    "Persediaan mengajar yang sangat rapi. Teruskan kecemerlangan.",
    "Langkah pengajaran tersusun dan mudah difahami.",
    "Penggunaan BBM yang menarik dalam PdP.",
    "Refleksi ditulis dengan baik. Teruskan usaha.",
    "Sangat baik. Pastikan kawalan kelas diutamakan.",
    "Disahkan. RPH mematuhi standard yang ditetapkan."
];

// ==========================================================================================
// 2. INJECT CSS (GAYA UI)
// ==========================================================================================
// Menyuntik CSS secara dinamik untuk memastikan layout kemas dan tidak bertindih.
const style = document.createElement('style');
style.innerHTML = `
    .semak-container { font-family: 'Inter', sans-serif; color: #334155; }
    
    /* FILTER SECTION */
    .filter-box {
        background: #f8fafc; 
        padding: 25px; 
        border-radius: 12px; 
        border: 1px solid #e2e8f0; 
        margin-bottom: 25px;
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
        transition: 0.2s;
    }
    .filter-input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); }
    
    /* TABLE */
    .table-responsive {
        overflow-x: auto;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
    }
    .table-semak { width: 100%; border-collapse: collapse; }
    .table-semak th { background: #f1f5f9; padding: 15px; text-align: left; font-size: 0.9rem; color: #475569; white-space: nowrap; }
    .table-semak td { padding: 15px; border-bottom: 1px solid #f1f5f9; font-size: 0.95rem; vertical-align: middle; }
    .row-hover:hover { background: #f8fafc; }

    /* BUTTONS */
    .btn-semak { background: #4f46e5; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 0.9rem; white-space: nowrap; }
    .btn-reset { width:100%; padding: 10px; background: white; border: 1px solid #cbd5e1; color: #475569; border-radius: 8px; cursor: pointer; font-weight: 600; }
    .btn-reset:hover { background: #f1f5f9; }
    
    /* MODAL */
    .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box; }
    .modal-content { background: white; padding: 30px; border-radius: 16px; width: 100%; max-width: 550px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); position: relative; }
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
                
                <div style="display:flex; flex-wrap:wrap; gap:15px; justify-content:space-between; align-items:center; margin-bottom:25px;">
                    <div>
                        <h2 style="margin:0; color:#1e293b; font-size:1.5rem;">📋 Semakan RPH Guru</h2>
                        <p style="margin:5px 0 0; color:#64748b; font-size:0.9rem;" id="lblPenyeliaName">Memuatkan profil penyelia...</p>
                    </div>
                    <button id="btnBulkApprove" style="display:none; background:#059669; color:white; padding:10px 20px; border:none; border-radius:8px; font-weight:bold; cursor:pointer; box-shadow:0 4px 6px rgba(5, 150, 105, 0.2); transition:0.2s;" onclick="window.bukaModalPukal()">
                        ✍️ Sahkan Pukal (<span id="countSelected">0</span>)
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
                                <th style="width:40px; text-align:center;"><input type="checkbox" id="selectAll" onclick="window.toggleSelectAll(this)" style="transform:scale(1.2); cursor:pointer;"></th>
                                <th>Nama Guru</th>
                                <th>Mata Pelajaran</th>
                                <th>Tarikh Hantar</th>
                                <th style="text-align:center;">Tindakan</th>
                            </tr>
                        </thead>
                        <tbody id="tbodySemakList">
                            <tr><td colspan="5" style="text-align:center; padding:50px; color:#94a3b8;">Sedang memuatkan senarai...</td></tr>
                        </tbody>
                    </table>
                </div>
                
                <div style="margin-top:25px;">
                    <button onclick="window.kembaliKeDashboard()" style="background:none; border:none; color:#64748b; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:5px;">
                        <span>←</span> Kembali ke Dashboard
                    </button>
                </div>
            </div>

            <div id="semak-detail-mode" style="display:none;"></div>

            <div id="modal-bulk" class="modal-overlay" style="display:none;">
                <div class="modal-content">
                    <h3 style="margin-top:0; color:#1e293b; border-bottom:1px solid #eee; padding-bottom:15px;">Pengesahan Pukal</h3>
                    <p style="color:#64748b; font-size:0.95rem;">Anda sedang mengesahkan <strong id="bulk-count-display" style="color:#4f46e5;">0</strong> RPH terpilih.</p>
                    
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
                    <div style="border:2px dashed #94a3b8; height:150px; background:white; position:relative; margin-bottom:10px; border-radius:8px;">
                        <canvas id="bulk-canvas" style="width:100%; height:100%; cursor:crosshair; touch-action:none;"></canvas>
                    </div>
                    <button onclick="window.clearBulkSig()" style="color:#ef4444; background:none; border:none; cursor:pointer; font-size:0.85rem; font-weight:600;">[ Padam Tandatangan ]</button>

                    <div style="display:grid; grid-template-columns: 1fr 2fr; gap:15px; margin-top:25px; border-top:1px solid #eee; padding-top:20px;">
                        <button onclick="document.getElementById('modal-bulk').style.display='none'" class="btn-reset" style="border:none; background:#f1f5f9;">Batal</button>
                        <button onclick="window.submitBulkSah()" style="background:#059669; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; padding:12px;">SAHKAN SEMUA</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupGlobalFunctions();
}

// ==========================================================================================
// 4. FUNGSI DAPATKAN NAMA PENYELIA (BARU)
// ==========================================================================================
async function fetchPenyeliaProfile() {
    try {
        const user = auth.currentUser;
        if(!user) return;
        
        // Cari rekod penyelia di koleksi 'teachers'
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
        if(lbl) lbl.innerText = "Log Masuk sebagai: " + currentPenyeliaName;
        
    } catch(e) {
        console.error("Gagal dapatkan nama penyelia:", e);
        currentPenyeliaName = "Penyelia";
    }
}

// ==========================================================================================
// 5. LOGIK LOAD DATA & FILTER
// ==========================================================================================

export async function loadSemakList() {
    const user = auth.currentUser;
    if(!user) return;
    const userEmail = user.email.toLowerCase();
    const tbody = document.getElementById('tbodySemakList');

    try {
        const q = query(collection(db, 'records'), where('penyeliaId', '==', userEmail), where('status', '==', 'dihantar'));
        const snap = await getDocs(q);
        
        allPendingRPH = []; 
        snap.forEach(docSnap => {
            const data = docSnap.data();
            let nama = data.guruName || data.name || data.userName || data.email;
            // Gunakan global map dari main.js jika ada
            if (data.email && window.teacherMap && window.teacherMap[data.email]) nama = window.teacherMap[data.email];

            allPendingRPH.push({
                id: docSnap.id,
                raw: data,
                nama: nama,
                subjek: data.subject || '-',
                tarikhSubmit: data.submittedAt ? data.submittedAt.toDate() : new Date(0),
                tarikhDisplay: data.submittedAt ? data.submittedAt.toDate().toLocaleDateString('ms-MY') : '-'
            });
        });

        allPendingRPH.sort((a, b) => b.tarikhSubmit - a.tarikhSubmit);
        renderTable(allPendingRPH);
        
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center; padding:20px;">Gagal memuatkan senarai.</td></tr>';
    }
}

function renderTable(dataList) {
    const tbody = document.getElementById('tbodySemakList');
    let html = '';

    if (dataList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:50px; color:#94a3b8; font-style:italic;">Tiada rekod yang sepadan.</td></tr>';
        return;
    }

    dataList.forEach(item => {
        html += `
            <tr class="row-hover">
                <td style="text-align:center;"><input type="checkbox" class="rph-checkbox" value="${item.id}" onchange="window.handleCheckboxChange()" style="cursor:pointer; width:18px; height:18px;"></td>
                <td style="font-weight:600; color:#334155;">${item.nama.toUpperCase()}</td>
                <td>${item.subjek}</td>
                <td style="color:#64748b;">${item.tarikhDisplay}</td>
                <td style="text-align:center;">
                    <button onclick="window.semakRPH('${item.id}')" class="btn-semak">👁️ Semak</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
    document.getElementById('selectAll').checked = false;
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
// 6. KANDUNGAN & DETAIL VIEW
// ==========================================================================================
function renderRphContent(data) {
    if (data.content || data.contentHtml || data.html || data.fullContent) {
        return `<div class="rph-content" style="line-height:1.6;">${data.content || data.contentHtml || data.html || data.fullContent}</div>`;
    }
    const fieldsToCheck = ['theme', 'topic', 'learningObjective', 'activities', 'reflection', 'tema', 'tajuk', 'standardKandungan', 'standardPembelajaran', 'objektif', 'aktiviti', 'refleksi', 'impak'];
    let structuredHtml = '';
    let foundStructured = false;
    fieldsToCheck.forEach(key => {
        if (data[key]) {
            foundStructured = true;
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            structuredHtml += `<div style="margin-bottom:20px;"><h4 style="margin:0 0 8px 0; color:#4f46e5; border-bottom:1px solid #e0e7ff; display:inline-block;">${label}</h4><div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0; line-height:1.6; color:#334155;">${data[key]}</div></div>`;
        }
    });
    if (foundStructured) return structuredHtml;
    return `<div style="background:#fee2e2; padding:15px; color:#991b1b; border-radius:8px;">⚠️ Kandungan RPH tidak dapat dikesan.<br><pre style="font-size:0.7rem;">${JSON.stringify(data, null, 2)}</pre></div>`;
}

window.semakRPH = async (id) => {
    currentRphId = id;
    document.getElementById('semak-list-mode').style.display = 'none';
    const detailDiv = document.getElementById('semak-detail-mode');
    detailDiv.style.display = 'block';
    
    const cachedItem = allPendingRPH.find(i => i.id === id);
    const data = cachedItem ? cachedItem.raw : (await getDoc(doc(db, 'records', id))).data();
    const nama = cachedItem ? cachedItem.nama : (data.guruName || data.email);

    detailDiv.innerHTML = `
        <div style="background:white; border-radius:16px; padding:35px; max-width:900px; margin:0 auto; box-shadow:0 4px 15px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:20px; margin-bottom:25px;">
                <div><h2 style="margin:0;">${nama}</h2><p style="color:#64748b;">${data.subject || '-'} | ${data.dateISO || '-'}</p></div>
                <button onclick="window.backToList()" class="btn-reset" style="width:auto; height:40px;">Tutup</button>
            </div>
            <div class="rph-viewer" style="border:1px solid #e2e8f0; padding:30px; border-radius:12px; margin-bottom:35px;">${renderRphContent(data)}</div>
            <div style="background:#f8fafc; padding:25px; border-radius:12px; border:1px solid #e2e8f0;">
                <h3>Pengesahan Penyelia</h3>
                <p style="font-size:0.85rem; color:#64748b; margin-bottom:10px;">Pengesah: <strong>${currentPenyeliaName}</strong></p>
                <select onchange="document.getElementById('ulasan').value=this.value" class="filter-input" style="margin-bottom:15px;">
                    <option value="">-- Pilih Ulasan Pantas --</option>${ulasanBank.map(u => `<option value="${u}">${u}</option>`).join('')}
                </select>
                <textarea id="ulasan" class="filter-input" style="height:80px; margin-bottom:20px; resize:vertical;"></textarea>
                <div style="background:white; border:2px dashed #94a3b8; height:150px; position:relative; border-radius:8px; margin-bottom:10px;">
                    <canvas id="sig-canvas" style="width:100%; height:100%; cursor:crosshair;"></canvas>
                </div>
                <button onclick="window.clearSig()" style="color:#ef4444; background:none; border:none; margin-bottom:20px; cursor:pointer;">[ Padam Tandatangan ]</button>
                <button onclick="window.submitSah()" style="width:100%; background:#059669; color:white; padding:14px; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">SAHKAN RPH</button>
            </div>
        </div>
    `;
    setTimeout(() => initCanvas('sig-canvas', false), 200);
};

window.backToList = () => {
    document.getElementById('semak-detail-mode').style.display = 'none';
    document.getElementById('semak-list-mode').style.display = 'block';
};

// ==========================================================================================
// 7. CANVAS & ACTIONS (SIMPAN NAMA PENYELIA)
// ==========================================================================================
function initCanvas(elemId, isBulk = false) {
    const c = document.getElementById(elemId);
    if(!c) return;
    const rect = c.parentElement.getBoundingClientRect();
    c.width = rect.width; c.height = rect.height;
    const cx = c.getContext('2d');
    cx.lineWidth = 2.5; cx.strokeStyle = "#000"; cx.lineCap = "round";
    if(isBulk) { bulkCanvas = c; bulkCtx = cx; } else { canvas = c; ctx = cx; }
    
    let drawing = false;
    const getPos = (e) => { const r = c.getBoundingClientRect(); return { x: (e.clientX||e.touches[0].clientX)-r.left, y: (e.clientY||e.touches[0].clientY)-r.top }; };
    const start = (e) => { drawing=true; cx.beginPath(); const p=getPos(e); cx.moveTo(p.x,p.y); };
    const draw = (e) => { if(!drawing) return; e.preventDefault(); const p=getPos(e); cx.lineTo(p.x,p.y); cx.stroke(); };
    const stop = () => drawing=false;
    
    c.onmousedown=start; c.onmousemove=draw; c.onmouseup=stop; c.onmouseout=stop;
    c.ontouchstart=start; c.ontouchmove=draw; c.ontouchend=stop;
}

window.clearSig = () => ctx.clearRect(0,0,canvas.width,canvas.height);
window.clearBulkSig = () => bulkCtx.clearRect(0,0,bulkCanvas.width,bulkCanvas.height);

// --- SUBMIT INDIVIDU ---
window.submitSah = async () => {
    const ulasan = document.getElementById('ulasan').value;
    const blank = document.createElement('canvas'); blank.width=canvas.width; blank.height=canvas.height;
    if(canvas.toDataURL() === blank.toDataURL()) return alert("Sila tandatangan.");
    
    if(confirm("Sahkan RPH ini?")) {
        try {
            await updateDoc(doc(db, 'records', currentRphId), { 
                status: 'disahkan', 
                ulasan: ulasan, 
                signature: canvas.toDataURL(), 
                verifiedAt: Timestamp.now(),
                verifiedBy: currentPenyeliaName // <--- SIMPAN NAMA PENYELIA
            });
            alert("Berjaya disahkan!"); 
            window.backToList(); 
            loadSemakList();
            
            // Refresh Dashboard (jika ada fungsi ini)
            if(typeof window.refreshDashboardPenyelia === 'function') window.refreshDashboardPenyelia();

        } catch (e) {
            alert("Ralat: " + e.message);
        }
    }
};

window.bukaModalPukal = () => {
    const count = document.querySelectorAll('.rph-checkbox:checked').length;
    document.getElementById('bulk-count-display').innerText = count;
    document.getElementById('modal-bulk').style.display = 'flex'; 
    document.getElementById('bulk-ulasan').value = "Disahkan. RPH mematuhi standard.";
    setTimeout(() => initCanvas('bulk-canvas', true), 200);
};

// --- SUBMIT PUKAL ---
window.submitBulkSah = async () => {
    const checkboxes = document.querySelectorAll('.rph-checkbox:checked');
    const ids = Array.from(checkboxes).map(b => b.value);
    const ulasan = document.getElementById('bulk-ulasan').value;
    const blank = document.createElement('canvas'); blank.width=bulkCanvas.width; blank.height=bulkCanvas.height;
    if(bulkCanvas.toDataURL() === blank.toDataURL()) return alert("Sila turunkan tandatangan.");

    if(!confirm(`Sahkan ${ids.length} RPH dengan ulasan ini?`)) return;

    try {
        const batch = writeBatch(db);
        const sigData = bulkCanvas.toDataURL();
        
        ids.forEach(id => {
            batch.update(doc(db, 'records', id), { 
                status: 'disahkan', 
                verifiedAt: Timestamp.now(), 
                ulasan: ulasan, 
                signature: sigData,
                verifiedBy: currentPenyeliaName // <--- SIMPAN NAMA PENYELIA DALAM BATCH
            });
        });
        
        await batch.commit();
        alert("Berjaya sahkan semua!");
        document.getElementById('modal-bulk').style.display = 'none';
        loadSemakList();
        
        // Refresh Dashboard
        if(typeof window.refreshDashboardPenyelia === 'function') window.refreshDashboardPenyelia();
        
    } catch (e) { alert("Ralat: " + e.message); }
};

// ==========================================================================================
// 8. GLOBAL HELPERS
// ==========================================================================================
function setupGlobalFunctions() {
    window.kembaliKeDashboard = () => { 
        document.getElementById('view-semakan-rph').style.display = 'none'; 
        document.getElementById('view-dashboard-overview').style.display = 'block'; 
        
        // Panggil refresh jika wujud
        if(typeof window.refreshDashboardPenyelia === 'function') {
            window.refreshDashboardPenyelia();
        }
    };
    window.toggleSelectAll = (src) => { document.querySelectorAll('.rph-checkbox').forEach(c => c.checked = src.checked); window.handleCheckboxChange(); };
    window.handleCheckboxChange = () => {
        const checked = document.querySelectorAll('.rph-checkbox:checked');
        const btn = document.getElementById('btnBulkApprove');
        if(checked.length > 0) { btn.style.display = 'block'; document.getElementById('countSelected').innerText = checked.length; } else { btn.style.display = 'none'; }
    };
    window.applyFilter = applyFilter;
    window.resetFilter = resetFilter;
}