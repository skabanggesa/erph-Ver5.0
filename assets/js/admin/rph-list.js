// assets/js/admin/rph-list.js

import { db } from '../config.js';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function loadRphListPage(teacherUid) {
    const content = document.getElementById('adminContent');
    
    if (!teacherUid) {
        content.innerHTML = '<p class="error">Tiada guru dipilih.</p>';
        return;
    }

    content.innerHTML = '<p>Memuatkan RPH...</p>';

    try {
        // 1. Dapatkan Nama Guru
        const teacherDoc = await getDoc(doc(db, 'users', teacherUid));
        const teacherName = teacherDoc.exists() ? teacherDoc.data().name : 'Guru Tidak Diketahui';

        // 2. Query RPH milik guru ini
        // NOTA: orderBy mungkin perlu Index di Firebase Console. 
        // Jika error, buang orderBy('tarikh', 'desc') sementara waktu.
        const q = query(
            collection(db, 'rph'),
            where('uid', '==', teacherUid),
            orderBy('tarikh', 'desc') 
        );

        const rphSnap = await getDocs(q);

        let html = `
            <button onclick="router.navigate('admin-rph-review')" style="margin-bottom:20px; cursor:pointer;">⬅ Kembali ke Senarai Guru</button>
            <h3>RPH: ${teacherName}</h3>
            <table style="width:100%; border-collapse:collapse; background:white;">
                <thead style="background:#f0f0f0;">
                    <tr>
                        <th style="padding:10px; text-align:left;">Tarikh</th>
                        <th style="padding:10px;">Subjek</th>
                        <th style="padding:10px;">Kelas</th>
                        <th style="padding:10px;">Status</th>
                        <th style="padding:10px;">Aksi</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (rphSnap.empty) {
            html += `<tr><td colspan="5" style="text-align:center; padding:20px;">Tiada rekod RPH.</td></tr>`;
        } else {
            rphSnap.forEach(docSnap => {
                const data = docSnap.data();
                const statusColor = getStatusColor(data.status);

                html += `
                    <tr style="border-bottom:1px solid #eee;">
                        <td style="padding:10px;">${data.tarikh}</td>
                        <td style="padding:10px;">${data.matapelajaran}</td>
                        <td style="padding:10px;">${data.kelas}</td>
                        <td style="padding:10px;"><span style="color:${statusColor}; font-weight:bold; text-transform:uppercase;">${data.status}</span></td>
                        <td style="padding:10px;">
                            <button onclick="router.navigate('admin-rph-detail', '${docSnap.id}')" 
                                style="background:#27ae60; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">
                                Semak
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        html += `</tbody></table>`;
        content.innerHTML = html;

    } catch (e) {
        console.error(e);
        content.innerHTML = `
            <p class="error">Gagal memuatkan RPH. Kemungkinan indeks Firestore belum dibina.</p>
            <p>Error: ${e.message}</p>
            <button onclick="router.navigate('admin-rph-review')">Kembali</button>
        `;
    }
}

function getStatusColor(status) {
    if(status === 'submitted') return 'orange';
    if(status === 'approved') return 'green';
    if(status === 'rejected') return 'red';
    return 'grey';
}