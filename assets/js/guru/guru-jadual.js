// assets/js/guru/guru-jadual.js
// VERSI BERSIH & MUKTAMAD

import { updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { MAP_SUBJECT_TO_FILE } from '../config.js'; 

let teacherRef = null;
let teacherData = null;
const ORDER_DAYS = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad'];

export function initJadualModule(ref, data) {
    if (!ref) {
        alert("Ralat Sistem: Data guru tidak lengkap.");
        return;
    }

    teacherRef = ref;
    teacherData = data;
    
    // Pastikan array wujud
    if (!Array.isArray(teacherData.timetable)) {
        teacherData.timetable = [];
    }

    injectCardStyles();
    renderLayout();
}

function renderLayout() {
    // Buang modal lama jika ada
    if(document.getElementById('jadualModal')) {
        document.getElementById('jadualModal').remove();
    }

    const html = `
    <div id="jadualModal" class="modal-overlay">
        <div class="modal-content full-screen-modal">
            <div class="modal-header">
                <div>
                    <h2>📅 Jadual Waktu Mengajar</h2>
                    <p class="subtitle">Uruskan masa dan kelas anda di sini</p>
                </div>
                <button class="close-btn" id="btnCloseJadual">✕</button>
            </div>
            
            <div class="modal-body">
                <div class="action-bar">
                    <button id="btnAddNew" class="btn-add">
                        <span class="plus-icon">+</span> Tambah Kelas Baru
                    </button>
                </div>
                <div id="scheduleContainer" class="schedule-container"></div>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    
    // Event Listeners
    document.getElementById('btnCloseJadual').onclick = () => document.getElementById('jadualModal').remove();
    document.getElementById('btnAddNew').onclick = () => showFormModal();

    renderCards();
}

function renderCards() {
    const container = document.getElementById('scheduleContainer');
    container.innerHTML = '';
    const jadwal = teacherData.timetable || [];

    if (jadwal.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Tiada jadual waktu direkodkan.</p>
                <p>Klik butang <b>+ Tambah Kelas Baru</b> untuk bermula.</p>
            </div>`;
        return;
    }

    ORDER_DAYS.forEach(day => {
        const todaysClasses = jadwal.filter(item => item.day === day);

        if (todaysClasses.length > 0) {
            // Susun ikut masa
            todaysClasses.sort((a, b) => a.startTime.localeCompare(b.startTime));

            let cardsHtml = '';
            todaysClasses.forEach((item) => {
                // Cari index sebenar dalam array asal
                const realIndex = jadwal.indexOf(item);
                
                cardsHtml += `
                    <div class="class-card">
                        <div class="card-time">
                            <span>${formatTime(item.startTime)} - ${formatTime(item.endTime)}</span>
                        </div>
                        <div class="card-details">
                            <span class="card-subject">${item.subject}</span>
                            <span class="card-class">${item.className}</span>
                        </div>
                        <button class="btn-delete-card" onclick="window.deleteJadualItem(${realIndex})" title="Padam Kelas">🗑</button>
                    </div>
                `;
            });

            container.innerHTML += `
                <div class="day-group">
                    <div class="day-header">${day}</div>
                    <div class="cards-wrapper">
                        ${cardsHtml}
                    </div>
                </div>
            `;
        }
    });
}

// Fungsi Padam (Exposed to Window)
window.deleteJadualItem = async (index) => {
    if(!confirm("Adakah anda pasti mahu memadam kelas ini?")) return;

    const currentList = teacherData.timetable || [];
    currentList.splice(index, 1); // Buang item

    await performSave(currentList, false); // false = tak perlu alert popup, cuma refresh
};

function showFormModal() {
    // Guna senarai subjek dari config, atau fallback default
    const subjects = typeof MAP_SUBJECT_TO_FILE !== 'undefined' ? Object.keys(MAP_SUBJECT_TO_FILE) : ['BAHASA MELAYU','BAHASA INGGERIS','MATEMATIK','SAINS','SEJARAH'];
    
    const subjectOptions = subjects.map(k => `<option value="${k}">${k}</option>`).join('');

    const html = `
    <div id="formModal" class="modal-overlay" style="z-index: 2000;">
        <div class="modal-content small-modal slide-up">
            <h3>Tambah Kelas</h3>
            <form id="addScheduleForm">
                
                <div class="form-group">
                    <label>Hari</label>
                    <select id="inpDay" required>
                        <option value="Isnin">Isnin</option>
                        <option value="Selasa">Selasa</option>
                        <option value="Rabu">Rabu</option>
                        <option value="Khamis">Khamis</option>
                        <option value="Jumaat">Jumaat</option>
                    </select>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Mula</label>
                        <input type="time" id="inpStart" required>
                    </div>
                    <div class="form-group">
                        <label>Tamat</label>
                        <input type="time" id="inpEnd" required>
                    </div>
                </div>

                <div class="form-group">
                    <label>Subjek</label>
                    <select id="inpSubject" required>
                        <option value="">-- Pilih Subjek --</option>
                        ${subjectOptions}
                        <option value="PERHIMPUNAN">PERHIMPUNAN</option>
                        <option value="REHAT">REHAT</option>
                        <option value="AKTIVITI LUAR">AKTIVITI LUAR</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Nama Kelas</label>
                    <input type="text" id="inpClass" placeholder="Contoh: 3 Cerdas" required>
                </div>

                <div class="btn-group">
                    <button type="button" class="btn-secondary" onclick="document.getElementById('formModal').remove()">Batal</button>
                    <button type="submit" class="btn-primary">Simpan</button>
                </div>
            </form>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('addScheduleForm').onsubmit = async (e) => {
        e.preventDefault();
        
        const newItem = {
            day: document.getElementById('inpDay').value,
            startTime: document.getElementById('inpStart').value,
            endTime: document.getElementById('inpEnd').value,
            subject: document.getElementById('inpSubject').value,
            className: document.getElementById('inpClass').value.toUpperCase()
        };

        // Validasi ringkas
        if (newItem.startTime >= newItem.endTime) {
            alert("Masa Tamat mesti selepas Masa Mula.");
            return;
        }

        const currentList = teacherData.timetable || [];
        currentList.push(newItem); 

        await performSave(currentList, true);
        document.getElementById('formModal').remove();
    };
}

// Fungsi Simpan (Backend)
async function performSave(newList, showSuccessAlert = true) {
    try {
        await updateDoc(teacherRef, { timetable: newList });
        
        // Update data local supaya tak perlu fetch database semula
        teacherData.timetable = newList;
        renderCards(); // Refresh paparan UI
        
        if (showSuccessAlert) {
            alert("Berjaya disimpan!");
        }
    } catch (e) {
        console.error("Ralat Firestore:", e);
        alert("Gagal simpan data. Sila cuba lagi.");
    }
}

// Helper Format Masa
function formatTime(timeStr) {
    if(!timeStr) return '';
    const [h, m] = timeStr.split(':');
    let H = parseInt(h);
    const ampm = H >= 12 ? 'PM' : 'AM';
    H = H % 12 || 12;
    return `${H}:${m} ${ampm}`;
}

// Styles
function injectCardStyles() {
    if(document.getElementById('jadual-clean-css')) return;
    const style = document.createElement('style');
    style.id = 'jadual-clean-css';
    style.innerHTML = `
        .modal-overlay { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; z-index:1000; backdrop-filter:blur(2px); }
        .modal-content { background:#f8fafc; border-radius:12px; display:flex; flex-direction:column; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); }
        .full-screen-modal { width:95%; height:90%; max-width:1000px; overflow:hidden; }
        .small-modal { width:90%; max-width:420px; padding:25px; background:white; }
        
        .modal-header { padding:20px; background:white; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; }
        .modal-header h2 { margin:0; font-size:1.4rem; color:#1e293b; }
        .subtitle { margin:0; font-size:0.9rem; color:#64748b; }
        .close-btn { background:none; border:none; font-size:1.5rem; cursor:pointer; color:#64748b; }
        
        .modal-body { padding:20px; overflow-y:auto; flex:1; }
        .action-bar { margin-bottom:20px; text-align:right; }
        .btn-add { background:#4f46e5; color:white; padding:10px 20px; border:none; border-radius:8px; cursor:pointer; font-weight:600; display:inline-flex; align-items:center; gap:8px; transition:0.2s; }
        .btn-add:hover { background:#4338ca; }

        .schedule-container { display:flex; flex-direction:column; gap:25px; }
        .day-group { animation: fadeIn 0.3s ease; }
        .day-header { font-weight:800; color:#334155; margin-bottom:15px; border-bottom:2px solid #e2e8f0; padding-bottom:5px; text-transform:uppercase; letter-spacing:0.5px; font-size:0.9rem; }
        
        .cards-wrapper { display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:15px; }
        .class-card { background:white; padding:15px; border-radius:10px; border-left:5px solid #4f46e5; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); position:relative; transition:transform 0.2s; }
        .class-card:hover { transform:translateY(-3px); box-shadow:0 10px 15px -3px rgba(0,0,0,0.1); }
        
        .card-time { font-size:0.8rem; color:#64748b; font-weight:600; background:#f1f5f9; display:inline-block; padding:3px 8px; border-radius:4px; margin-bottom:8px; }
        .card-details { display:flex; flex-direction:column; }
        .card-subject { font-weight:700; color:#1e293b; font-size:1rem; }
        .card-class { font-size:0.9rem; color:#475569; margin-top:2px; }
        
        .btn-delete-card { position:absolute; top:10px; right:10px; border:none; background:none; cursor:pointer; color:#cbd5e1; font-size:1.1rem; transition:0.2s; }
        .btn-delete-card:hover { color:#ef4444; transform:scale(1.1); }

        /* Form */
        .form-group { margin-bottom:15px; }
        .form-row { display:flex; gap:15px; }
        .form-group label { display:block; margin-bottom:6px; font-weight:600; color:#334155; font-size:0.9rem; }
        .form-group input, .form-group select { width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-size:1rem; box-sizing:border-box; }
        
        .btn-group { display:flex; gap:10px; justify-content:flex-end; margin-top:25px; }
        .btn-primary { background:#4f46e5; color:white; padding:10px 24px; border:none; border-radius:6px; cursor:pointer; font-weight:600; }
        .btn-secondary { background:#e2e8f0; color:#475569; padding:10px 24px; border:none; border-radius:6px; cursor:pointer; font-weight:600; }
        .empty-state { text-align:center; padding:40px; color:#94a3b8; border:2px dashed #e2e8f0; border-radius:12px; }

        @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    `;
    document.head.appendChild(style);
}