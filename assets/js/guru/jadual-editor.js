// assets/js/guru/jadual-editor.js
// VERSI KEMAS & ADA BUTANG KEMBALI

import { auth, db } from '../config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const HARI = ["Isnin", "Selasa", "Rabu", "Khamis", "Jumaat"];
let currentJadual = []; 
let editId = null; 

export async function loadJadualEditor() {
    const content = document.getElementById('content');
    
    // CSS IN-LINE
    const style = `
    <style>
        .days-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px; }
        .day-card { background: #fff; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #eee; display: flex; flex-direction: column; }
        .day-header { background: #2c3e50; color: white; padding: 15px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
        .session-list { padding: 10px; flex-grow: 1; }
        .session-item { display: flex; align-items: center; padding: 10px; margin-bottom: 8px; background: #f8f9fa; border-left: 4px solid #3498db; border-radius: 4px; transition: transform 0.2s; }
        .session-item:hover { transform: translateX(5px); background: #eef6fb; }
        .time-badge { font-size: 0.85rem; font-weight: bold; color: #555; min-width: 90px; }
        .subject-info { flex-grow: 1; padding-left: 10px; }
        .subject-name { font-weight: 700; color: #2c3e50; }
        .class-name { font-size: 0.85rem; color: #7f8c8d; }
        .btn-icon { background: none; border: none; cursor: pointer; font-size: 1.1rem; opacity: 0.6; transition: 0.2s; padding: 5px; }
        .btn-icon:hover { opacity: 1; transform: scale(1.1); }
        .text-danger { color: #e74c3c; }
        .text-primary { color: #3498db; }
        .fab-add { position: fixed; bottom: 30px; right: 30px; background: #27ae60; color: white; width: 60px; height: 60px; border-radius: 50%; font-size: 30px; border: none; cursor: pointer; box-shadow: 0 4px 15px rgba(39, 174, 96, 0.4); display: flex; align-items: center; justify-content: center; transition: transform 0.3s; z-index: 100; }
        .fab-add:hover { transform: scale(1.1) rotate(90deg); background: #2ecc71; }
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 200; display: none; align-items: center; justify-content: center; }
        .modal-overlay.active { display: flex; }
        .modal-box { background: white; width: 90%; max-width: 500px; padding: 25px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); animation: slideUp 0.3s ease; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    </style>
    `;

    content.innerHTML = style + `
        <div class="guru-section">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:20px;">
                <div>
                    <h2 style="margin-bottom:5px; border:none; padding:0;">📅 Urus Jadual Waktu</h2>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn btn-secondary" onclick="window.router.navigate('guru-home')">
                        ⬅ Kembali
                    </button>
                    <button id="btnSaveFirebase" class="btn btn-primary">
                        💾 Simpan Jadual
                    </button>
                </div>
            </div>
            
            <p style="color:#666; margin-bottom:20px;">Tambah atau edit sesi pengajaran anda di sini untuk penjanaan RPH automatik.</p>

            <div id="jadualGrid" class="days-grid">
                <p style="grid-column: 1/-1; text-align:center; padding: 40px;">⏳ Memuatkan jadual...</p>
            </div>
        </div>

        <button class="fab-add" id="fabAdd" title="Tambah Kelas Baru">+</button>

        <div class="modal-overlay" id="modalForm">
            <div class="modal-box">
                <h3 style="margin-top:0; color:#2c3e50; border-bottom:1px solid #eee; padding-bottom:10px;">
                    <span id="modalTitle">Tambah Sesi</span>
                </h3>
                
                <div class="form-group">
                    <label>Hari</label>
                    <select id="inputHari">
                        ${HARI.map(h => `<option value="${h}">${h}</option>`).join('')}
                    </select>
                </div>
                
                <div style="display:flex; gap:15px;">
                    <div class="form-group" style="flex:1;">
                        <label>Masa Mula</label>
                        <select id="inputMasaMula">
                           ${generateTimeOptions()} 
                        </select>
                    </div>
                    <div class="form-group" style="flex:1;">
                        <label>Masa Tamat</label>
                        <select id="inputMasaTamat">
                           ${generateTimeOptions()} 
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label>Matapelajaran</label>
                    <input type="text" id="inputSubjek" placeholder="Contoh: BAHASA MELAYU">
                </div>

                <div class="form-group">
                    <label>Kelas</label>
                    <input type="text" id="inputKelas" placeholder="Contoh: 4 CEMERLANG">
                </div>

                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                    <button class="btn btn-secondary" id="btnCancelModal">Batal</button>
                    <button class="btn btn-success" id="btnSaveModal">Simpan</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('fabAdd').addEventListener('click', () => openModal());
    document.getElementById('btnCancelModal').addEventListener('click', closeModal);
    document.getElementById('btnSaveModal').addEventListener('click', saveSessionFromModal);
    document.getElementById('btnSaveFirebase').addEventListener('click', saveToFirebase);

    await fetchJadual();
}

async function fetchJadual() {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const docRef = doc(db, 'jadual', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            currentJadual = docSnap.data().senarai || [];
        } else {
            currentJadual = [];
        }
        renderJadual();
    } catch (e) {
        console.error("Ralat muat jadual:", e);
    }
}

function renderJadual() {
    const grid = document.getElementById('jadualGrid');
    grid.innerHTML = '';
    HARI.forEach(hari => {
        const sesiHari = currentJadual.filter(s => s.hari === hari).sort((a, b) => a.masaMula.localeCompare(b.masaMula));
        const card = document.createElement('div');
        card.className = 'day-card';
        let listHtml = '';
        if (sesiHari.length > 0) {
            sesiHari.forEach((sesi) => {
                const realIndex = currentJadual.indexOf(sesi);
                listHtml += `
                    <div class="session-item">
                        <div class="time-badge"><div>${sesi.masaMula}</div><div style="font-size:0.75rem; opacity:0.7;">${sesi.masaTamat}</div></div>
                        <div class="subject-info"><div class="subject-name">${sesi.matapelajaran}</div><div class="class-name">${sesi.kelas}</div></div>
                        <div><button class="btn-icon text-primary" onclick="window.editSesi(${realIndex})">✎</button><button class="btn-icon text-danger" onclick="window.deleteSesi(${realIndex})">🗑</button></div>
                    </div>`;
            });
        } else {
            listHtml = `<div style="text-align:center; padding:20px; color:#ccc; font-style:italic;">Tiada kelas</div>`;
        }
        card.innerHTML = `<div class="day-header"><span>${hari}</span><span style="background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:10px; font-size:0.8rem;">${sesiHari.length} Sesi</span></div><div class="session-list">${listHtml}</div>`;
        grid.appendChild(card);
    });
}

/**
 * Menjana pilihan masa berdasarkan ketetapan sekolah:
 * - Mula: 7:10 am
 * - Jeda: 30 minit
 * - Rehat: 9:40 - 10:00 (20 minit)
 * - Tamat: 1:00 pm (13:00)
 */
function generateTimeOptions() {
    // Senarai masa yang ditetapkan secara manual (Hardcoded)
    // Ini memastikan masa 7:10 dan waktu rehat dipaparkan dengan tepat.
    const times = [
        "07:10", 
        "07:40", 
        "08:10", 
        "08:40", 
        "09:10", 
        "09:40", // Waktu Rehat Bermula / Kelas Tamat
        "10:00", // Waktu Rehat Tamat / Kelas Mula
        "10:30", 
        "11:00", 
        "11:30", 
        "12:00", 
        "12:30", 
        "13:00", // Waktu Balik
        "13:30"  // Buffer (jika ada kelas tambahan)
    ];

    let options = '';
    
    times.forEach(t => {
        // Kita boleh tambah label visual untuk waktu rehat jika mahu
        let label = t;
        if (t === "09:40") label = "09:40 (Rehat Mula)";
        if (t === "10:00") label = "10:00 (Rehat Tamat)";

        options += `<option value="${t}">${label}</option>`;
    });

    return options;
}

function openModal(index = null) {
    const modal = document.getElementById('modalForm');
    const title = document.getElementById('modalTitle');
    document.getElementById('inputSubjek').value = '';
    document.getElementById('inputKelas').value = '';
    document.getElementById('inputHari').value = 'Isnin';
    document.getElementById('inputMasaMula').selectedIndex = 0;
    document.getElementById('inputMasaTamat').selectedIndex = 1;

    if (index !== null) {
        editId = index;
        title.textContent = "✏️ Kemaskini Sesi";
        const data = currentJadual[index];
        document.getElementById('inputHari').value = data.hari;
        document.getElementById('inputMasaMula').value = data.masaMula;
        document.getElementById('inputMasaTamat').value = data.masaTamat;
        document.getElementById('inputSubjek').value = data.matapelajaran;
        document.getElementById('inputKelas').value = data.kelas;
    } else {
        editId = null;
        title.textContent = "➕ Tambah Sesi Baru";
    }
    modal.classList.add('active');
}

function closeModal() { document.getElementById('modalForm').classList.remove('active'); }

function saveSessionFromModal() {
    const hari = document.getElementById('inputHari').value;
    const mula = document.getElementById('inputMasaMula').value;
    const tamat = document.getElementById('inputMasaTamat').value;
    const subjek = document.getElementById('inputSubjek').value.toUpperCase();
    const kelas = document.getElementById('inputKelas').value.toUpperCase();

    if (!subjek || !kelas) { alert("Sila isi nama matapelajaran dan kelas."); return; }
    if (mula >= tamat) { alert("Masa tamat mesti selepas masa mula."); return; }

    const newSesi = { hari, masaMula: mula, masaTamat: tamat, matapelajaran: subjek, kelas };
    if (editId !== null) { currentJadual[editId] = newSesi; } else { currentJadual.push(newSesi); }
    closeModal(); renderJadual();
}

window.editSesi = (index) => openModal(index);
window.deleteSesi = (index) => { if (confirm("Padam sesi ini?")) { currentJadual.splice(index, 1); renderJadual(); } };

async function saveToFirebase() {
    const user = auth.currentUser;
    const btn = document.getElementById('btnSaveFirebase');
    if (!user) return;
    btn.textContent = "Sedang menyimpan..."; btn.disabled = true;
    try {
        await setDoc(doc(db, 'jadual', user.uid), { senarai: currentJadual, updatedAt: new Date() });
        alert("✅ Jadual Berjaya Disimpan!");
    } catch (e) {
        alert("❌ Ralat: " + e.message);
    } finally {
        btn.innerHTML = "💾 Simpan Jadual"; btn.disabled = false;
    }
}