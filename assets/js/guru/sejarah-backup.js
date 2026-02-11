import { auth, db } from '../config.js';
import { 
    collection, query, where, getDocs, doc, deleteDoc, orderBy, getDoc, updateDoc, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Variable global sementara untuk fungsi pukal
let currentDisplayedRPHIds = []; 

export function initSejarah() {
    // 1. Dedahkan fungsi ke Global Scope (Window) TERLEBIH DAHULU
    window.loadRPHList = loadRPHList;
    window.deleteRPH = deleteRPH;
    window.openEditRPH = openEditRPH;
    window.saveDraftRPH = saveDraftRPH;
    window.printApprovedRPH = printApprovedRPH;
    window.bulkSubmitDrafts = bulkSubmitDrafts;
    window.bulkDeleteByWeek = bulkDeleteByWeek;

    // 2. Pasang Event Listener untuk Borang Edit
    const formEdit = document.getElementById('formEditRPH');
    if (formEdit) formEdit.addEventListener('submit', handleSubmitRPH);

    // 3. Inisialisasi Toolbar (Filter Minggu & Butang Pukal)
    injectToolbar();
}

// =========================================================
// SETUP TOOLBAR (DROPDOWN & BUTTONS)
// =========================================================
function injectToolbar() {
    const container = document.querySelector('#view-sejarah .table-container div[style*="margin-bottom:15px"]');
    
    // Elak duplikasi toolbar
    if(container && !document.getElementById('sejarahToolbar')) {
        
        // Wrapper div
        const toolbar = document.createElement('div');
        toolbar.id = 'sejarahToolbar';
        toolbar.style.display = 'flex';
        toolbar.style.gap = '10px';
        toolbar.style.alignItems = 'center';
        toolbar.style.marginBottom = '10px';
        toolbar.style.flexWrap = 'wrap';
        toolbar.className = 'fade-in'; // Jika ada CSS animasi

        // 1. Dropdown Minggu
        const select = document.createElement('select');
        select.id = 'filterMinggu';
        select.className = 'input-std'; 
        select.style.width = 'auto';
        select.style.margin = '0';
        
        let opts = `<option value="all">Semua Minggu</option>`;
        for(let i=1; i<=42; i++) {
            opts += `<option value="${i}">Minggu ${i}</option>`;
        }
        select.innerHTML = opts;

        // Event: Reload list bila minggu bertukar
        select.addEventListener('change', () => {
            const activeBtn = document.querySelector('.active-filter');
            let status = 'draft';
            if(activeBtn) {
                if(activeBtn.getAttribute('onclick').includes('hantar')) status = 'hantar';
                else if(activeBtn.getAttribute('onclick').includes('disahkan')) status = 'disahkan';
            }
            loadRPHList(status);
        });

        // 2. Butang Hantar Pukal (Untuk Draft Sahaja)
        const btnBulkSend = document.createElement('button');
        btnBulkSend.id = 'btnBulkSend';
        btnBulkSend.innerHTML = '🚀 Hantar Semua Draf';
        btnBulkSend.style.display = 'none';
        btnBulkSend.className = 'btn-action';
        btnBulkSend.style.background = '#2563eb';
        btnBulkSend.style.color = 'white';
        // PEMBETULAN: Guna addEventListener direct ke fungsi module
        btnBulkSend.addEventListener('click', bulkSubmitDrafts);

        // 3. Butang Padam Pukal (Untuk Minggu Tertentu)
        const btnBulkDelete = document.createElement('button');
        btnBulkDelete.id = 'btnBulkDelete';
        btnBulkDelete.innerHTML = '🗑️ Padam Minggu Ini';
        btnBulkDelete.style.display = 'none';
        btnBulkDelete.className = 'btn-action';
        btnBulkDelete.style.background = '#ef4444';
        btnBulkDelete.style.color = 'white';
        // PEMBETULAN: Guna addEventListener direct ke fungsi module
        btnBulkDelete.addEventListener('click', bulkDeleteByWeek);

        toolbar.appendChild(select);
        toolbar.appendChild(btnBulkSend);
        toolbar.appendChild(btnBulkDelete);

        container.insertBefore(toolbar, container.firstChild);
    }
}

// =========================================================
// LOAD RPH LIST
// =========================================================
async function loadRPHList(statusFilter) {
    const user = auth.currentUser;
    const tbody = document.getElementById('tbodyRPHList');
    
    // Reset list ID global
    currentDisplayedRPHIds = [];

    const weekSelect = document.getElementById('filterMinggu');
    const selectedWeek = weekSelect ? weekSelect.value : 'all';

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Memuatkan...</td></tr>';
    
    // UI: Tunjuk/Sembunyi Print Zone
    const printZone = document.getElementById('printZone');
    if(printZone) printZone.style.display = (statusFilter === 'disahkan') ? 'block' : 'none';

    // UI: Tunjuk/Sembunyi Butang Pukal
    const btnBulkSend = document.getElementById('btnBulkSend');
    const btnBulkDelete = document.getElementById('btnBulkDelete');

    // Kemaskini Tab Aktif
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        if(btn.tagName === 'BUTTON') {
            btn.classList.remove('active-filter');
            if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${statusFilter}'`)) {
                btn.classList.add('active-filter');
            }
        }
    });

    try {
        const q = query(
            collection(db, 'rph'), 
            where('uid', '==', user.uid),
            where('status', '==', statusFilter),
            orderBy('tarikh', 'desc')
        );
        const snap = await getDocs(q);
        
        if(snap.empty) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px;">Tiada rekod.</td></tr>`;
            if(btnBulkSend) btnBulkSend.style.display = 'none';
            if(btnBulkDelete) btnBulkDelete.style.display = 'none';
            return;
        }

        let html = '';
        let count = 0;

        snap.forEach(doc => {
            const d = doc.data();
            
            // Client-side Filter Minggu
            // Jika user pilih 'Minggu X', skip data yang bukan Minggu X
            if(selectedWeek !== 'all' && String(d.minggu) !== String(selectedWeek)) {
                return; 
            }

            // Simpan ID yang sedang "visible" untuk operasi pukal
            currentDisplayedRPHIds.push(doc.id);
            count++;

            const dateDisplay = d.tarikh ? d.tarikh.split('-').reverse().join('/') : '-';
            const weekLabel = d.minggu ? `<span class="badge" style="background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1; margin-left:5px;">M${d.minggu}</span>` : '';
            const statusBadge = `<span class="badge badge-${d.status}">${d.status.toUpperCase()}</span>`;

            let mainBtn = `<button class="btn-action" style="background:#2563eb; color:white;" onclick="window.openEditRPH('${doc.id}')">✏️ Edit</button>`;
            if(statusFilter !== 'draft') {
                mainBtn = `<button class="btn-action" style="background:#64748b; color:white;" onclick="window.openEditRPH('${doc.id}')">👁️ Lihat</button>`;
            }
            let deleteBtn = `<button class="btn-action" style="background:#ef4444; color:white;" onclick="window.deleteRPH('${doc.id}')">🗑️</button>`;

            html += `
                <tr>
                    <td>${dateDisplay}</td>
                    <td>${d.kelas} ${weekLabel}</td>
                    <td><strong>${d.subject}</strong><br><small style="color:#666">${d.tajuk}</small></td>
                    <td>${statusBadge}</td>
                    <td><div style="display:flex; gap:5px;">${mainBtn} ${deleteBtn}</div></td>
                </tr>
            `;
        });

        // Papar mesej jika tiada data dalam minggu tersebut
        if(count === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px;">Tiada rekod untuk Minggu ${selectedWeek}.</td></tr>`;
        } else {
            tbody.innerHTML = html;
        }

        // Logic Paparan Butang Pukal (Berdasarkan Count & Status)
        if(btnBulkSend) {
            // Hantar hanya untuk Draf & Ada Data
            btnBulkSend.style.display = (statusFilter === 'draft' && count > 0) ? 'block' : 'none';
        }
        if(btnBulkDelete) {
            // Padam hanya jika pilih Minggu Spesifik & Ada Data
            btnBulkDelete.style.display = (selectedWeek !== 'all' && count > 0) ? 'block' : 'none';
        }

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">Ralat: ${e.message}</td></tr>`;
    }
}

// =========================================================
// BULK ACTION: HANTAR DRAF
// =========================================================
async function bulkSubmitDrafts() {
    if(currentDisplayedRPHIds.length === 0) {
        alert("Tiada RPH untuk dihantar.");
        return;
    }

    if(!confirm(`Adakah anda pasti mahu menghantar ${currentDisplayedRPHIds.length} RPH ini kepada penyelia?`)) return;

    const btn = document.getElementById('btnBulkSend');
    btn.textContent = "Sedang Menghantar...";
    btn.disabled = true;

    try {
        const batch = writeBatch(db);
        currentDisplayedRPHIds.forEach(id => {
            const ref = doc(db, 'rph', id);
            batch.update(ref, { status: 'hantar' });
        });

        await batch.commit();
        alert("Semua RPH berjaya dihantar!");
        
        // Refresh list
        loadRPHList('draft'); 

    } catch(e) {
        console.error(e);
        alert("Gagal menghantar pukal: " + e.message);
    } finally {
        if(btn) {
            btn.textContent = "🚀 Hantar Semua Draf";
            btn.disabled = false;
        }
    }
}

// =========================================================
// BULK ACTION: PADAM MINGGU INI
// =========================================================
async function bulkDeleteByWeek() {
    const weekSelect = document.getElementById('filterMinggu');
    const weekVal = weekSelect ? weekSelect.value : 'all';
    
    // Semakan Keselamatan
    if(weekVal === 'all') {
        alert("Sila pilih minggu spesifik dahulu (Contoh: Minggu 1) untuk menggunakan fungsi padam pukal.");
        return;
    }

    if(currentDisplayedRPHIds.length === 0) {
        alert("Tiada RPH dalam minggu ini untuk dipadam.");
        return;
    }

    const confirmMsg = `AMARAN KERAS:\n\nAdakah anda pasti mahu MEMADAM SEMUA ${currentDisplayedRPHIds.length} RPH dalam MINGGU ${weekVal}?\n\nTindakan ini akan memadam data kekal dan tidak boleh dikembalikan.`;
    
    if(!confirm(confirmMsg)) return;

    const btn = document.getElementById('btnBulkDelete');
    btn.textContent = "Sedang Memadam...";
    btn.disabled = true;

    try {
        const batch = writeBatch(db);
        currentDisplayedRPHIds.forEach(id => {
            const ref = doc(db, 'rph', id);
            batch.delete(ref);
        });

        await batch.commit();
        alert(`Semua RPH Minggu ${weekVal} telah dipadam.`);
        
        // Refresh list mengikut status semasa
        const activeBtn = document.querySelector('.active-filter');
        let status = 'draft';
        if(activeBtn) {
            if(activeBtn.getAttribute('onclick').includes('hantar')) status = 'hantar';
            else if(activeBtn.getAttribute('onclick').includes('disahkan')) status = 'disahkan';
        }
        loadRPHList(status);

    } catch(e) {
        console.error(e);
        alert("Gagal memadam pukal: " + e.message);
    } finally {
        if(btn) {
            btn.textContent = "🗑️ Padam Minggu Ini";
            btn.disabled = false;
        }
    }
}

// =========================================================
// FUNGSI SOKONGAN LAIN (SAMA SEPERTI ASAL)
// =========================================================

async function deleteRPH(docId) {
    if(!confirm("Padam RPH ini?")) return;
    try { 
        await deleteDoc(doc(db, 'rph', docId)); 
        // Trigger refresh melalui event change pada dropdown (cara malas tapi berkesan)
        document.getElementById('filterMinggu').dispatchEvent(new Event('change'));
    } catch(e) { alert("Gagal: " + e.message); }
}

async function printApprovedRPH() {
    const sDate = document.getElementById('printStartDate').value;
    const eDate = document.getElementById('printEndDate').value;
    const user = auth.currentUser;

    if(!sDate || !eDate) { alert("Sila pilih Tarikh Mula dan Akhir."); return; }

    try {
        const q = query(
            collection(db, 'rph'),
            where('uid', '==', user.uid),
            where('status', '==', 'disahkan')
        );
        const snap = await getDocs(q);
        
        if(snap.empty) { alert("Tiada RPH disahkan."); return; }

        const rphToPrint = [];
        snap.forEach(doc => {
            const d = doc.data();
            if(d.tarikh >= sDate && d.tarikh <= eDate) rphToPrint.push(d);
        });
        rphToPrint.sort((a, b) => (a.tarikh > b.tarikh) ? 1 : -1);

        if(rphToPrint.length === 0) { alert("Tiada RPH dalam julat tarikh ini."); return; }

        const printWindow = window.open('', '_blank');
        let contentHtml = '';
        
        rphToPrint.forEach(rph => {
            const niceDate = rph.tarikh.split('-').reverse().join('/');
            const dayName = ['Ahad','Isnin','Selasa','Rabu','Khamis','Jumaat','Sabtu'][new Date(rph.tarikh).getDay()];
            const weekStr = rph.minggu ? `(Minggu ${rph.minggu})` : '';

            contentHtml += `
            <div class="page-break">
                <table class="rph-table">
                    <tr><th colspan="4" class="header-rph">RANCANGAN PENGAJARAN HARIAN ${weekStr}</th></tr>
                    <tr>
                        <td width="15%"><strong>Tarikh:</strong></td> <td width="35%">${niceDate}</td>
                        <td width="15%"><strong>Hari:</strong></td> <td width="35%">${dayName}</td>
                    </tr>
                    <tr>
                        <td><strong>Masa:</strong></td> <td>${rph.masa}</td>
                        <td><strong>Kelas:</strong></td> <td>${rph.kelas}</td>
                    </tr>
                    <tr><td><strong>Subjek:</strong></td> <td colspan="3">${rph.subject}</td></tr>
                    <tr><td colspan="4" class="section-title">TAJUK & SP</td></tr>
                    <tr><td colspan="4"><strong>Tajuk:</strong> ${rph.tajuk}<br><br><strong>SP:</strong><br><div class="content-text">${rph.sp}</div></td></tr>
                    <tr><td colspan="4" class="section-title">OBJEKTIF & AKTIVITI</td></tr>
                    <tr><td colspan="4"><strong>Objektif:</strong><br><div class="content-text">${rph.objektif}</div><br><strong>Aktiviti:</strong><br><div class="content-text">${rph.aktiviti}</div></td></tr>
                    <tr><td colspan="4" class="section-title">BBM & NILAI</td></tr>
                    <tr><td colspan="2"><strong>BBM:</strong> ${rph.bbm}</td><td colspan="2"><strong>Nilai:</strong> ${rph.nilai}</td></tr>
                    <tr><td colspan="4" class="section-title">REFLEKSI</td></tr>
                    <tr><td colspan="4" style="height:50px;">${rph.refleksi}</td></tr>
                    <tr><td colspan="4" class="section-title">PENGESAHAN</td></tr>
                    <tr><td colspan="4"><strong>Disemak Oleh:</strong> ${rph.penyeliaName || 'Penyelia'}<br><strong>Status:</strong> DISAHKAN</td></tr>
                </table>
                <br><hr style="border:0; border-top:1px dashed #ccc; margin-bottom:30px;">
            </div>`;
        });

        printWindow.document.write(`
            <html><head><title>Cetak RPH</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
                .rph-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #000; }
                .rph-table td, .rph-table th { border: 1px solid #000; padding: 6px; vertical-align: top; }
                .header-rph { background: #e2e8f0; text-align: center; font-size: 14px; padding: 8px; font-weight:bold; }
                .section-title { background: #f1f5f9; font-weight: bold; text-align: left; text-transform:uppercase; font-size:11px; }
                .content-text { white-space: pre-wrap; line-height: 1.4; }
                @media print { .page-break { page-break-inside: avoid; page-break-after: always; } }
            </style></head><body>
            <div style="text-align:center; margin-bottom:20px;"><h2>REKOD PENGAJARAN HARIAN</h2><p><strong>Guru:</strong> ${user.displayName || user.email}<br><strong>Tarikh:</strong> ${sDate} hingga ${eDate}</p></div>
            ${contentHtml}
            <script>window.onload = function() { window.print(); }</script></body></html>
        `);
        printWindow.document.close();
    } catch(e) { console.error(e); alert("Ralat cetakan: " + e.message); }
}

async function openEditRPH(docId) {
    if(window.switchGuruView) window.switchGuruView('view-edit-rph');

    try {
        const snap = await getDoc(doc(db, 'rph', docId));
        if(!snap.exists()) { alert("Tiada dokumen."); return; }
        const d = snap.data();

        document.getElementById('editDocId').value = docId;
        document.getElementById('eTarikh').value = d.tarikh;
        document.getElementById('eKelas').value = d.kelas + (d.minggu ? ` (M${d.minggu})` : '');
        
        document.getElementById('eMasa').value = d.masa;
        document.getElementById('eTajuk').value = d.tajuk;
        document.getElementById('eSP').value = d.sp;
        document.getElementById('eObjektif').value = d.objektif;
        document.getElementById('eAktiviti').value = d.aktiviti;
        document.getElementById('eBBM').value = d.bbm;
        document.getElementById('eNilai').value = d.nilai;
        document.getElementById('eRefleksi').value = d.refleksi || '';

        const inputs = document.querySelectorAll('#formEditRPH input, #formEditRPH textarea');
        const isEditable = (d.status === 'draft');
        inputs.forEach(input => {
            if(input.id !== 'editDocId') input.disabled = !isEditable;
        });
        const btnContainer = document.querySelector('#formEditRPH div[style*="margin-top:20px"]');
        if(btnContainer) btnContainer.style.display = isEditable ? 'flex' : 'none';

    } catch(e) { console.error(e); }
}

async function saveDraftRPH() {
    const docId = document.getElementById('editDocId').value;
    const data = getFormData();
    data.status = 'draft';
    try { await updateDoc(doc(db, 'rph', docId), data); alert("Disimpan."); } catch(e) { alert("Ralat: " + e.message); }
}

async function handleSubmitRPH(e) {
    e.preventDefault();
    if(!confirm("Hantar RPH ini?")) return;
    const docId = document.getElementById('editDocId').value;
    const data = getFormData();
    data.status = 'hantar';
    try { 
        await updateDoc(doc(db, 'rph', docId), data); 
        alert("Berjaya Dihantar!"); 
        if(window.switchGuruView) window.switchGuruView('view-sejarah');
    } catch(e) { alert("Ralat: " + e.message); }
}

function getFormData() {
    return {
        masa: document.getElementById('eMasa').value,
        tajuk: document.getElementById('eTajuk').value,
        sp: document.getElementById('eSP').value,
        objektif: document.getElementById('eObjektif').value,
        aktiviti: document.getElementById('eAktiviti').value,
        bbm: document.getElementById('eBBM').value,
        nilai: document.getElementById('eNilai').value,
        refleksi: document.getElementById('eRefleksi').value
    };
}