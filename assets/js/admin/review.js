// assets/js/admin/review.js

import { db, auth } from '../config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function loadReviewPage(rphId) {
    const content = document.getElementById('adminContent');
    content.innerHTML = '<p>Memuatkan butiran RPH...</p>';

    try {
        const rphRef = doc(db, 'rph', rphId);
        const rphSnap = await getDoc(rphRef);

        if (!rphSnap.exists()) {
            content.innerHTML = '<p class="error">RPH tidak dijumpai.</p>';
            return;
        }

        const data = rphSnap.data();
        const rph = data.dataRPH; // Data dalaman

        // Paparan Butiran
        content.innerHTML = `
            <div style="max-width:800px; margin:0 auto;">
                <button onclick="history.back()" style="margin-bottom:10px; cursor:pointer;">⬅ Kembali</button>
                
                <div style="background:white; padding:30px; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.1);">
                    <div style="border-bottom:1px solid #eee; padding-bottom:15px; margin-bottom:20px;">
                        <h2 style="margin:0; color:#2c3e50;">${data.matapelajaran}</h2>
                        <span style="color:#7f8c8d;">${data.kelas} | ${data.tarikh}</span>
                        <div style="margin-top:10px;">
                            Status Semasa: <strong style="text-transform:uppercase;">${data.status}</strong>
                        </div>
                    </div>

                    <div style="margin-bottom:20px;"><strong>Tajuk:</strong> ${rph.tajuk}</div>
                    <div style="margin-bottom:20px;"><strong>Objektif:</strong> <pre style="font-family:inherit; background:#f9f9f9; padding:10px;">${rph.objectives}</pre></div>
                    <div style="margin-bottom:20px;"><strong>Aktiviti:</strong> <pre style="font-family:inherit; background:#f9f9f9; padding:10px;">${rph.activities}</pre></div>
                    <div style="margin-bottom:20px;"><strong>BBM:</strong> ${rph.aids}</div>
                    <div style="margin-bottom:20px;"><strong>Penilaian:</strong> ${rph.penilaian}</div>
                    <div style="margin-bottom:20px;"><strong>Refleksi Guru:</strong> <p style="font-style:italic;">${data.refleksi || 'Tiada'}</p></div>

                    <hr>

                    <div style="background:#e8f6f3; padding:20px; border-radius:8px; margin-top:20px;">
                        <h4 style="margin-top:0;">Tindakan Pentadbir</h4>
                        <label>Ulasan / Komen (Pilihan)</label>
                        <textarea id="adminComment" rows="3" style="width:100%; padding:10px; margin-bottom:10px;">${data.adminComment || ''}</textarea>
                        
                        <div style="display:flex; gap:10px;">
                            <button id="btnApprove" style="flex:1; background:#27ae60; color:white; border:none; padding:12px; border-radius:4px; cursor:pointer; font-weight:bold;">✅ LULUSKAN</button>
                            <button id="btnReject" style="flex:1; background:#c0392b; color:white; border:none; padding:12px; border-radius:4px; cursor:pointer; font-weight:bold;">❌ KEMBALIKAN (TOLAK)</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Logic Buttons
        document.getElementById('btnApprove').onclick = () => updateStatus(rphId, 'approved');
        document.getElementById('btnReject').onclick = () => updateStatus(rphId, 'rejected');

    } catch (e) {
        content.innerHTML = `<p class="error">Ralat: ${e.message}</p>`;
    }
}

async function updateStatus(rphId, status) {
    const comment = document.getElementById('adminComment').value;
    const adminId = auth.currentUser.uid;

    try {
        await updateDoc(doc(db, 'rph', rphId), {
            status: status,
            adminComment: comment,
            reviewedBy: adminId,
            reviewedAt: new Date()
        });
        alert(`RPH telah dikemaskini: ${status.toUpperCase()}`);
        history.back();
    } catch (e) {
        alert("Gagal mengemaskini: " + e.message);
    }
}