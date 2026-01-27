// assets/js/admin/rph-review.js

import { db, auth } from '../config.js';
import { 
  collection, query, where, getDocs, doc, updateDoc, orderBy, Timestamp, writeBatch, getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Variable global untuk simpan data guru (supaya tak perlu query berulang kali)
let teachersMap = {};

export async function loadRphReview() {
    const content = document.getElementById('content');
    
    // 1. Dapatkan Info User Semasa (Role & UID)
    const currentUser = auth.currentUser;
    if (!currentUser) return; // Safety check

    const userRole = localStorage.getItem('userRole'); // 'superadmin' atau 'admin'

    // UI Header & Toolbar & Modal CSS
    content.innerHTML = `
        <style>
            .review-header-box { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; flex-wrap: wrap; gap: 10px; }
            .btn-back { background: #64748b; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; }
            
            /* Bulk Action Bar */
            .bulk-actions { display: flex; align-items: center; gap: 15px; background: #f8fafc; padding: 10px 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
            .btn-bulk-approve { background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 8px; opacity: 0.5; pointer-events: none; transition: 0.3s; }
            .btn-bulk-approve.active { opacity: 1; pointer-events: auto; box-shadow: 0 2px 5px rgba(16, 185, 129, 0.3); }
            
            /* Card Styles */
            .review-card { background: white; padding: 20px; border-radius: 10px; margin-bottom: 15px; border-left: 6px solid #f59e0b; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: 0.2s; }
            .review-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .card-top { display: flex; align-items: flex-start; gap: 10px; }
            
            .teacher-name { font-size: 0.9rem; color: #6366f1; font-weight: bold; display: flex; align-items: center; gap: 5px; margin-bottom: 5px; }
            
            .select-box { width: 18px; height: 18px; cursor: pointer; margin-top: 5px; accent-color: #3b82f6; }

            .btn-view { background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 5px; cursor: pointer; font-size: 0.85rem; }
            .btn-action-small { padding: 6px 12px; border-radius: 5px; border: none; font-size: 0.85rem; cursor: pointer; margin-left: 5px; }
            .bg-green { background: #dcfce7; color: #166534; }
            .bg-red { background: #fee2e2; color: #991b1b; }

            /* --- MODAL STYLES --- */
            .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; justify-content: center; align-items: center; }
            .modal-content { background: white; width: 90%; max-width: 700px; max-height: 90vh; overflow-y: auto; border-radius: 12px; padding: 25px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); position: relative; animation: slideDown 0.3s ease; }
            @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            
            .modal-header { border-bottom: 1px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
            .modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b; }
            
            .detail-group { margin-bottom: 15px; }
            .detail-label { font-weight: bold; color: #475569; font-size: 0.85rem; margin-bottom: 3px; display: block; }
            .detail-box { background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; color: #1e293b; line-height: 1.6; white-space: pre-wrap; }
            
            .modal-actions { margin-top: 25px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px; }
            
            .role-badge { font-size:0.8rem; background:#eee; padding:5px 10px; border-radius:15px; color:#555; }
        </style>

        <div class="review-header-box">
            <div>
                <h2 style="margin:0; color:#1e293b;">📝 Semakan RPH</h2>
                <div style="display:flex; align-items:center; gap:10px; margin-top:5px;">
                    <p style="margin:0; color:#64748b;">Senarai RPH menunggu pengesahan.</p>
                    <span class="role-badge">Mod: ${userRole === 'superadmin' ? '👑 Super Admin' : '👔 Penyelia'}</span>
                </div>
            </div>
            <button class="btn-back" onclick="window.router.navigate('admin-home')">⬅ Dashboard</button>
        </div>

        <div id="bulkToolbar" class="bulk-actions" style="display:none;">
            <div style="display:flex; align-items:center;">
                <input type="checkbox" id="selectAll" class="select-box" onchange="window.toggleSelectAll(this)">
                <label for="selectAll" style="font-weight:600; cursor:pointer; margin-left:8px; user-select:none;">Pilih Semua</label>
            </div>
            <div style="flex-grow:1; text-align:right;">
                <span id="selectedCount" style="color:#64748b; font-size:0.9rem; margin-right:10px;">0 dipilih</span>
            </div>
            <button id="btnBulkApprove" class="btn-bulk-approve" onclick="window.processBulkApprove()">
                ✅ Sahkan Terpilih
            </button>
        </div>

        <div id="reviewList">
            <p style="text-align:center; padding:40px;">⏳ Memuatkan data guru & RPH...</p>
        </div>

        <div id="rphModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <div>
                        <h3 style="margin:0; color:#1e293b;" id="mSubject">Matapelajaran</h3>
                        <small style="color:#64748b;" id="mDetails">Kelas | Tarikh</small>
                    </div>
                    <button class="modal-close" onclick="window.closeRphModal()">&times;</button>
                </div>
                <div id="modalBody">
                    </div>
                <div class="modal-actions" id="modalButtons">
                    </div>
            </div>
        </div>
    `;

    const listContainer = document.getElementById('reviewList');
    const bulkToolbar = document.getElementById('bulkToolbar');

    try {
        // 2. LOGIK PENAPISAN (FILTERING)
        let allowedTeacherIds = null; 

        if (userRole === 'admin') {
            const adminDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (adminDoc.exists()) {
                allowedTeacherIds = adminDoc.data().assignedTeachers || [];
            } else {
                allowedTeacherIds = [];
            }
        }

        // 3. DAPATKAN NAMA GURU (Mapping)
        if (Object.keys(teachersMap).length === 0) {
            const usersSnap = await getDocs(collection(db, 'users'));
            usersSnap.forEach(doc => {
                const u = doc.data();
                teachersMap[doc.id] = u.name || "Tanpa Nama";
            });
        }

        // 4. QUERY SEMUA RPH (Status Submitted)
        const q = query(
            collection(db, 'rph'), 
            where('status', '==', 'submitted'),
            orderBy('tarikh', 'asc')
        );
        const snap = await getDocs(q);

        if (snap.empty) {
            renderEmptyState(listContainer);
            return;
        }

        let html = '';
        let countVisible = 0;

        snap.forEach(docSnap => {
            const data = docSnap.data();
            
            if (allowedTeacherIds !== null) {
                if (!allowedTeacherIds.includes(data.uid)) {
                    return; 
                }
            }

            countVisible++;
            const rph = data.dataRPH || {};
            const dateStr = data.tarikh.toDate().toLocaleDateString('ms-MY', { day:'numeric', month:'short', year:'numeric'});
            const guruName = teachersMap[data.uid] || "Guru Tidak Dikenali";
            
            const safeData = encodeURIComponent(JSON.stringify({ id: docSnap.id, ...data, guruName }));

            html += `
                <div class="review-card" id="card-${docSnap.id}">
                    <div class="card-top">
                        <input type="checkbox" class="select-box rph-checkbox" value="${docSnap.id}" onchange="window.updateBulkButtonState()">
                        
                        <div style="flex-grow:1; margin-left:10px;">
                            <div class="teacher-name">👤 ${guruName}</div>
                            
                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                <div>
                                    <strong style="font-size:1.1rem; color:#1e293b;">${data.matapelajaran}</strong>
                                    <span style="background:#e2e8f0; padding:2px 8px; border-radius:4px; font-size:0.85rem; margin-left:5px;">${data.kelas}</span>
                                </div>
                                <small style="color:#64748b;">${dateStr}</small>
                            </div>
                            
                            <p style="margin:5px 0; color:#334155; font-size:0.95rem;">
                                <strong>Tajuk:</strong> ${rph.tajuk || '-'}
                            </p>
                            
                            <div style="margin-top:10px; display:flex; gap:8px; justify-content:flex-end;">
                                <button class="btn-view" onclick="window.openRphModal('${safeData}')">👁️ Lihat</button>
                                <button class="btn-action-small bg-green" onclick="window.processRph('${docSnap.id}', 'sah')">✅ Sahkan</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        if (countVisible === 0) {
            renderEmptyState(listContainer);
            bulkToolbar.style.display = 'none';
        } else {
            listContainer.innerHTML = html;
            bulkToolbar.style.display = 'flex';
        }

    } catch (e) {
        console.error(e);
        listContainer.innerHTML = `<p style="color:red; text-align:center;">Ralat: ${e.message}</p>`;
    }
}

// Helper untuk paparan kosong
function renderEmptyState(container) {
    container.innerHTML = `
        <div style="text-align:center; padding:50px; background:white; border-radius:12px; border:1px dashed #cbd5e1;">
            <h3 style="color:#10b981;">🎉 Tahniah!</h3>
            <p style="color:#64748b;">Tiada RPH tertunggak di bawah seliaan anda.</p>
        </div>`;
}

// --- LOGIK MODAL ---

window.openRphModal = (encodedData) => {
    const data = JSON.parse(decodeURIComponent(encodedData));
    const rph = data.dataRPH || {};
    const dateStr = new Date(data.tarikh.seconds * 1000).toLocaleDateString('ms-MY', { weekday:'long', day:'numeric', month:'long', year:'numeric'});

    document.getElementById('mSubject').textContent = data.matapelajaran;
    document.getElementById('mDetails').textContent = `Oleh: ${data.guruName} | Kelas: ${data.kelas} | ${dateStr}`;

    const body = document.getElementById('modalBody');
    body.innerHTML = `
        <div class="detail-group">
            <span class="detail-label">Tajuk / Unit:</span>
            <div class="detail-box">${rph.tajuk || '-'}</div>
        </div>
        <div class="detail-group">
            <span class="detail-label">Objektif Pembelajaran:</span>
            <div class="detail-box">${rph.objectives || '-'}</div>
        </div>
        <div class="detail-group">
            <span class="detail-label">Aktiviti:</span>
            <div class="detail-box">${rph.activities || '-'}</div>
        </div>
        <div class="detail-group">
            <span class="detail-label">Bahan Bantu Belajar (BBB):</span>
            <div class="detail-box">${rph.aids || '-'}</div>
        </div>
         <div class="detail-group">
            <span class="detail-label">Penilaian / Pentaksiran:</span>
            <div class="detail-box">${rph.penilaian || '-'}</div>
        </div>
        <div class="detail-group">
            <span class="detail-label">Refleksi Guru:</span>
            <div class="detail-box" style="border-left:4px solid #f59e0b;">${data.refleksi || 'Tiada catatan refleksi.'}</div>
        </div>
    `;

    const btns = document.getElementById('modalButtons');
    btns.innerHTML = `
        <button class="btn-action-small bg-red" style="padding:10px 20px;" onclick="window.processRph('${data.id}', 'draft', true)">↩️ Minta Pembetulan</button>
        <button class="btn-action-small bg-green" style="padding:10px 20px;" onclick="window.processRph('${data.id}', 'sah', true)">✅ Sahkan RPH</button>
    `;

    document.getElementById('rphModal').style.display = 'flex';
};

window.closeRphModal = () => {
    document.getElementById('rphModal').style.display = 'none';
};

// --- LOGIK PROSES & BULK ---

window.updateBulkButtonState = () => {
    const checkboxes = document.querySelectorAll('.rph-checkbox:checked');
    const btn = document.getElementById('btnBulkApprove');
    const countSpan = document.getElementById('selectedCount');
    const count = checkboxes.length;

    countSpan.textContent = `${count} dipilih`;
    if (count > 0) {
        btn.classList.add('active');
        btn.innerHTML = `✅ Sahkan (${count}) RPH`;
    } else {
        btn.classList.remove('active');
        btn.innerHTML = `✅ Sahkan Terpilih`;
    }
    const allCbs = document.querySelectorAll('.rph-checkbox');
    if (allCbs.length > 0) {
        document.getElementById('selectAll').checked = (allCbs.length === count);
    }
};

window.toggleSelectAll = (source) => {
    const checkboxes = document.querySelectorAll('.rph-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
    window.updateBulkButtonState();
};

window.processBulkApprove = async () => {
    const checkboxes = document.querySelectorAll('.rph-checkbox:checked');
    if (checkboxes.length === 0) return;
    if (!confirm(`Sahkan ${checkboxes.length} RPH sekaligus?`)) return;

    const btn = document.getElementById('btnBulkApprove');
    btn.innerHTML = "⏳ Memproses...";
    
    try {
        const batch = writeBatch(db);
        const timestamp = Timestamp.now();
        checkboxes.forEach(cb => {
            // PENGEMASKINIAN: Tambah digital signature 'pkkk.png'
            batch.update(doc(db, 'rph', cb.value), { 
                status: 'sah', 
                reviewedAt: timestamp, 
                reviewedBy: 'Admin (Pukal)',
                signature: 'pkkk.png' 
            });
        });
        await batch.commit();
        alert("✅ Berjaya disahkan!");
        window.router.navigate('admin-rph-review');
    } catch (e) {
        alert("Ralat: " + e.message);
        btn.innerHTML = "❌ Ralat";
    }
};

window.processRph = async (id, newStatus, fromModal = false) => {
    const actionName = newStatus === 'sah' ? 'MENGESAHKAN' : 'MENGEMBALIKAN';
    if(!confirm(`Adakah anda pasti mahu ${actionName} RPH ini?`)) return;

    try {
        // PENGEMASKINIAN: Bina objek data secara dinamik
        const updateData = {
            status: newStatus,
            reviewedAt: Timestamp.now(),
            reviewedBy: 'Admin'
        };

        // Jika status adalah 'sah', masukkan digital signature
        if (newStatus === 'sah') {
            updateData.signature = 'pkkk.png';
        }

        await updateDoc(doc(db, 'rph', id), updateData);
        
        if (fromModal) window.closeRphModal();
        
        const card = document.getElementById(`card-${id}`);
        if(card) {
            card.style.opacity = '0';
            setTimeout(() => card.remove(), 300);
        }
        setTimeout(() => window.updateBulkButtonState(), 350);

        // Jika semua kad hilang, tunjuk empty state
        const list = document.getElementById('reviewList');
        if (list.querySelectorAll('.review-card').length <= 1) {
             setTimeout(() => {
                 if (list.querySelectorAll('.review-card').length === 0) renderEmptyState(list);
             }, 400);
        }

    } catch(e) {
        alert("Ralat: " + e.message);
    }
};
}
