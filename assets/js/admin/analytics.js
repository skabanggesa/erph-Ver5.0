// assets/js/admin/analytics.js

import { db } from '../config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function loadAnalytics() {
    const content = document.getElementById('adminContent');
    content.innerHTML = '<p>Sedang mengira data...</p>';

    try {
        // 1. Ambil data Guru
        const usersSnap = await getDocs(collection(db, 'users'));
        const stats = {}; // Objek untuk simpan kiraan { uid: { name: '', total: 0, submitted: 0 } }

        usersSnap.forEach(doc => {
            const d = doc.data();
            // Hanya ambil pengguna yang berstatus 'guru'
            if (d.role === 'guru') {
                stats[doc.id] = { name: d.name, total: 0, submitted: 0, approved: 0 };
            }
        });

        // 2. Ambil SEMUA RPH
        const rphSnap = await getDocs(collection(db, 'rph'));

        rphSnap.forEach(doc => {
            const r = doc.data();
            
            // Pastikan RPH ini milik guru yang wujud dalam senarai stats
            if (stats[r.uid]) { 
                stats[r.uid].total++;
                
                // KIRAAN DIHANTAR
                // Semak variasi ejaan status 'hantar'
                if (r.status === 'submitted' || r.status === 'hantar') {
                    stats[r.uid].submitted++;
                }

                // KIRAAN DILULUSKAN (KOD DIBAIKI DI SINI) 👇
                // Kita terima 'approved' ATAU 'sah'
                if (r.status === 'approved' || r.status === 'sah') {
                    stats[r.uid].approved++;
                }
            }
        });

        // 3. Render Jadual
        let html = `
            <h3>📊 Analisis Penghantaran RPH</h3>
            <table style="width:100%; border-collapse:collapse; background:white; margin-top:20px;">
                <thead style="background:#2c3e50; color:white;">
                    <tr>
                        <th style="padding:12px; text-align:left;">Nama Guru</th>
                        <th style="padding:12px; text-align:center;">Jumlah RPH</th>
                        <th style="padding:12px; text-align:center;">Dihantar</th>
                        <th style="padding:12px; text-align:center;">Diluluskan</th>
                        <th style="padding:12px; text-align:center;">Peratus Siap</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Susun nama guru mengikut abjad (Pilihan Tambahan untuk kekemasan)
        const sortedStats = Object.values(stats).sort((a, b) => a.name.localeCompare(b.name));

        sortedStats.forEach(s => {
            // Kira peratus: (Hantar + Lulus) / Total
            const percent = s.total === 0 ? 0 : Math.round(((s.submitted + s.approved) / s.total) * 100);
            
            html += `
                <tr style="border-bottom:1px solid #ddd;">
                    <td style="padding:12px;">${s.name}</td>
                    <td style="padding:12px; text-align:center; font-weight:bold;">${s.total}</td>
                    <td style="padding:12px; text-align:center; color:orange;">${s.submitted}</td>
                    <td style="padding:12px; text-align:center; color:green; font-weight:bold;">${s.approved}</td>
                    <td style="padding:12px; text-align:center;">
                        <div style="background:#eee; width:100%; height:10px; border-radius:5px; overflow:hidden; margin-bottom:5px;">
                            <div style="background:${percent >= 100 ? '#27ae60' : '#2980b9'}; width:${percent}%; height:100%;"></div>
                        </div>
                        <small style="color:#666;">${percent}%</small>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        content.innerHTML = html;

    } catch (e) {
        console.error("Ralat Analitik:", e);
        content.innerHTML = `<p class="error" style="color:red; padding:20px;">Ralat analisis: ${e.message}</p>`;
    }
}