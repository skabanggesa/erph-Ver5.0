// guru-jadual.js
import { auth, db } from '../config.js';
import { collection, addDoc, query, where, getDocs, doc, deleteDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Fungsi untuk setup listener & load data awal
export function initJadual() {
    document.getElementById('formJadual').addEventListener('submit', handleAddJadual);
    loadJadual();
    
    // Dedahkan fungsi ke window supaya HTML onclick="" boleh baca
    window.deleteJadual = deleteJadual;
}

async function handleAddJadual(e) {
    e.preventDefault();
    const user = auth.currentUser;
    const data = {
        uid: user.uid,
        hari: parseInt(document.getElementById('jHari').value),
        masaMula: document.getElementById('jMasaMula').value,
        masaTamat: document.getElementById('jMasaTamat').value,
        kelas: document.getElementById('jKelas').value,
        subjek: document.getElementById('jSubjek').value
    };

    try {
        await addDoc(collection(db, 'timetable'), data);
        alert("Jadual ditambah!");
        document.getElementById('formJadual').reset();
        loadJadual();
    } catch(e) { alert("Ralat: " + e.message); }
}

async function loadJadual() {
    const user = auth.currentUser;
    const container = document.getElementById('timetableContainer');
    container.innerHTML = '<p>Memuatkan jadual...</p>';

    const q = query(collection(db, 'timetable'), where('uid', '==', user.uid), orderBy('hari'));
    
    try {
        const snap = await getDocs(q);
        const daysData = { 1: [], 2: [], 3: [], 4: [], 5: [] };
        
        snap.forEach(doc => {
            const d = doc.data();
            d.id = doc.id;
            if (daysData[d.hari]) daysData[d.hari].push(d);
        });

        for (let i = 1; i <= 5; i++) {
            daysData[i].sort((a, b) => a.masaMula.localeCompare(b.masaMula));
        }

        const hariLabels = { 1:'ISNIN', 2:'SELASA', 3:'RABU', 4:'KHAMIS', 5:'JUMAAT' };
        let fullHtml = '';

        for (let i = 1; i <= 5; i++) {
            let itemsHtml = '';
            if (daysData[i].length === 0) {
                itemsHtml = `<div class="empty-day">Tiada kelas</div>`;
            } else {
                daysData[i].forEach(item => {
                    itemsHtml += `
                        <div class="class-item">
                            <span class="class-time">${item.masaMula} - ${item.masaTamat}</span>
                            <span class="class-info"><strong>${item.subjek}</strong> (${item.kelas})</span>
                            <button class="btn-del-slot" onclick="window.deleteJadual('${item.id}')" title="Padam Slot">✖</button>
                        </div>
                    `;
                });
            }
            fullHtml += `
                <div class="day-card">
                    <div class="day-header">${hariLabels[i]}</div>
                    <div class="day-body">${itemsHtml}</div>
                </div>
            `;
        }
        container.innerHTML = fullHtml;
    } catch (e) { container.innerHTML = `<p style="color:red">Ralat: ${e.message}</p>`; }
}

async function deleteJadual(id) {
    if(!confirm('Padam slot kelas ini?')) return;
    try { await deleteDoc(doc(db, 'timetable', id)); loadJadual(); } 
    catch(e) { alert("Gagal padam: " + e.message); }
}