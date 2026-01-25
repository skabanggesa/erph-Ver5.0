// assets/js/guru/rph-edit.js

import { db, auth } from '../config.js';
import { 
  doc, getDoc, updateDoc, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * FUNGSI UTAMA: Memaparkan Borang Edit
 */
export async function loadRphEdit(id) {
    const content = document.getElementById('content');
    
    // UI Loading
    content.innerHTML = `
        <div style="max-width:800px; margin:20px auto; text-align:center; padding:50px; background:white; border-radius:12px;">
            <p>⏳ Sedang memuatkan data RPH...</p>
        </div>`;

    try {
        const docRef = doc(db, 'rph', id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            alert("Ralat: Rekod RPH tidak dijumpai.");
            window.router.navigate('guru-rph-history');
            return;
        }

        const data = docSnap.data();
        
        // Pastikan kita ambil data dari 'dataRPH' (struktur baru)
        // Gunakan || '' untuk elak error jika field tiada
        const d = data.dataRPH || {}; 
        const tgl = data.tarikh ? data.tarikh.toDate().toLocaleDateString('ms-MY') : '-';

        content.innerHTML = `
            <style>
                .edit-container { max-width: 800px; margin: 20px auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                .edit-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f0f2f5; margin-bottom: 25px; padding-bottom: 15px; }
                
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px; border: 1px solid #e2e8f0; }
                .info-item strong { display: block; color: #64748b; font-size: 0.85rem; margin-bottom: 4px; }
                .info-item span { font-weight: 600; color: #1e293b; }

                .form-group { margin-bottom: 20px; }
                .form-group label { font-weight: bold; display: block; color: #334155; margin-bottom: 8px; }
                .form-group input, .form-group textarea { width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: inherit; font-size: 1rem; transition: 0.2s; }
                .form-group input:focus, .form-group textarea:focus { border-color: #3b82f6; outline: none; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
                
                .btn-save { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; padding: 12px 25px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 1rem; width: 100%; margin-top: 10px; }
                .btn-save:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2); }
                .btn-cancel { background: #94a3b8; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; }
            </style>

            <div class="edit-container">
                <div class="edit-header">
                    <h2 style="margin:0; color:#1e293b;">✏️ Kemaskini RPH</h2>
                    <button class="btn-cancel" onclick="window.router.navigate('guru-rph-history')">Batal</button>
                </div>

                <div class="info-grid">
                    <div class="info-item"><strong>TARIKH</strong> <span>${tgl}</span></div>
                    <div class="info-item"><strong>MASA</strong> <span>${data.masaMula} - ${data.masaTamat}</span></div>
                    <div class="info-item"><strong>SUBJEK</strong> <span>${data.matapelajaran}</span></div>
                    <div class="info-item"><strong>KELAS</strong> <span>${data.kelas}</span></div>
                </div>

                <div class="form-group">
                    <label>Tajuk / Unit:</label>
                    <input type="text" id="editTajuk" value="${d.tajuk || ''}">
                </div>

                <div class="form-group">
                    <label>Objektif Pembelajaran:</label>
                    <textarea id="editObjektif" rows="4">${d.objectives || d.standards || ''}</textarea>
                </div>

                <div class="form-group">
                    <label>Aktiviti:</label>
                    <textarea id="editAktiviti" rows="6">${d.activities || ''}</textarea>
                </div>

                <div class="form-group">
                    <label>Bahan Bantu Belajar (BBB):</label>
                    <textarea id="editAids" rows="2">${d.aids || ''}</textarea>
                </div>

                <div class="form-group">
                    <label>Penilaian / Pentaksiran:</label>
                    <textarea id="editPenilaian" rows="2">${d.penilaian || ''}</textarea>
                </div>

                <div class="form-group">
                    <label style="color:#059669;">Refleksi (Diisi selepas kelas):</label>
                    <textarea id="editRefleksi" rows="3" placeholder="Contoh: 25/30 murid dapat menguasai objektif..." style="border: 2px dashed #10b981;">${data.refleksi || ''}</textarea>
                </div>

                <button class="btn-save" id="btnSimpan" onclick="window.saveRphChanges('${id}')">💾 Simpan Perubahan</button>
            </div>
        `;

    } catch (e) {
        console.error(e);
        content.innerHTML = `<p style="color:red; text-align:center; padding:20px;">Ralat Sistem: ${e.message}</p>`;
    }
}

/**
 * FUNGSI GLOBAL: Simpan Data ke Firestore
 */
window.saveRphChanges = async (id) => {
    const btn = document.getElementById('btnSimpan');
    btn.textContent = "Sedang menyimpan...";
    btn.disabled = true;

    // Ambil data dari form
    const tajuk = document.getElementById('editTajuk').value;
    const objektif = document.getElementById('editObjektif').value;
    const aktiviti = document.getElementById('editAktiviti').value;
    const aids = document.getElementById('editAids').value;
    const penilaian = document.getElementById('editPenilaian').value;
    const refleksi = document.getElementById('editRefleksi').value;

    try {
        // Update menggunakan Dot Notation untuk update nested object 'dataRPH'
        await updateDoc(doc(db, 'rph', id), {
            'dataRPH.tajuk': tajuk,
            'dataRPH.objectives': objektif,
            'dataRPH.activities': aktiviti,
            'dataRPH.aids': aids,
            'dataRPH.penilaian': penilaian,
            'refleksi': refleksi,     // Refleksi biasanya di luar dataRPH (root level)
            'updatedAt': Timestamp.now()
        });

        alert("✅ RPH berjaya dikemaskini!");
        window.router.navigate('guru-rph-history');

    } catch (e) {
        console.error(e);
        alert("Gagal menyimpan: " + e.message);
        btn.textContent = "💾 Simpan Perubahan";
        btn.disabled = false;
    }
};