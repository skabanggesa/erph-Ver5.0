import { auth, db } from '../config.js';
import { 
    collection, query, where, getDocs, doc, deleteDoc, updateDoc, Timestamp, orderBy, getDoc, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =========================================================
// VARIABLES GLOBAL
// =========================================================
let currentStatus = 'draft';
let currentWeekFilter = 'all';
let selectedDraftIds = []; // Simpan ID yang dipilih untuk pukal

// =========================================================
// 1. INIT SEJARAH (UI & LISTENERS)
// =========================================================
export function initSejarah() {
    const container = document.getElementById('view-sejarah');
    
    // UI UTAMA
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h2 style="margin:0;">📂 Sejarah RPH</h2>
            
            <button id="btnBulkSubmit" onclick="window.bulkSubmitDrafts()" 
                style="display:none; background:#10b981; color:white; border:none; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                🚀 Hantar Pukal (<span id="bulkCount">0</span>)
            </button>
        </div>

        <div style="background:#e0f2fe; padding:15px; border-radius:8px; margin-bottom:20px; border:1px solid #bae6fd;">
            <h4 style="margin-top:0; margin-bottom:10px; color:#0369a1;">🖨️ Cetak Pukal (Status: Disahkan Sahaja)</h4>
            <div style="display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;">
                <div>
                    <label style="display:block; font-size:0.9rem;">Dari:</label>
                    <input type="date" id="printStartDate" class="input-std" style="padding:5px;">
                </div>
                <div>
                    <label style="display:block; font-size:0.9rem;">Hingga:</label>
                    <input type="date" id="printEndDate" class="input-std" style="padding:5px;">
                </div>
                <button onclick="window.printApprovedRPH()" class="btn-action" style="background:#0284c7; color:white; height:36px;">
                    🔍 Cari & Cetak PDF
                </button>
            </div>
        </div>

        <div id="toolbarPlaceholder"></div>

        <div class="table-container">
            <table class="std-table" style="width:100%">
                <thead>
                    <tr>
                        <th style="width:40px; text-align:center;">
                            <input type="checkbox" id="selectAllBox" onchange="window.toggleSelectAll(this)" disabled>
                        </th>
                        <th>Tarikh/Hari</th>
                        <th>Kelas</th>
                        <th>Subjek & Tajuk</th>
                        <th>Status</th>
                        <th>Tindakan</th>
                    </tr>
                </thead>
                <tbody id="tbodyRPHList">
                    <tr><td colspan="6" style="text-align:center;">Memuatkan...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    setupGlobalFunctions();
    injectToolbar();
    loadRPHList('draft'); 

    // Setup Form Edit Listener (Jika wujud)
    const formEdit = document.getElementById('formEditRPH');
    if (formEdit) {
        const newForm = formEdit.cloneNode(true);
        formEdit.parentNode.replaceChild(newForm, formEdit);
        newForm.addEventListener('submit', handleSubmitEditedRPH);
    }
}

// =========================================================
// 2. TOOLBAR & FILTER
// =========================================================
function injectToolbar() {
    const placeholder = document.getElementById('toolbarPlaceholder');
    let weekOpts = `<option value="all">Semua Minggu</option>`;
    for(let i=1; i<=42; i++) weekOpts += `<option value="${i}">Minggu ${i}</option>`;

    placeholder.innerHTML = `
        <div style="margin-bottom:15px; background:#f1f5f9; padding:10px; border-radius:8px; display:flex; flex-wrap:wrap; gap:15px; align-items:center; justify-content:space-between;">
            <div style="display:flex; gap:10px; align-items:center;">
                <strong>Filter:</strong>
                <select id="filterWeek" class="input-std" style="width:150px;" onchange="window.filterByWeek(this.value)">
                    ${weekOpts}
                </select>
            </div>
            <div style="display:flex; gap:5px;">
                <button onclick="window.loadRPHList('draft')" class="filter-btn" id="btn-draft">Draf</button>
                <button onclick="window.loadRPHList('hantar')" class="filter-btn" id="btn-hantar">Dalam Semakan</button>
                <button onclick="window.loadRPHList('disahkan')" class="filter-btn" id="btn-disahkan">Disahkan</button>
                <button onclick="window.loadRPHList('dikembalikan')" class="filter-btn" id="btn-dikembalikan">Dikembalikan</button>
            </div>
        </div>
    `;
}

// =========================================================
// 3. LOAD SENARAI (DENGAN CHECKBOX LOGIC)
// =========================================================
async function loadRPHList(status) {
    currentStatus = status;
    const user = auth.currentUser;
    const tbody = document.getElementById('tbodyRPHList');
    
    // Reset Selection
    selectedDraftIds = [];
    updateBulkButtonUI();
    
    // Enable/Disable Select All berdasarkan status
    const selectAllBox = document.getElementById('selectAllBox');
    selectAllBox.checked = false;
    selectAllBox.disabled = (status !== 'draft'); // Hanya enable masa Draft

    // UI Styles untuk Tab
    document.querySelectorAll('.filter-btn').forEach(b => {
        b.style.opacity = '0.6'; b.style.border = 'none';
        if(b.id === `btn-${status}`) {
            b.style.opacity = '1'; b.style.borderBottom = '3px solid #4f46e5';
        }
    });

    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Memuatkan data...</td></tr>`;

    try {
        let q = query(
            collection(db, 'rph'), 
            where('uid', '==', user.uid), 
            where('status', '==', status),
            orderBy('createdAt', 'desc')
        );
        
        const snap = await getDocs(q);
        let docs = [];
        snap.forEach(d => docs.push({ id: d.id, ...d.data() }));

        // Filter Minggu (Client Side)
        if (currentWeekFilter !== 'all') {
            docs = docs.filter(d => d.minggu == currentWeekFilter);
        }

        if (docs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#666;">Tiada rekod.</td></tr>`;
            return;
        }

        let html = '';
        docs.forEach(d => {
            let paparanTarikh = d.tarikh || d.date || "Tiada Tarikh";
            
            // LOGIK CHECKBOX (Hanya muncul jika status == DRAFT)
            let checkboxHtml = '';
            if (status === 'draft') {
                checkboxHtml = `<input type="checkbox" class="draft-checkbox" value="${d.id}" onchange="window.handleCheckboxChange()">`;
            } else {
                checkboxHtml = `<span style="color:#ccc;">-</span>`;
            }

            // BUTTONS
            let btns = '';
            if (status === 'draft') {
                btns = `
                    <button onclick="window.submitRPH('${d.id}')" class="action-btn" title="Hantar">🚀</button>
                    <button onclick="window.openEditRPH('${d.id}')" class="action-btn" style="background:#f59e0b;">✏️</button>
                    <button onclick="window.deleteRPH('${d.id}')" class="action-btn" style="background:#ef4444;">🗑️</button>
                `;
            } else if (status === 'hantar') {
                btns = `<span style="font-size:0.8rem; color:#d97706;">Menunggu Semakan</span>
                        <button onclick="window.deleteRPH('${d.id}')" class="action-btn" style="background:#ef4444; margin-left:5px; font-size:0.7rem;">Batal</button>`;
            } else if (status === 'disahkan') {
                btns = `<button onclick="window.printSingleRPH('${d.id}')" class="action-btn" style="background:#2563eb; color:white;">🖨️ PDF</button>`;
            } else if (status === 'dikembalikan') {
                btns = `<button onclick="window.openEditRPH('${d.id}')" class="action-btn" style="background:#f59e0b;">✏️ Baiki</button>`;
            }

            html += `<tr>
                <td style="text-align:center;">${checkboxHtml}</td>
                <td>${paparanTarikh}<br><small>${d.hari || ''}</small></td>
                <td>${d.kelas}</td>
                <td><strong>${d.subject}</strong><br><small>${d.tajuk}</small></td>
                <td><span class="badge status-${status}">${status.toUpperCase()}</span></td>
                <td><div style="display:flex; gap:5px;">${btns}</div></td>
            </tr>`;
        });
        tbody.innerHTML = html;

    } catch (e) { 
        console.error(e); 
        tbody.innerHTML = `<tr><td colspan="6" style="color:red;">Ralat: ${e.message}</td></tr>`; 
    }
}

// =========================================================
// 4. FUNGSI PUKAL (BULK SUBMIT) - INI YANG ANDA MAHU
// =========================================================

// Helper: Cari penyelia terkini dari profil guru
async function getLatestSupervisor(userEmail) {
    try {
        const snap = await getDoc(doc(db, 'teachers', userEmail));
        if(snap.exists()) return snap.data().penyelia || snap.data().penyeliaId || '';
    } catch(e) { console.error(e); }
    return '';
}

// Update UI Butang Pukal
function updateBulkButtonUI() {
    const btn = document.getElementById('btnBulkSubmit');
    const countSpan = document.getElementById('bulkCount');
    
    const checkboxes = document.querySelectorAll('.draft-checkbox:checked');
    selectedDraftIds = Array.from(checkboxes).map(cb => cb.value);
    
    countSpan.innerText = selectedDraftIds.length;
    btn.style.display = selectedDraftIds.length > 0 ? 'block' : 'none';
}

// Logic Hantar Pukal
async function bulkSubmitDrafts() {
    if (selectedDraftIds.length === 0) return;

    if (!confirm(`Adakah anda pasti mahu hantar ${selectedDraftIds.length} RPH ini kepada penyelia?`)) return;

    try {
        const user = auth.currentUser;
        const penyeliaId = await getLatestSupervisor(user.email);
        
        // Guna WriteBatch untuk update serentak
        const batch = writeBatch(db);
        
        selectedDraftIds.forEach(id => {
            const docRef = doc(db, 'rph', id);
            batch.update(docRef, {
                status: 'hantar',
                submittedAt: Timestamp.now(),
                penyeliaId: penyeliaId // Tag penyelia supaya masuk list mereka
            });
        });

        await batch.commit();
        
        alert("Berjaya! Semua RPH yang dipilih telah dihantar.");
        loadRPHList('draft'); // Refresh list

    } catch (e) {
        console.error(e);
        alert("Ralat penghantaran pukal: " + e.message);
    }
}

// =========================================================
// 5. FUNGSI LAIN (EDIT, DELETE, PRINT)
// =========================================================
async function submitRPH(docId) {
    if(!confirm("Hantar RPH ini?")) return;
    try {
        const penyeliaId = await getLatestSupervisor(auth.currentUser.email);
        await updateDoc(doc(db, 'rph', docId), {
            status: 'hantar',
            submittedAt: Timestamp.now(),
            penyeliaId: penyeliaId
        });
        alert("Berjaya dihantar!");
        loadRPHList('draft');
    } catch(e) { alert("Gagal: " + e.message); }
}

async function deleteRPH(docId) {
    if(confirm("Padam rekod ini?")) { 
        await deleteDoc(doc(db, 'rph', docId)); 
        loadRPHList(currentStatus); 
    }
}

// Fungsi Buka Borang Edit
async function openEditRPH(docId) {
    try {
        const snap = await getDoc(doc(db, 'rph', docId));
        if(!snap.exists()) return;
        const d = snap.data();
        if(window.switchGuruView) window.switchGuruView('view-edit-rph');
        
        document.getElementById('editDocId').value = docId;
        // Populate fields
        const fields = ['Tarikh', 'Kelas', 'Masa', 'Tajuk', 'SP', 'Objektif', 'Aktiviti', 'BBM', 'Nilai', 'Refleksi'];
        fields.forEach(f => {
            const el = document.getElementById('e' + f);
            if(el) el.value = d[f.toLowerCase()] || '';
        });

    } catch(e) { console.error(e); }
}

// Simpan Borang Edit
async function handleSubmitEditedRPH(e) {
    e.preventDefault();
    await processEditForm('hantar');
}
async function saveDraftRPH() { await processEditForm('draft'); }

async function processEditForm(targetStatus) {
    const docId = document.getElementById('editDocId').value;
    const updatedData = {
        tarikh: document.getElementById('eTarikh').value, 
        kelas: document.getElementById('eKelas').value,
        masa: document.getElementById('eMasa').value,
        tajuk: document.getElementById('eTajuk').value,
        sp: document.getElementById('eSP').value,
        objektif: document.getElementById('eObjektif').value,
        aktiviti: document.getElementById('eAktiviti').value,
        bbm: document.getElementById('eBBM').value,
        nilai: document.getElementById('eNilai').value,
        refleksi: document.getElementById('eRefleksi').value,
        status: targetStatus,
        updatedAt: Timestamp.now()
    };
    if(targetStatus === 'hantar') updatedData.penyeliaId = await getLatestSupervisor(auth.currentUser.email);

    try {
        await updateDoc(doc(db, 'rph', docId), updatedData);
        alert(targetStatus === 'draft' ? "Disimpan sebagai Draf." : "Berjaya Dihantar!");
        document.getElementById('view-edit-rph').style.display = 'none';
        if(window.switchGuruView) window.switchGuruView('view-sejarah');
        loadRPHList(targetStatus);
    } catch(e) { alert("Ralat: " + e.message); }
}

// =========================================================
// 6. FUNGSI CETAK (PDF & PUKAL)
// =========================================================
async function printSingleRPH(id) {
    window.open(`print-rph.html?id=${id}`, '_blank');
}

async function printApprovedRPH() {
    const startVal = document.getElementById('printStartDate').value;
    const endVal = document.getElementById('printEndDate').value;
    
    if(!startVal || !endVal) { alert("Sila pilih julat tarikh."); return; }
    
    const startDate = new Date(startVal);
    const endDate = new Date(endVal); endDate.setHours(23, 59, 59);

    if (startDate > endDate) { alert("Tarikh Mula salah."); return; }

    try {
        const user = auth.currentUser;
        const q = query(
            collection(db, 'rph'),
            where('uid', '==', user.uid),
            where('status', '==', 'disahkan')
        );

        const snap = await getDocs(q);
        const idsToPrint = [];

        snap.forEach(docSnap => {
            const d = docSnap.data();
            const tStr = d.tarikh || d.date; // Support format "03/02/2026" or "2026-02-03"
            let rphDate = null;

            if(tStr && tStr.includes('/')) {
                const p = tStr.split('/');
                rphDate = new Date(p[2], p[1]-1, p[0]);
            } else if (tStr) {
                rphDate = new Date(tStr);
            }

            if(rphDate && rphDate >= startDate && rphDate <= endDate) {
                idsToPrint.push(docSnap.id);
            }
        });

        if (idsToPrint.length === 0) { alert("Tiada RPH Disahkan dalam tarikh ini."); return; }
        
        window.open(`print-bulk.html?ids=${idsToPrint.join(',')}`, '_blank');

    } catch (e) { alert("Ralat: " + e.message); }
}

// =========================================================
// 7. GLOBAL EXPORTS
// =========================================================
function setupGlobalFunctions() {
    window.loadRPHList = loadRPHList;
    window.deleteRPH = deleteRPH;
    window.submitRPH = submitRPH;
    window.openEditRPH = openEditRPH;
    window.saveDraftRPH = saveDraftRPH;
    window.printApprovedRPH = printApprovedRPH;
    window.printSingleRPH = printSingleRPH;
    
    // FUNGSI BARU (PUKAL & FILTER)
    window.bulkSubmitDrafts = bulkSubmitDrafts;
    window.handleCheckboxChange = updateBulkButtonUI;
    window.filterByWeek = (val) => { currentWeekFilter = val; loadRPHList(currentStatus); };
    
    window.toggleSelectAll = (source) => {
        const cbs = document.querySelectorAll('.draft-checkbox');
        cbs.forEach(cb => cb.checked = source.checked);
        updateBulkButtonUI();
    };
}