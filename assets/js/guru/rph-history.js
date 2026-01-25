// assets/js/guru/rph-history.js

import { auth, db } from '../config.js';
import { 
  collection, query, where, getDocs, orderBy, Timestamp, doc, deleteDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Variable global untuk simpan data hasil carian
let filteredRphData = [];

/**
 * FUNGSI UTAMA: Memaparkan UI Sejarah RPH
 */
export function loadRphHistory() {
  const content = document.getElementById('content');
  
  content.innerHTML = `
    <style>
      .history-container { max-width: 1000px; margin: 20px auto; background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
      .header-title { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; margin-bottom: 20px; }
      
      .filter-box { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px; display: flex; gap: 15px; align-items: flex-end; flex-wrap: wrap; border: 1px solid #e2e8f0; }
      .filter-group { display: flex; flex-direction: column; gap: 5px; }
      .filter-group label { font-size: 0.85rem; font-weight: bold; color: #64748b; }
      .filter-group input, .filter-group select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none; min-width: 150px; }

      .rph-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.95rem; }
      .rph-table th { background: #1e293b; color: white; padding: 12px; text-align: left; border-radius: 4px 4px 0 0; }
      .rph-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
      .rph-table tr:hover { background-color: #f1f5f9; }

      /* BADGE STATUS */
      .status-badge { padding: 5px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block; }
      .status-draft { background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; } 
      .status-hantar { background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd; } 
      .status-sah { background: #dcfce7; color: #166534; border: 1px solid #86efac; } 

      /* BUTTONS */
      .btn-filter { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; transition: 0.2s; }
      .btn-filter:hover { background: #2563eb; }
      
      .btn-print { background: #059669; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; }
      .btn-print:disabled { background: #cbd5e1; cursor: not-allowed; }

      /* BUTTON HANTAR SEMUA */
      .btn-submit-all { background: #7c3aed; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; display: flex; align-items: center; gap: 5px; }
      .btn-submit-all:disabled { background: #ddd6fe; cursor: not-allowed; }
      .btn-submit-all:hover:not(:disabled) { background: #6d28d9; transform: translateY(-1px); }
      
      .action-btn { background:none; border:none; cursor:pointer; font-size:1.1rem; padding:5px; border-radius:4px; transition:0.2s; }
      .action-btn:hover { background: #e2e8f0; }
      .btn-delete { color: #ef4444; }
      .btn-edit { color: #3b82f6; }

      /* Print Styles */
      #printSection { display: none; }
      @media print {
        body * { visibility: hidden; }
        #printSection, #printSection * { visibility: visible; }
        #printSection { display: block !important; position: absolute; left: 0; top: 0; width: 100%; }
        .rph-page { page-break-after: always; padding: 40px; }
      }
    </style>

    <div class="history-container">
      <div class="header-title no-print">
         <h2 style="margin:0; color:#1e293b;">🗂️ Pengurusan RPH</h2>
         <button class="btn btn-secondary" onclick="window.router.navigate('guru-home')">⬅ Dashboard</button>
      </div>

      <div class="filter-box no-print">
        <div class="filter-group">
          <label>Tarikh Mula:</label>
          <input type="date" id="startDate">
        </div>
        <div class="filter-group">
          <label>Tarikh Akhir:</label>
          <input type="date" id="endDate">
        </div>
        
        <div class="filter-group">
            <label>Jenis Paparan:</label>
            <select id="statusFilter" onchange="window.filterRphData()">
                <option value="draft">Draf Sahaja (Kerja Tertunggak)</option>
                <option value="all">Semua Sejarah</option>
                <option value="report">Laporan Rasmi (Telah Hantar/Sah)</option>
            </select>
        </div>

        <button class="btn-filter" onclick="window.filterRphData()">🔍 Cari</button>
        
        <button class="btn-submit-all" id="btnSubmitAll" onclick="window.submitAllDrafts()" disabled>
            🚀 Hantar Semua Draf
        </button>

        <button class="btn-print" id="btnPrint" onclick="window.printFullRph()" disabled>🖨️ Cetak</button>
      </div>

      <div id="rphPreviewArea" class="no-print">
         <p style="text-align:center; padding:20px;">⏳ Memuatkan rekod...</p>
      </div>
    </div>

    <div id="printSection"></div>
  `;

  // Set default tarikh (Seminggu ke belakang atau hari ini)
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  document.getElementById('startDate').value = dateStr;
  document.getElementById('endDate').value = dateStr;

  // Terus panggil function cari
  window.filterRphData();
}

/**
 * FUNGSI: Filter Data RPH
 */
window.filterRphData = async () => {
    const startStr = document.getElementById('startDate').value;
    const endStr = document.getElementById('endDate').value;
    const filterMode = document.getElementById('statusFilter').value; 
    
    const previewArea = document.getElementById('rphPreviewArea');
    const btnPrint = document.getElementById('btnPrint');
    const btnSubmitAll = document.getElementById('btnSubmitAll');

    if (!startStr || !endStr) return;

    previewArea.innerHTML = '<p style="text-align:center; padding:20px;">⏳ Sedang mencari rekod...</p>';
    filteredRphData = []; 

    const startTs = Timestamp.fromDate(new Date(startStr + "T00:00:00"));
    const endTs = Timestamp.fromDate(new Date(endStr + "T23:59:59"));

    try {
        const q = query(
            collection(db, 'rph'), 
            where('uid', '==', auth.currentUser.uid),
            where('tarikh', '>=', startTs),
            where('tarikh', '<=', endTs),
            orderBy('tarikh', 'asc')
        );

        const snap = await getDocs(q);
        
        if (snap.empty) {
            previewArea.innerHTML = '<p style="text-align:center; padding:20px;">Tiada rekod ditemui pada tarikh ini.</p>';
            btnPrint.disabled = true;
            btnSubmitAll.disabled = true;
            return;
        }

        // --- BINA JADUAL ---
        let html = `
            <table class="rph-table">
                <thead>
                    <tr>
                        <th>Tarikh</th>
                        <th>Kelas & Subjek</th>
                        <th>Tajuk</th>
                        <th>Status</th>
                        <th style="text-align:center;">Tindakan</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        let count = 0;
        let draftCount = 0; 

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const rawStatus = data.status ? data.status.toLowerCase() : 'draft';
            
            // LOGIK FILTER BARU
            
            // 1. Jika mode = 'draft', HANYA tunjuk draf.
            if (filterMode === 'draft' && rawStatus !== 'draft') {
                return; // Skip yang dah hantar
            }

            // 2. Jika mode = 'report', HANYA tunjuk yang dah hantar/sah.
            if (filterMode === 'report' && rawStatus === 'draft') {
                return; // Skip draf
            }

            // 3. Jika mode = 'all', tunjuk SEMUA.

            const rphObj = { id: docSnap.id, ...data };
            filteredRphData.push(rphObj);
            count++;

            // Kira draf untuk butang (tanpa mengira paparan)
            if (rawStatus === 'draft') draftCount++;

            const tgl = data.tarikh.toDate().toLocaleDateString('ms-MY');
            
            let badgeClass = 'status-draft';
            let badgeLabel = 'DRAF';

            if (['disemak', 'approved', 'sah'].includes(rawStatus)) {
                badgeClass = 'status-sah';
                badgeLabel = 'DISAHKAN';
            } else if (['submitted', 'hantar'].includes(rawStatus)) {
                badgeClass = 'status-hantar';
                badgeLabel = 'DIHANTAR';
            }

            html += `
                <tr>
                    <td><strong>${tgl}</strong></td>
                    <td>${data.matapelajaran}<br><small style="color:#64748b;">${data.kelas}</small></td>
                    <td>${data.dataRPH?.tajuk || '-'}</td>
                    <td><span class="status-badge ${badgeClass}">${badgeLabel}</span></td>
                    <td align="center">
                        <button class="action-btn btn-edit" title="Lihat/Edit" onclick="window.viewRphDetails('${docSnap.id}')">✏️</button>
                        ${rawStatus === 'draft' ? `<button class="action-btn btn-delete" title="Padam" onclick="window.deleteRphRecord('${docSnap.id}')">🗑️</button>` : ''}
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';

        if (count === 0) {
            // MESEJ KHAS MENGIKUT FILTER
            let emptyMsg = "Tiada rekod ditemui.";
            if (filterMode === 'draft') emptyMsg = "✅ Syabas! Tiada draf tertunggak. Semua telah dihantar.";
            if (filterMode === 'report') emptyMsg = "Tiada RPH yang telah dihantar dalam julat tarikh ini.";

            previewArea.innerHTML = `<div style="text-align:center; padding:30px; color:#64748b;">
                <p>${emptyMsg}</p>
            </div>`;
            
            btnPrint.disabled = true;
            // Walaupun list kosong, kita check kalau ada draf yang mungkin wujud tapi tersembunyi (cth: sedang view report)
            // Tapi untuk mode 'draft', kalau kosong bermakna butang hantar pun patut off.
            btnSubmitAll.disabled = true;

        } else {
            previewArea.innerHTML = html;
            btnPrint.disabled = false;
            
            // Logic Butang Hantar Semua
            // Butang hanya aktif jika Paparan adalah 'Draft' atau 'All', DAN ada draf dalam list
            const visibleDrafts = filteredRphData.filter(r => !r.status || r.status === 'draft').length;

            if (visibleDrafts > 0) {
                btnSubmitAll.disabled = false;
                btnSubmitAll.innerHTML = `🚀 Hantar ${visibleDrafts} Draf`;
                btnSubmitAll.title = "Hantar semua draf yang dipaparkan";
            } else {
                btnSubmitAll.disabled = true;
                btnSubmitAll.innerHTML = `🚀 Hantar Semua Draf`;
            }
        }

    } catch (e) {
        console.error(e);
        previewArea.innerHTML = `<p style="color:red;">Ralat: ${e.message}</p>`;
    }
};

/**
 * FUNGSI: Hantar Semua Draf (Batch Update)
 */
window.submitAllDrafts = async () => {
    // Ambil draf dari senarai yang SEDANG DIPAPARKAN sahaja
    const draftsToSubmit = filteredRphData.filter(r => !r.status || r.status === 'draft');

    if (draftsToSubmit.length === 0) {
        alert("Tiada RPH berstatus Draf untuk dihantar.");
        return;
    }

    if (!confirm(`Adakah anda pasti mahu menghantar ${draftsToSubmit.length} RPH kepada Admin?\n\nPastikan refleksi telah disemak.`)) {
        return;
    }

    const btn = document.getElementById('btnSubmitAll');
    btn.disabled = true;
    btn.textContent = "Sedang Memproses...";

    try {
        const updatePromises = draftsToSubmit.map(rph => {
            const rphRef = doc(db, 'rph', rph.id);
            return updateDoc(rphRef, {
                status: 'submitted',
                updatedAt: Timestamp.now()
            });
        });

        await Promise.all(updatePromises);

        alert(`✅ Berjaya! ${draftsToSubmit.length} RPH telah dihantar.`);
        
        // PENTING: Refresh list.
        // Jika filter = 'draft', item akan hilang (jadi kosong).
        window.filterRphData();

    } catch (e) {
        console.error(e);
        alert("Ralat semasa penghantaran pukal: " + e.message);
        btn.disabled = false;
        btn.textContent = "Cuba Semula";
    }
};

window.viewRphDetails = (id) => {
    window.router.navigate(`guru-rph-edit?id=${id}`);
};

window.deleteRphRecord = async (id) => {
    if(!confirm("Padam draf RPH ini?")) return;
    try {
        await deleteDoc(doc(db, 'rph', id));
        alert("Draf dipadam.");
        window.filterRphData();
    } catch (e) {
        alert("Ralat: " + e.message);
    }
}

// Fungsi cetak
window.printFullRph = () => {
    const printSection = document.getElementById('printSection');
    let htmlContent = '';

    filteredRphData.forEach((rph) => {
        const tgl = rph.tarikh.toDate().toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const d = rph.dataRPH || {};
        const s = rph.status ? rph.status.toLowerCase() : 'draft';
        const statusLabel = (['approved','sah','disemak'].includes(s)) ? "DISAHKAN" : s.toUpperCase();

        htmlContent += `
            <div class="rph-page">
                <div style="text-align:right; font-size:0.8rem; color:#555; margin-bottom:10px;">Status: <strong>${statusLabel}</strong></div>
                <h3 style="text-align:center; text-decoration:underline;">RANCANGAN PENGAJARAN HARIAN</h3>
                <table width="100%" border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse; margin-top:15px; font-family:Arial;">
                    <tr><td width="20%"><strong>TARIKH</strong></td><td>${tgl}</td><td width="20%"><strong>MASA</strong></td><td>${rph.masaMula} - ${rph.masaTamat}</td></tr>
                    <tr><td><strong>KELAS</strong></td><td>${rph.kelas}</td><td><strong>SUBJEK</strong></td><td>${rph.matapelajaran}</td></tr>
                </table>
                <div style="margin-top:15px; line-height:1.5;">
                    <p><strong>TAJUK:</strong> ${d.tajuk || '-'}</p>
                    <p><strong>OBJEKTIF:</strong> ${d.objectives || '-'}</p>
                    <p><strong>AKTIVITI:</strong> ${d.activities || '-'}</p>
                    <p><strong>BBB:</strong> ${d.aids || '-'}</p>
                    <p><strong>PENILAIAN:</strong> ${d.penilaian || '-'}</p>
                </div>
                <div style="border:1px solid #000; padding:10px; margin-top:15px; min-height:60px;">
                    <strong>REFLEKSI:</strong><br>${rph.refleksi || ''}
                </div>
            </div>`;
    });
    printSection.innerHTML = htmlContent;
    setTimeout(() => { window.print(); }, 500);
};