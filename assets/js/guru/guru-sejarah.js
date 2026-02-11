/**
 * ==========================================================================================
 * MODUL PENGURUSAN SEJARAH RPH (GURU)
 * ==========================================================================================
 * Fail: guru-sejarah.js
 * * FUNGSI UTAMA:
 * 1. Memaparkan senarai sejarah RPH berdasarkan julat tarikh.
 * 2. Melakukan tindakan pukal (Cetak, Padam, Hantar).
 * 3. Membolehkan pengeditan RPH berstatus 'draft'.
 * 4. Menyemak profil guru di koleksi sekolah untuk mendapatkan maklumat Penyelia.
 * * NOTA KEMASKINI:
 * - Ditambah: Paparan Nama Penyelia (verifiedBy) dalam modal dan cetakan.
 * ==========================================================================================
 */

import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc, 
    writeBatch, 
    getDoc, 
    Timestamp,
    collectionGroup 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db, auth } from '../config.js';

// =========================================================================
// PEMBIAYAK GLOBAL (GLOBAL VARIABLES)
// =========================================================================
let currentRPHList = [];        // Menyimpan senarai RPH hasil carian
let selectedRPHIds = new Set(); // Menyimpan ID rekod yang ditanda (checkbox)
let teacherData = null;         // Menyimpan data profil guru yang dihantar dari main.js

// =========================================================================
// 1. INIT & LAYOUT UTAMA
// =========================================================================

/**
 * Memulakan modul sejarah RPH.
 * Dipanggil oleh fail utama (guru-main.js).
 */
export function initSejarahModule(tData) {
    // Simpan data profil guru ke dalam pembolehubah global
    teacherData = tData;
    
    // Suntik gaya CSS ke dalam dokumen
    injectSejarahStyles();
    
    // Bina paparan modal utama
    renderLayout();
}

/**
 * Membina struktur HTML bagi modal Sejarah RPH.
 * Paparan dikekalkan mengikut reka bentuk asal.
 */
function renderLayout() {
    // Bersihkan modal lama jika wujud untuk mengelakkan ID bertindih
    if(document.getElementById('sejarahModal')) {
        document.getElementById('sejarahModal').remove();
    }

    const html = `
    <div id="sejarahModal" class="modal-overlay">
        <div class="modal-content slide-up">
            
            <div class="modal-header-modern">
                <div class="header-info">
                    <span class="sub-label">MODUL PENGURUSAN</span>
                    <h2>📂 Sejarah & Status RPH</h2>
                </div>
                <button class="close-modern" onclick="document.getElementById('sejarahModal').remove()">✕</button>
            </div>

            <div class="filter-wrapper">
                <div class="filter-bar">
                    <div class="filter-inputs">
                        <div class="input-group">
                            <label>Dari Tarikh</label>
                            <input type="date" id="filterStart">
                        </div>
                        <div class="input-group">
                            <label>Hingga Tarikh</label>
                            <input type="date" id="filterEnd">
                        </div>
                        <button id="btnSearchRPH" class="btn-solid" style="margin-bottom:2px">🔍 Cari Rekod</button>
                    </div>
                    
                    <div class="action-buttons" style="display:flex; gap:10px;">
                        <button id="btnBulkPrint" class="btn-info" style="display:none">
                            🖨️ Cetak (<span id="countBulkPrint">0</span>)
                        </button>
                        <button id="btnBulkDelete" class="btn-danger" style="display:none">
                            🗑️ Padam (<span id="countBulkDel">0</span>)
                        </button>
                        <button id="btnBulkSubmit" class="btn-warning" style="display:none">
                            📤 Hantar (<span id="countBulkSub">0</span>)
                        </button>
                    </div>
                </div>
            </div>

            <div class="modal-body-modern" id="rphListContainer">
                <div class="empty-state">
                    <div style="font-size: 3rem;">📅</div>
                    <p>Sila pilih julat tarikh dan tekan 'Cari Rekod'.</p>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    // Tetapkan tarikh lalai kepada hari ini
    document.getElementById('filterStart').valueAsDate = new Date();
    document.getElementById('filterEnd').valueAsDate = new Date();

    // Pendaftaran Event Listeners
    document.getElementById('btnSearchRPH').onclick = loadRPHList;
    document.getElementById('btnBulkSubmit').onclick = submitBulkRPH;
    document.getElementById('btnBulkDelete').onclick = deleteBulkRPH;
    document.getElementById('btnBulkPrint').onclick = printBulkRPH;
}

// =========================================================================
// 2. LOGIK MUAT TURUN DATA (FIREBASE)
// =========================================================================

/**
 * Mengambil data RPH dari Firestore berdasarkan email guru dan julat tarikh.
 */
async function loadRPHList() {
    const startStr = document.getElementById('filterStart').value;
    const endStr = document.getElementById('filterEnd').value;
    const container = document.getElementById('rphListContainer');

    // Validasi input tarikh
    if(!startStr || !endStr) {
        alert("Sila pilih tarikh mula dan akhir.");
        return;
    }

    // Pastikan data profil guru tersedia
    if (!teacherData || !teacherData.email) {
        alert("Ralat: Data profil guru tidak lengkap.");
        return;
    }

    container.innerHTML = '<div class="loading">Sedang memuatkan data...</div>';
    
    // Kosongkan pilihan pukal lama
    selectedRPHIds.clear();
    updateBulkButton();

    try {
        // Query rekod RPH milik guru semasa
        const q = query(collection(db, 'records'), where('email', '==', teacherData.email));
        const snapshot = await getDocs(q);
        const allRPH = [];
        
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            // Kenalpasti tarikh rekod daripada pelbagai kemungkinan field name
            const tarikhRekod = data.dateISO || data.date || data.tarikh;

            if (tarikhRekod) {
                allRPH.push({ id: docSnap.id, ...data, dateISO: tarikhRekod });
            }
        });

        // Tapis mengikut julat tarikh yang dipilih pengguna
        currentRPHList = allRPH.filter(r => r.dateISO >= startStr && r.dateISO <= endStr);
        
        // Susun mengikut tarikh terbaru ke terlama
        currentRPHList.sort((a, b) => (b.dateISO > a.dateISO ? 1 : -1));

        // Paparkan ke dalam jadual
        renderTable(currentRPHList);

    } catch (error) {
        console.error("Error loading RPH:", error);
        container.innerHTML = `<div class="empty-state" style="color:red">Ralat: ${error.message}</div>`;
    }
}

// =========================================================================
// 3. PENJANAAN JADUAL (UI TABLE)
// =========================================================================

/**
 * Memaparkan data RPH ke dalam bentuk jadual HTML.
 */
function renderTable(list) {
    const container = document.getElementById('rphListContainer');
    
    if (list.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 3rem;">📭</div>
                <p>Tiada rekod RPH dijumpai dalam julat tarikh ini.</p>
            </div>`;
        return;
    }

    let rows = list.map(item => {
        const isDraft = item.status === 'draft';
        
        // Tentukan kelas CSS dan teks bagi lencana status
        let badgeClass = 'bg-gray'; 
        let badgeText = 'DRAFT';
        if(item.status === 'dihantar') { badgeClass = 'bg-blue'; badgeText = 'DIHANTAR'; }
        else if(item.status === 'disahkan') { badgeClass = 'bg-green'; badgeText = 'DISAHKAN'; }

        // Bina HTML Checkbox
        const checkboxHtml = `<input type="checkbox" class="rph-check" value="${item.id}" onchange="window.handleCheck(this)">`;

        // Butang Padam hanya muncul untuk rekod berstatus DRAFT
        const deleteBtn = isDraft 
            ? `<button class="action-btn delete-btn" onclick="window.deleteRPH('${item.id}')" title="Padam"><span class="icon">🗑️</span></button>` 
            : '';

        // Format paparan tarikh yang lebih kemas
        const dateObj = new Date(item.dateISO);
        const day = dateObj.getDate();
        const month = dateObj.toLocaleDateString('ms-MY', { month: 'short' });

        return `
        <tr class="rph-row">
            <td class="check-col">${checkboxHtml}</td>
            <td>
                <div class="date-box">
                    <span class="day">${day}</span>
                    <span class="month">${month}</span>
                </div>
            </td>
            <td>
                <div class="subject-title">${item.subject}</div>
                <div class="class-subtitle">${item.className} &bull; Minggu ${item.week || '-'}</div>
            </td>
            <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
            <td>
                <div class="action-group">
                    <button class="action-btn" onclick="window.printSingleRPH('${item.id}')" title="Cetak">
                        <span class="icon">🖨️</span>
                    </button>
                    <button class="action-btn edit-btn" onclick="window.openEditRPH('${item.id}')" title="Buka">
                        <span class="icon">📂</span>
                    </button>
                    ${deleteBtn}
                </div>
            </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
        <div class="table-responsive">
            <table class="modern-table">
                <thead>
                    <tr>
                        <th width="50"><input type="checkbox" id="checkAll" onclick="window.toggleAll(this)"></th>
                        <th width="80">Tarikh</th>
                        <th>Butiran Kelas</th>
                        <th width="120">Status</th>
                        <th width="180" style="text-align:right">Tindakan</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

// =========================================================================
// 4. PENGURUSAN CHECKBOX & TINDAKAN PUKAL
// =========================================================================

/**
 * Menguruskan pemilihan individu menggunakan checkbox.
 */
window.handleCheck = (el) => {
    if(el.checked) {
        selectedRPHIds.add(el.value);
    } else {
        selectedRPHIds.delete(el.value);
    }
    updateBulkButton();
};

/**
 * Menguruskan fungsi "Pilih Semua" (Select All).
 */
window.toggleAll = (source) => {
    const checkboxes = document.querySelectorAll('.rph-check');
    checkboxes.forEach(cb => {
        cb.checked = source.checked;
        if(source.checked) {
            selectedRPHIds.add(cb.value);
        } else {
            selectedRPHIds.delete(cb.value);
        }
    });
    updateBulkButton();
};

/**
 * Mengemaskini paparan butang tindakan pukal berdasarkan jumlah rekod terpilih.
 */
function updateBulkButton() {
    const btnSub = document.getElementById('btnBulkSubmit');
    const countSub = document.getElementById('countBulkSub');
    const btnDel = document.getElementById('btnBulkDelete');
    const countDel = document.getElementById('countBulkDel');
    const btnPrint = document.getElementById('btnBulkPrint');
    const countPrint = document.getElementById('countBulkPrint');
    
    if(selectedRPHIds.size > 0) {
        // Papar butang jika ada yang dipilih
        btnSub.style.display = 'inline-block';
        btnDel.style.display = 'inline-block';
        btnPrint.style.display = 'inline-block';
        
        countSub.textContent = selectedRPHIds.size;
        countDel.textContent = selectedRPHIds.size;
        countPrint.textContent = selectedRPHIds.size;
    } else {
        // Sembunyikan butang jika tiada yang dipilih
        btnSub.style.display = 'none';
        btnDel.style.display = 'none';
        btnPrint.style.display = 'none';
    }
}

// =========================================================================
// 5. MODAL EDITOR (BORANG RPH) - DIKEMASKINI DENGAN NAMA PENYELIA
// =========================================================================

/**
 * Membuka modal pengeditan bagi rekod RPH yang dipilih.
 * * PERUBAHAN: Memaparkan Nama Penyelia (verifiedBy) dalam kotak hijau pengesahan.
 */
window.openEditRPH = (id) => {
    const rph = currentRPHList.find(r => r.id === id);
    if(!rph) return;

    // Tentukan Status
    const isDraft = rph.status === 'draft' || !rph.status;
    const isVerified = rph.status === 'disahkan';
    
    // Jika bukan draft, kunci borang (Read Only)
    const isLocked = !isDraft;
    const readOnly = isLocked ? 'readonly disabled' : '';
    const lockClass = isLocked ? 'input-locked' : '';

    // Format tarikh pengesahan
    let verifyDate = '-';
    if (rph.verifiedAt) {
        verifyDate = rph.verifiedAt.toDate ? rph.verifiedAt.toDate().toLocaleDateString('ms-MY') : rph.verifiedAt;
    }

    // --- DAPATKAN NAMA PENYELIA ---
    const namaPenyelia = rph.verifiedBy || "Penyelia";

    const html = `
    <div id="editModal" class="modal-overlay" style="z-index:2100">
        <div class="modal-content slide-up">
            <div class="modal-header-modern">
                <div class="header-info">
                    <span class="sub-label">RPH ${rph.dateISO || '-'}</span>
                    <h2>${rph.subject} - ${rph.className}</h2>
                </div>
                <button class="close-modern" onclick="document.getElementById('editModal').remove()">✕</button>
            </div>

            <div class="modal-body-modern">
                
                ${isLocked && !isVerified ? `<div class="banner-locked" style="background:#fef3c7; color:#92400e; padding:10px; border-radius:6px; margin-bottom:15px; border:1px solid #fcd34d;">🔒 RPH ini telah dihantar dan sedang menunggu semakan.</div>` : ''}
                
                ${isVerified ? `
                <div style="background:#f0fdf4; border:1px solid #16a34a; padding:20px; border-radius:10px; margin-bottom:25px;">
                    <h3 style="margin-top:0; color:#166534; border-bottom:1px solid #16a34a; padding-bottom:10px;">
                        ✅ Disahkan oleh Penyelia
                    </h3>
                    
                    <div style="margin-bottom:15px;">
                        <strong style="color:#15803d; font-size:0.9rem;">Ulasan:</strong>
                        <div style="background:white; padding:12px; border-radius:6px; border:1px solid #bbf7d0; margin-top:5px; color:#333;">
                            ${rph.ulasan || "Tiada ulasan khusus."}
                        </div>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:end;">
                        <div>
                            <strong style="color:#15803d; font-size:0.9rem;">Tandatangan Digital:</strong><br>
                            ${rph.signature 
                                ? `<img src="${rph.signature}" style="height:80px; border:1px dashed #166534; background:white; padding:5px; margin-top:5px; border-radius:4px;">` 
                                : '<span style="color:#dc2626; font-style:italic;">Tiada tandatangan.</span>'}
                        </div>
                        <div style="text-align:right; color:#166534; font-size:0.85rem;">
                            Disahkan Oleh: <b>${namaPenyelia}</b><br>
                            Tarikh: <b>${verifyDate}</b>
                        </div>
                    </div>
                </div>
                ` : ''}

                <div class="form-section">
                    <label class="section-label">Tajuk / Tema</label>
                    <input type="text" id="eTajuk" class="modern-input ${lockClass}" value="${rph.tajuk || ''}" ${readOnly}>
                </div>
                <div class="form-grid-2">
                    <div class="form-section">
                        <label class="section-label">Standard Kandungan (SK)</label>
                        <textarea id="eSK" class="modern-textarea ${lockClass}" rows="5" ${readOnly}>${rph.sk || ''}</textarea>
                    </div>
                    <div class="form-section">
                        <label class="section-label">Standard Pembelajaran (SP)</label>
                        <textarea id="eSP" class="modern-textarea ${lockClass}" rows="5" ${readOnly}>${rph.sp || ''}</textarea>
                    </div>
                </div>
                <div class="form-section">
                    <label class="section-label">Objektif Pembelajaran</label>
                    <textarea id="eObj" class="modern-textarea ${lockClass}" rows="3" ${readOnly}>${rph.objektif || ''}</textarea>
                </div>
                <div class="form-section">
                    <label class="section-label">Aktiviti Pembelajaran</label>
                    <textarea id="eAkt" class="modern-textarea ${lockClass}" rows="8" ${readOnly}>${rph.aktiviti || ''}</textarea>
                </div>
                <div class="form-section highlight-section">
                    <label class="section-label">Refleksi Guru</label>
                    <textarea id="eRef" class="modern-textarea ${lockClass}" rows="3" ${readOnly}>${rph.refleksi || ''}</textarea>
                </div>
            </div>

            <div class="modal-footer-modern">
                <div class="footer-left">
                    ${isVerified 
                        ? '<span class="status-dot sent" style="background:#16a34a;"></span> <b style="color:#16a34a;">DISAHKAN</b>' 
                        : (isLocked 
                            ? '<span class="status-dot sent"></span> <b>DIHANTAR</b>' 
                            : '<span class="status-dot draft"></span> <b>DRAFT</b>'
                          )
                    }
                </div>
                
                <div class="footer-right">
                    <button class="btn-ghost" onclick="window.printSingleRPH('${rph.id}')" style="margin-right:10px;">🖨️ Cetak</button>

                    ${!isLocked ? `
                        <button class="btn-ghost" onclick="window.saveSingleRPH('${rph.id}')">Simpan</button>
                        <button class="btn-solid" onclick="window.submitSingleRPH('${rph.id}')">Hantar 🚀</button>
                    ` : `
                        <button class="btn-ghost" onclick="document.getElementById('editModal').remove()">Tutup</button>
                    `}
                </div>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', html);
};

// =========================================================================
// 6. TINDAKAN (SIMPAN, HANTAR, PADAM) - LOGIK KEMASKINI
// =========================================================================

/**
 * Menyimpan data RPH ke Firestore tanpa menukar status (Kekal Draft).
 */
window.saveSingleRPH = async (id) => {
    const newData = {
        tajuk: document.getElementById('eTajuk').value,
        sk: document.getElementById('eSK').value,
        sp: document.getElementById('eSP').value,
        objektif: document.getElementById('eObj').value,
        aktiviti: document.getElementById('eAkt').value,
        refleksi: document.getElementById('eRef').value,
    };
    try { 
        await updateDoc(doc(db, 'records', id), newData); 
        alert("Disimpan!"); 
        loadRPHList(); 
    } catch (e) { 
        alert("Ralat: " + e.message); 
    }
};

/**
 * FUNGSI KEMASKINI: Menghantar satu RPH ke Penyelia.
 */
window.submitSingleRPH = async (id) => {
    if(!confirm("Hantar RPH ini? Ia tidak boleh diedit selepas ini.")) return;

    try {
        const user = auth.currentUser;
        if (!user) throw new Error("Sesi log masuk tamat. Sila log masuk semula.");

        const userEmail = user.email.toLowerCase();
        
        // 1. Dapatkan maklumat penyelia
        const teachersRef = collectionGroup(db, 'teachers');
        const q = query(teachersRef, where('email', '==', userEmail));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert("Ralat: Rekod guru tidak dijumpai.");
            return;
        }

        const profDoc = querySnapshot.docs[0];
        const profData = profDoc.data();
        const schoolId = profData.schoolId;
        const penyeliaId = profData.penyeliaEmail || profData.penyeliaId;

        if (!penyeliaId) {
            alert("Gagal: Penyelia belum ditetapkan untuk anda.");
            return;
        }

        // 2. Kemaskini dokumen RPH
        await updateDoc(doc(db, 'records', id), { 
            status: 'dihantar', 
            submittedAt: Timestamp.now(),
            penyeliaId: penyeliaId.toLowerCase(),
            schoolId: schoolId
        });

        alert("Berjaya dihantar kepada " + penyeliaId); 
        
        // Tutup modal
        const editModal = document.getElementById('editModal');
        if(editModal) editModal.remove(); 
        
        loadRPHList();

    } catch (e) { 
        console.error("[SubmitRPH]", e);
        alert("Ralat Semasa Menghantar: " + e.message); 
    }
};

/**
 * Memadam satu rekod RPH.
 */
window.deleteRPH = async (id) => {
    if(!confirm("Padam RPH ini? Tindakan ini tidak boleh diundur.")) return;
    try { 
        await deleteDoc(doc(db, 'records', id)); 
        alert("RPH telah dipadam.");
        loadRPHList(); 
    } catch (e) { 
        console.error("[DeleteRPH]", e);
        alert("Gagal memadam: " + e.message); 
    }
};

/**
 * FUNGSI KEMASKINI: Menghantar banyak RPH secara pukal.
 */
async function submitBulkRPH() {
    const ids = Array.from(selectedRPHIds);
    if(ids.length === 0) {
        alert("Sila pilih RPH untuk dihantar.");
        return;
    }
    
    // Tapis hanya yang 'draft' sahaja
    const drafts = ids.filter(id => {
        const r = currentRPHList.find(x => x.id === id);
        return r && (r.status === 'draft' || !r.status);
    });

    if(drafts.length === 0) { 
        alert("Tiada RPH berstatus 'Draft' dipilih."); 
        return; 
    }

    if(!confirm(`Hantar ${drafts.length} RPH terpilih kepada penyelia?`)) return;

    try {
        const user = auth.currentUser;
        const userEmail = user.email.toLowerCase();

        // 1. Dapatkan profil guru & penyelia
        const teachersRef = collectionGroup(db, 'teachers');
        const q = query(teachersRef, where('email', '==', userEmail));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert("Ralat: Rekod profil anda tidak dijumpai.");
            return;
        }

        const profData = querySnapshot.docs[0].data();
        const penyeliaId = profData.penyeliaEmail || profData.penyeliaId;
        const schoolId = profData.schoolId;

        if (!penyeliaId) {
            alert("Gagal: Penyelia belum ditetapkan untuk akaun anda.");
            return;
        }

        // 2. Gunakan WriteBatch untuk kemaskini pukal
        const batch = writeBatch(db);
        const now = Timestamp.now();

        drafts.forEach(id => {
            const ref = doc(db, 'records', id);
            batch.update(ref, { 
                status: 'dihantar', 
                submittedAt: now,
                penyeliaId: penyeliaId.toLowerCase(),
                schoolId: schoolId
            });
        });

        await batch.commit();
        alert(`Berjaya! ${drafts.length} RPH telah dihantar kepada ${penyeliaId}.`); 
        
        selectedRPHIds.clear(); 
        loadRPHList();

    } catch (e) { 
        console.error("[BulkSubmit]", e);
        alert("Gagal Menghantar Pukal: " + e.message); 
    }
}

/**
 * Memadam banyak rekod RPH secara pukal.
 * Hanya rekod berstatus 'draft' sahaja yang dibenarkan untuk dipadam.
 */
async function deleteBulkRPH() {
    const ids = Array.from(selectedRPHIds);
    if(ids.length === 0) return;
    
    const drafts = ids.filter(id => {
        const r = currentRPHList.find(x => x.id === id);
        return r && r.status === 'draft';
    });
    
    if(drafts.length === 0) { 
        alert("Hanya RPH berstatus 'Draft' sahaja yang boleh dipadam."); 
        return; 
    }
    
    if(!confirm(`AMARAN: Adakah anda pasti mahu MEMADAM ${drafts.length} RPH ini secara kekal?`)) return;

    try {
        const batch = writeBatch(db);
        drafts.forEach(id => {
            const ref = doc(db, 'records', id);
            batch.delete(ref);
        });
        await batch.commit();
        alert("Rekod terpilih berjaya dipadam!"); 
        selectedRPHIds.clear(); 
        loadRPHList();
    } catch (e) { 
        alert("Gagal memadam: " + e.message); 
    }
}

// =========================================================================
// 7. ENJIN PENCETAKAN (PRINTING ENGINE) - DIKEMASKINI DENGAN NAMA PENYELIA
// =========================================================================

/**
 * Mencetak satu rekod RPH.
 */
window.printSingleRPH = (id) => {
    const rph = currentRPHList.find(r => r.id === id);
    if(rph) {
        generateAndPrint([rph]);
    }
};

/**
 * Mencetak banyak rekod RPH secara pukal dalam satu dokumen PDF/Cetak.
 */
async function printBulkRPH() {
    const ids = Array.from(selectedRPHIds);
    if(ids.length === 0) return;

    // Kumpulkan objek data penuh bagi setiap ID yang dipilih
    const rphToPrint = ids.map(id => currentRPHList.find(r => r.id === id)).filter(Boolean);
    
    // Susun mengikut tarikh bagi memudahkan rujukan
    rphToPrint.sort((a, b) => (a.dateISO > b.dateISO ? 1 : -1));

    generateAndPrint(rphToPrint);
}

/**
 * Menjana tetingkap cetakan HTML berdasarkan senarai rekod RPH.
 * * PERUBAHAN: Ditambah Nama Penyelia pada bahagian footer.
 */
function generateAndPrint(rphList) {
    if(rphList.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) { 
        alert("Pop-up disekat oleh pelayar anda. Sila benarkan pop-up untuk mencetak."); 
        return; 
    }

    let contentHTML = '';

    rphList.forEach(rph => {
        const d = new Date(rph.dateISO);
        const dateStr = d.toLocaleDateString('ms-MY', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        const displayTajuk = rph.tajuk || rph.title || rph.tema || '-';
        const namaPenyelia = rph.verifiedBy || "Penyelia"; // Nama Penyelia

        // Logik Paparan Footer
        let footerHTML = '';
        
        if (rph.status === 'disahkan') {
            const verifyDate = rph.verifiedAt && rph.verifiedAt.toDate 
                ? rph.verifiedAt.toDate().toLocaleDateString('ms-MY') 
                : (rph.verifiedAt || '-');
            
            const sigImg = rph.signature 
                ? `<img src="${rph.signature}" style="height:60px; max-width:180px; margin:5px auto; display:block;">` 
                : '<div style="height:40px; text-align:center; color:red;">(Tiada Tanda Tangan)</div>';

            footerHTML = `
                <div class="verification-box">
                    <div class="v-header">PENGESAHAN PENYELIA</div>
                    <table class="v-table">
                        <tr>
                            <td class="v-label">Ulasan:</td>
                            <td class="v-content" style="font-style:italic;">"${rph.ulasan || 'Disahkan tanpa ulasan.'}"</td>
                        </tr>
                        <tr>
                            <td class="v-label">Tandatangan:</td>
                            <td class="v-content" style="text-align:center;">
                                ${sigImg}
                                <div style="font-size:10px;">Tarikh: ${verifyDate}</div>
                            </td>
                        </tr>
                        <tr>
                            <td class="v-label">Disahkan Oleh:</td>
                            <td class="v-content" style="font-weight:bold; text-transform:uppercase;">${namaPenyelia}</td>
                        </tr>
                    </table>
                </div>
            `;
        } else {
            footerHTML = `
                <div class="footer-sign">
                    <div>Disediakan oleh:<br><br><br>.........................................<br>(${teacherData.name})</div>
                    <div>Disahkan oleh:<br><br><br>.........................................<br>(Guru Besar / Penolong Kanan)</div>
                </div>
            `;
        }

        contentHTML += `
        <div class="page-container">
            <div class="rph-header">
                <h2>RANCANGAN PENGAJARAN HARIAN</h2>
                <p><strong>Nama Guru:</strong> ${teacherData.name ? teacherData.name.toUpperCase() : 'TIADA NAMA'}</p>
                <p><strong>Minggu:</strong> ${rph.week || '-'} &nbsp;|&nbsp; <strong>Tarikh:</strong> ${dateStr}</p>
            </div>

            <table class="rph-table">
                <tr>
                    <td class="label">Mata Pelajaran</td>
                    <td>${rph.subject || '-'}</td>
                    <td class="label">Kelas</td>
                    <td>${rph.className || '-'}</td>
                </tr>
                <tr>
                    <td class="label">Tajuk / Tema</td>
                    <td colspan="3">${displayTajuk}</td>
                </tr>
            </table>

            <div class="section-box">
                <h3>Standard Kandungan</h3>
                <div class="content">${(rph.sk || '').replace(/\n/g, '<br>')}</div>
            </div>

            <div class="section-box">
                <h3>Standard Pembelajaran</h3>
                <div class="content">${(rph.sp || '').replace(/\n/g, '<br>')}</div>
            </div>

            <div class="section-box">
                <h3>Objektif Pembelajaran</h3>
                <div class="content">${(rph.objektif || '').replace(/\n/g, '<br>')}</div>
            </div>

            <div class="section-box">
                <h3>Aktiviti Pembelajaran</h3>
                <div class="content">${(rph.aktiviti || '').replace(/\n/g, '<br>')}</div>
            </div>

            <div class="section-box">
                <h3>Refleksi / Catatan</h3>
                <div class="content">${(rph.refleksi || 'Tiada catatan refleksi disediakan.').replace(/\n/g, '<br>')}</div>
            </div>

            ${footerHTML}
        </div>
        `;
    });

    const fullHTML = `
    <html>
    <head>
        <title>Cetak RPH</title>
        <style>
            @page { margin: 0; size: A4; }
            body { font-family: "Arial", sans-serif; background: #eee; margin: 0; padding: 20px; }
            .page-container {
                background: white; width: 210mm; min-height: 297mm;
                margin: 0 auto 20px auto; padding: 15mm; box-sizing: border-box;
                box-shadow: 0 0 10px rgba(0,0,0,0.1); page-break-after: always;
                position: relative; border: 1px solid #ccc;
            }
            .rph-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid black; padding-bottom: 10px; }
            .rph-header h2 { margin: 0 0 5px 0; text-transform: uppercase; font-size: 18px; }
            .rph-header p { margin: 2px 0; font-size: 13px; }
            
            .rph-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 13px; }
            .rph-table td { border: 1px solid #000; padding: 6px; }
            .rph-table .label { background: #f0f0f0; font-weight: bold; width: 140px; }

            .section-box { margin-bottom: 12px; }
            .section-box h3 { background: #e0e0e0; padding: 4px 10px; margin: 0; font-size: 13px; border: 1px solid #000; border-bottom: none; font-weight: bold; text-transform: uppercase; }
            .section-box .content { border: 1px solid #000; padding: 10px; font-size: 13px; min-height: 35px; white-space: pre-wrap; line-height: 1.5; color: #111; }

            /* Footer Styles */
            .footer-sign { display: flex; justify-content: space-between; margin-top: 40px; font-size: 13px; }
            .footer-sign div { width: 45%; text-align: center; }

            .verification-box { margin-top: 30px; border: 2px solid #333; page-break-inside: avoid; }
            .v-header { background: #f4f4f4; text-align: center; font-weight: bold; padding: 5px; border-bottom: 1px solid #333; font-size: 13px; }
            .v-table { width: 100%; border-collapse: collapse; font-size: 13px; }
            .v-table td { padding: 8px; border: 1px solid #ddd; vertical-align: middle; }
            .v-label { width: 130px; font-weight: bold; background: #fafafa; border-right: 1px solid #333; }

            @media print {
                body { background: white; padding: 0; }
                .page-container { box-shadow: none; margin: 0; width: 100%; border: none; }
                button { display: none; }
            }
        </style>
    </head>
    <body>
        ${contentHTML}
        <script>
            window.onload = function() { 
                window.print(); 
                // setTimeout(function() { window.close(); }, 500);
            }
        </script>
    </body>
    </html>
    `;

    printWindow.document.write(fullHTML);
    printWindow.document.close();
}

// =========================================================================
// 8. PENGURUSAN GAYA (STYLES) - KEKAL SAMA SEPERTI ASAL
// =========================================================================

/**
 * Menyuntik CSS khusus bagi modul Sejarah ke dalam bahagian Head dokumen.
 */
function injectSejarahStyles() {
    if(document.getElementById('sejarah-css-v2')) return;
    const style = document.createElement('style');
    style.id = 'sejarah-css-v2';
    style.innerHTML = `
        /* MODAL & LAYOUT UTAMA */
        .modal-overlay { 
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); 
            z-index: 2000; display: flex; justify-content: center; 
            align-items: flex-end; animation: fadeIn 0.2s ease-out; 
        }
        .modal-content { 
            background: #f8fafc; width: 100%; height: 92%; max-width: 1050px; 
            border-radius: 20px 20px 0 0; display: flex; flex-direction: column; 
            box-shadow: 0 -10px 40px rgba(0,0,0,0.2); 
            animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); 
        }

        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        /* HEADER */
        .modal-header-modern { 
            padding: 15px 25px; background: white; border-bottom: 1px solid #e2e8f0; 
            display: flex; justify-content: space-between; align-items: center; 
            border-radius: 20px 20px 0 0; 
        }
        .header-info h2 { margin: 0; font-size: 1.25rem; color: #1e293b; font-weight: 700; }
        .sub-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; font-weight: 800; }
        .close-modern { background: none; border: none; font-size: 1.6rem; color: #94a3b8; cursor: pointer; padding: 5px; }
        .close-modern:hover { color: #ef4444; }

        /* BODY & FORM */
        .modal-body-modern { flex: 1; overflow-y: auto; padding: 20px 25px; display: flex; flex-direction: column; gap: 15px; }
        .modal-footer-modern { 
            padding: 15px 25px; background: white; border-top: 1px solid #e2e8f0; 
            display: flex; justify-content: space-between; align-items: center; 
        }

        /* FILTER BAR */
        .filter-wrapper { padding: 0 25px; margin-top: 20px; }
        .filter-bar { 
            background: white; padding: 15px; border-radius: 12px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; 
            flex-wrap: wrap; gap: 15px; align-items: flex-end; 
            justify-content: space-between; border: 1px solid #e2e8f0; 
        }
        .filter-inputs { display: flex; gap: 12px; align-items: flex-end; }
        .input-group { display: flex; flex-direction: column; gap: 4px; }
        .input-group label { font-size: 0.75rem; font-weight: 700; color: #64748b; }
        .input-group input { 
            padding: 8px 12px; border: 1px solid #cbd5e1; 
            border-radius: 6px; font-size: 0.9rem; outline: none; 
        }
        .input-group input:focus { border-color: #4f46e5; box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1); }

        /* GRID & INPUTS */
        .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .section-label { display: block; font-size: 0.8rem; font-weight: 700; color: #475569; margin-bottom: 6px; }
        .modern-input, .modern-textarea { 
            width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; 
            border-radius: 8px; font-size: 0.95rem; color: #334155; 
            background: white; font-family: inherit; box-sizing: border-box; 
            line-height: 1.5;
        }
        .modern-input:focus, .modern-textarea:focus { border-color: #6366f1; outline: none; background: #fff; }
        .input-locked { background: #f8fafc; color: #64748b; cursor: not-allowed; border-color: #e2e8f0; }
        .banner-locked { 
            background: #fff7ed; color: #c2410c; padding: 10px 15px; 
            border-radius: 8px; border: 1px solid #ffedd5; 
            font-size: 0.85rem; font-weight: 600; margin-bottom: 10px;
        }

        /* BUTTONS */
        .btn-solid { background: #4f46e5; color: white; border: none; padding: 9px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        .btn-solid:hover { background: #4338ca; }
        .btn-ghost { background: transparent; color: #475569; border: 1px solid #cbd5e1; padding: 9px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; margin-right: 8px; }
        .btn-ghost:hover { background: #f1f5f9; }
        
        .btn-warning { background: #f59e0b; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        .btn-warning:hover { background: #d97706; }
        .btn-danger { background: #ef4444; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; }
        .btn-danger:hover { background: #dc2626; }
        .btn-info { background: #0ea5e9; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; }

        /* TABLE */
        .table-responsive { overflow-x: auto; border-radius: 12px; border: 1px solid #e2e8f0; background: white; margin-top: 5px; }
        .modern-table { width: 100%; border-collapse: collapse; }
        .modern-table th { background: #f8fafc; padding: 12px 15px; text-align: left; font-size: 0.7rem; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; letter-spacing: 0.5px; }
        .modern-table td { padding: 14px 15px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .rph-row:hover { background: #fafafa; }

        /* DATE BOX */
        .date-box { 
            display: flex; flex-direction: column; align-items: center; 
            justify-content: center; background: #eff6ff; color: #1d4ed8; 
            padding: 5px 8px; border-radius: 8px; width: 45px; 
        }
        .date-box .day { font-size: 1.1rem; font-weight: 800; line-height: 1; }
        .date-box .month { font-size: 0.65rem; text-transform: uppercase; font-weight: 700; margin-top: 2px; }
        
        .subject-title { font-weight: 700; color: #1e293b; font-size: 0.95rem; }
        .class-subtitle { color: #64748b; font-size: 0.8rem; margin-top: 2px; font-weight: 500; }
        
        /* STATUS */
        .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.5px; }
        .bg-gray { background: #f1f5f9; color: #475569; }
        .bg-blue { background: #e0e7ff; color: #4338ca; }
        .bg-green { background: #dcfce7; color: #15803d; }

        /* ACTION BUTTONS */
        .action-group { display: flex; gap: 6px; justify-content: flex-end; }
        .action-btn { 
            display: flex; align-items: center; justify-content: center; 
            width: 34px; height: 34px; border: 1px solid #e2e8f0; 
            background: white; border-radius: 8px; cursor: pointer; 
            color: #475569; transition: 0.2s; 
        }
        .action-btn:hover { border-color: #6366f1; color: #4338ca; background: #eef2ff; transform: translateY(-1px); }
        .delete-btn:hover { border-color: #ef4444; color: #b91c1c; background: #fef2f2; }
        
        /* EMPTY & LOADING */
        .empty-state { text-align: center; padding: 50px 20px; color: #94a3b8; }
        .loading { text-align: center; padding: 30px; color: #4f46e5; font-weight: 600; }
        
        .status-dot { height: 9px; width: 9px; border-radius: 50%; display: inline-block; margin-right: 6px; }
        .status-dot.draft { background: #94a3b8; }
        .status-dot.sent { background: #22c55e; }
        
        /* FORM SECTIONS */
        .form-section { margin-bottom: 12px; }
        .highlight-section { background: #fff; padding: 10px; border-radius: 10px; border: 1px solid #e0e7ff; }

        /* CHECKBOX */
        .rph-check { width: 17px; height: 17px; cursor: pointer; accent-color: #4f46e5; }
    `;
    document.head.appendChild(style);
}