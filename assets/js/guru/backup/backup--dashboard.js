import { auth, db } from '../config.js';
import { 
    collection, addDoc, query, where, getDocs, doc, deleteDoc, Timestamp, orderBy, getDoc, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =========================================================
// 1. INIT DASHBOARD GURU
// =========================================================
export async function loadGuruDashboard() {
    const container = document.getElementById('main-content');
    if (!container) return;

    const user = auth.currentUser;
    const userName = user.displayName || user.email;

    container.innerHTML = `
        <div class="guru-container" style="max-width: 1100px; margin: 0 auto; padding: 20px;">
            
            <header style="margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h2 style="color: #1e3a8a; margin: 0 0 5px 0;">Dashboard Guru</h2>
                    <p style="color: #64748b; margin:0;">Selamat datang, <strong>${userName}</strong></p>
                </div>
                <button onclick="window.showGuruMenu()" id="btnHomeGuru" style="display:none; background:#64748b; color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer;">
                    🏠 Menu Utama
                </button>
            </header>

            <div id="view-guru-menu" class="guru-view" style="display:block;">
                <div class="grid-menu" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                    
                    <div class="card-menu" onclick="window.switchGuruView('view-jadual')" style="${cardStyle('#f59e0b')}">
                        <div style="font-size: 2.5em; margin-bottom: 10px;">📅</div>
                        <h3 style="margin:0;">Jadual Waktu</h3>
                        <p style="font-size:0.9rem; margin-top:5px; color:#fef3c7;">Tetapkan jadual kelas mingguan anda.</p>
                    </div>

                    <div class="card-menu" onclick="window.switchGuruView('view-jana-rph')" style="${cardStyle('#2563eb')}">
                        <div style="font-size: 2.5em; margin-bottom: 10px;">🤖</div>
                        <h3 style="margin:0;">Jana RPH Automatik</h3>
                        <p style="font-size:0.9rem; margin-top:5px; color:#bfdbfe;">Pilih tarikh & jana RPH dari data.</p>
                    </div>

                    <div class="card-menu" onclick="window.switchGuruView('view-sejarah')" style="${cardStyle('#10b981')}">
                        <div style="font-size: 2.5em; margin-bottom: 10px;">📂</div>
                        <h3 style="margin:0;">Sejarah & Status</h3>
                        <p style="font-size:0.9rem; margin-top:5px; color:#d1fae5;">Lihat, Edit & Hantar RPH.</p>
                    </div>

                </div>
            </div>

            <div id="view-jadual" class="guru-view" style="display:none;">
                <div style="background:white; padding:25px; border-radius:10px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                    <h3>📅 Tetapan Jadual Waktu Induk</h3>
                    <p style="color:#666; font-size:0.9rem;">Sistem akan merujuk jadual ini untuk menjana RPH anda.</p>

                    <form id="formJadual" style="background:#f8fafc; padding:15px; border-radius:8px; margin-bottom:20px; border:1px solid #e2e8f0;">
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:10px;">
                            <select id="jHari" class="input-std" required>
                                <option value="1">Isnin</option><option value="2">Selasa</option><option value="3">Rabu</option>
                                <option value="4">Khamis</option><option value="5">Jumaat</option>
                            </select>
                            <input type="time" id="jMasaMula" class="input-std" required>
                            <input type="time" id="jMasaTamat" class="input-std" required>
                            <input type="text" id="jKelas" placeholder="Nama Kelas (Cth: 1 Arif)" class="input-std" required>
                            <input type="text" id="jSubjek" placeholder="Subjek (Cth: BM, MT)" class="input-std" required>
                        </div>
                        <button type="submit" style="margin-top:10px; background:#2563eb; color:white; padding:8px 20px; border:none; border-radius:5px; cursor:pointer;">+ Tambah Slot</button>
                    </form>

                    <table class="std-table">
                        <thead><tr><th>Hari</th><th>Masa</th><th>Kelas</th><th>Subjek</th><th>Aksi</th></tr></thead>
                        <tbody id="tbodyJadual"><tr><td colspan="5">Memuatkan...</td></tr></tbody>
                    </table>
                </div>
            </div>

            <div id="view-jana-rph" class="guru-view" style="display:none;">
                <div style="background:white; padding:30px; border-radius:10px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                    <h3>🤖 Penjana RPH Automatik</h3>
                    
                    <div style="display:flex; gap:15px; flex-wrap:wrap; align-items:end;">
                        <div>
                            <label style="font-weight:bold; font-size:0.9rem;">Tarikh Mula</label>
                            <input type="date" id="dateStart" class="input-std">
                        </div>
                        <div>
                            <label style="font-weight:bold; font-size:0.9rem;">Tarikh Akhir</label>
                            <input type="date" id="dateEnd" class="input-std">
                        </div>
                        <div>
                             <label style="font-weight:bold; font-size:0.9rem;">Minggu</label>
                             <select id="weekSelect" class="input-std">
                                ${generateWeekOptions()}
                             </select>
                        </div>
                        <button onclick="window.previewRPH()" style="background:#2563eb; color:white; padding:10px 25px; border:none; border-radius:6px; cursor:pointer; height:42px;">
                            🔍 Cari
                        </button>
                    </div>

                    <div id="previewArea" style="margin-top:30px; border-top:2px dashed #e2e8f0; padding-top:20px; display:none;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                             <h4>Hasil Carian:</h4>
                             <button onclick="window.generateAllRPH()" id="btnGenerateAll" style="background:#16a34a; color:white; padding:8px 20px; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.9rem; display:none;">
                                ⚡ Jana Semua
                            </button>
                        </div>
                        
                        <table class="std-table">
                            <thead><tr><th>Tarikh</th><th>Kelas</th><th>Info</th><th>Tindakan</th></tr></thead>
                            <tbody id="tbodyPreview"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div id="view-sejarah" class="guru-view" style="display:none;">
                <div class="table-container">
                    <h3>📂 Senarai RPH</h3>
                    <div style="margin-bottom:15px;">
                        <button onclick="loadRPHList('draft')" class="filter-btn active-filter">Draf</button>
                        <button onclick="loadRPHList('hantar')" class="filter-btn">Dihantar</button>
                        <button onclick="loadRPHList('disahkan')" class="filter-btn">Disahkan</button>
                    </div>
                    <table class="std-table">
                        <thead><tr><th>Tarikh</th><th>Kelas</th><th>Subjek/Topik</th><th>Status</th><th>Tindakan</th></tr></thead>
                        <tbody id="tbodyRPHList"></tbody>
                    </table>
                </div>
            </div>

             <div id="view-edit-rph" class="guru-view" style="display:none;">
                <div style="background:white; padding:30px; border-radius:10px;">
                    <div style="display:flex; justify-content:space-between;">
                        <h3>✏️ Edit RPH</h3>
                        <button onclick="window.switchGuruView('view-sejarah')" style="background:#eee; border:none; padding:5px 10px; cursor:pointer;">Tutup</button>
                    </div>
                    <form id="formEditRPH">
                        <input type="hidden" id="editDocId">
                        
                        <div class="form-grid">
                            <div><label>Tarikh</label><input type="text" id="eTarikh" class="input-std" readonly></div>
                            <div><label>Kelas</label><input type="text" id="eKelas" class="input-std" readonly></div>
                            <div><label>Masa</label><input type="text" id="eMasa" class="input-std"></div>
                            <div><label>Tajuk</label><input type="text" id="eTajuk" class="input-std"></div>
                        </div>

                        <div style="margin-top:15px;"><label>Standard Pembelajaran (SP)</label><textarea id="eSP" rows="3" class="input-std"></textarea></div>
                        <div style="margin-top:10px;"><label>Objektif</label><textarea id="eObjektif" rows="3" class="input-std"></textarea></div>
                        <div style="margin-top:10px;"><label>Aktiviti</label><textarea id="eAktiviti" rows="4" class="input-std"></textarea></div>
                        
                        <div class="form-grid" style="margin-top:10px;">
                            <div><label>BBM</label><input type="text" id="eBBM" class="input-std"></div>
                            <div><label>Nilai</label><input type="text" id="eNilai" class="input-std"></div>
                        </div>

                        <div style="margin-top:10px;"><label>Refleksi</label><textarea id="eRefleksi" rows="3" class="input-std"></textarea></div>

                        <div style="margin-top:20px; display:flex; gap:10px;">
                            <button type="button" onclick="window.saveDraftRPH()" style="background:#f59e0b; color:white; padding:10px 20px; border:none; border-radius:5px; cursor:pointer;">Simpan Draf</button>
                            <button type="submit" style="background:#2563eb; color:white; padding:10px 20px; border:none; border-radius:5px; cursor:pointer;">🚀 Hantar ke Penyelia</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <style>
            .input-std { width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; margin-top:5px; box-sizing:border-box; }
            .std-table { width:100%; border-collapse:collapse; background:white; margin-top:15px; }
            .std-table th { background:#f8fafc; padding:10px; text-align:left; border-bottom:2px solid #e2e8f0; }
            .std-table td { padding:10px; border-bottom:1px solid #f1f5f9; vertical-align:top; }
            .card-menu { padding:20px; border-radius:10px; color:white; cursor:pointer; text-align:center; transition:0.2s; }
            .card-menu:hover { transform:translateY(-3px); }
            .filter-btn { padding:5px 15px; border:1px solid #cbd5e1; background:white; border-radius:20px; cursor:pointer; margin-right:5px; }
            .active-filter { background:#2563eb; color:white; border-color:#2563eb; }
            .form-grid { display:grid; grid-template-columns: 1fr 1fr; gap:15px; }
            .btn-action { padding:5px 10px; border-radius:4px; border:none; cursor:pointer; margin-right:5px; font-size:0.85rem; }
        </style>
    `;

    setupGuruLogic();
    document.getElementById('formJadual').addEventListener('submit', handleAddJadual);
    document.getElementById('formEditRPH').addEventListener('submit', handleSubmitRPH);
    
    loadJadual(); 
}

// =========================================================
// 2. LOGIK HELPER UI
// =========================================================
function cardStyle(color) {
    return `background:${color}; box-shadow:0 4px 6px rgba(0,0,0,0.1);`;
}

function generateWeekOptions() {
    let html = '';
    for(let i=1; i<=42; i++) {
        html += `<option value="${i}">Minggu ${i}</option>`;
    }
    return html;
}

function setupGuruLogic() {
    window.switchGuruView = (viewId) => {
        document.querySelectorAll('.guru-view').forEach(el => el.style.display = 'none');
        document.getElementById(viewId).style.display = 'block';
        
        const btn = document.getElementById('btnHomeGuru');
        btn.style.display = (viewId === 'view-guru-menu') ? 'none' : 'block';

        if(viewId === 'view-sejarah') loadRPHList('draft'); 
    };
    window.showGuruMenu = () => window.switchGuruView('view-guru-menu');
}

// =========================================================
// 3. LOGIK JADUAL WAKTU
// =========================================================
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
    const tbody = document.getElementById('tbodyJadual');
    tbody.innerHTML = '<tr><td colspan="5">Memuatkan...</td></tr>';

    const q = query(collection(db, 'timetable'), where('uid', '==', user.uid), orderBy('hari'));
    try {
        const snap = await getDocs(q);
        if(snap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Tiada jadual. Sila tambah slot kelas.</td></tr>';
            return;
        }
        const hariMap = {1:'Isnin', 2:'Selasa', 3:'Rabu', 4:'Khamis', 5:'Jumaat'};
        let html = '';
        snap.forEach(doc => {
            const d = doc.data();
            html += `
                <tr>
                    <td>${hariMap[d.hari]}</td>
                    <td>${d.masaMula} - ${d.masaTamat}</td>
                    <td>${d.kelas}</td>
                    <td>${d.subjek}</td>
                    <td><button onclick="window.deleteJadual('${doc.id}')" style="color:red; border:none; background:none; cursor:pointer;">🗑️ Padam</button></td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5">Ralat: ${e.message}</td></tr>`;
    }
}

window.deleteJadual = async (id) => {
    if(!confirm('Padam slot ini?')) return;
    try { await deleteDoc(doc(db, 'timetable', id)); loadJadual(); } 
    catch(e) { alert("Gagal padam: " + e.message); }
};

// =========================================================
// 4. LOGIK JANA RPH (PREVIEW & INDIVIDUAL GENERATE)
// =========================================================
let previewData = []; 

function getFileFromSubjectAndClass(subjectName, className) {
    const s = subjectName.toLowerCase();
    const yearMatch = className.match(/[1-6]/); 
    const year = yearMatch ? yearMatch[0] : '1'; 

    let code = '';
    if (s.match(/\bbm\b/) || s.includes('bahasa melayu')) code = 'bm';
    else if (s.match(/\bbi\b/) || s.includes('bahasa inggeris') || s.includes('english')) code = 'bi';
    else if (s.match(/\bmt\b/) || s.includes('mathematics') || s.includes('matematik') || s.includes('math')) code = 'mt';
    else if (s.match(/\bsc\b/) || s.includes('science') || s.includes('sains')) code = 'sc';
    else if (s.match(/\bpai\b/) || s.includes('agama islam') || s.includes('jawi') || s.includes('agama')) code = 'pai';
    else if (s.match(/\bsj\b/) || s.includes('sejarah')) code = 'sj';
    else if (s.match(/\bpm\b/) || s.includes('moral')) code = 'pm';
    else if (s.match(/\bpj\b/) || s.includes('jasmani')) code = 'pj';
    else if (s.match(/\bpk\b/) || s.includes('kesihatan')) code = 'pk';
    else if (s.match(/\bpsv\b/) || s.includes('seni visual') || s.includes('seni')) code = 'psv';
    else if (s.match(/\bmz\b/) || s.includes('muzik')) code = 'mz';
    else if (s.match(/\bba\b/) || s.includes('bahasa arab') || s.includes('arab')) code = 'ba';
    else if (s.match(/\btas\b/) || s.includes('tasmik')) code = 'tas';
    else if (s.match(/\brbt\b/) || s.includes('reka bentuk') || s.includes('teknologi')) code = 'rbt';
    else { return null; }

    const folder = code.toUpperCase();
    return `${folder}/${code}-d${year}.json`;
}

window.previewRPH = async () => {
    const startStr = document.getElementById('dateStart').value;
    const endStr = document.getElementById('dateEnd').value;
    const weekNum = document.getElementById('weekSelect').value;

    if(!startStr || !endStr) { alert("Sila pilih tarikh mula dan akhir."); return; }

    const tbody = document.getElementById('tbodyPreview');
    const previewArea = document.getElementById('previewArea');
    const user = auth.currentUser;

    tbody.innerHTML = '<tr><td colspan="4">Sedang mengimbas data...</td></tr>';
    previewArea.style.display = 'block';

    try {
        const q = query(collection(db, 'timetable'), where('uid', '==', user.uid));
        const scheduleSnap = await getDocs(q);
        const schedule = [];
        scheduleSnap.forEach(d => schedule.push(d.data()));

        if(schedule.length === 0) {
             tbody.innerHTML = '<tr><td colspan="4" style="color:red;">Tiada jadual waktu ditemui.</td></tr>';
             return;
        }

        let currentDate = new Date(startStr);
        const endDate = new Date(endStr);
        previewData = []; 
        
        // Cache fail yang sudah ditarik supaya tidak fetch berulang kali
        const fileCache = {};

        while(currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay(); 
            const dateStr = currentDate.toLocaleDateString('en-CA'); 
            const niceDate = currentDate.toLocaleDateString('ms-MY');

            const classesToday = schedule.filter(s => s.hari === dayOfWeek);

            for (let cls of classesToday) {
                let topicData = "Tiada Data";
                let rawData = null;
                let status = "gagal";
                
                let fileName = getFileFromSubjectAndClass(cls.subjek, cls.kelas); 

                if (!fileName) {
                    topicData = `Subjek '${cls.subjek}' tidak dikenali.`;
                } else {
                    try {
                        let jsonData = fileCache[fileName];
                        if(!jsonData) {
                            const response = await fetch(`./data/SR/${fileName}`);
                            if(response.ok) {
                                jsonData = await response.json();
                                fileCache[fileName] = jsonData;
                            }
                        }
                        
                        if(!jsonData) {
                            topicData = `Fail ${fileName} tiada.`;
                        } else {
                            const weekData = jsonData.find(w => w.minggu == weekNum);
                            if(weekData && weekData.rph && weekData.rph.length > 0) {
                                rawData = weekData.rph[0]; 
                                topicData = rawData.tajuk || "Tajuk Dijumpai";
                                status = "boleh";
                            } else {
                                topicData = `Tiada data Minggu ${weekNum} dalam fail.`;
                            }
                        }

                    } catch(e) { topicData = `Ralat baca fail.`; }
                }

                if(status === "boleh") {
                    previewData.push({
                        date: dateStr,
                        niceDate: niceDate,
                        time: `${cls.masaMula} - ${cls.masaTamat}`,
                        class: cls.kelas,
                        subject: cls.subjek,
                        rawData: rawData 
                    });
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        renderPreviewTable();

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="4">Ralat Sistem: ${e.message}</td></tr>`;
    }
};

// Fungsi Render Semula Jadual (Penting untuk fungsi Padam)
function renderPreviewTable() {
    const tbody = document.getElementById('tbodyPreview');
    const btnAll = document.getElementById('btnGenerateAll');
    
    if(previewData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Tiada data untuk dijana.</td></tr>';
        btnAll.style.display = 'none';
        return;
    }
    
    btnAll.style.display = 'inline-block';
    let html = '';
    
    previewData.forEach((item, index) => {
        let langLabel = item.rawData.langMode || 'Auto';
        
        html += `
            <tr id="row-${index}">
                <td>${item.niceDate}<br><small>${getDayName(new Date(item.date).getDay())}</small></td>
                <td>${item.class}<br><small>${item.time}</small></td>
                <td>
                    <strong>${item.subject}</strong><br>
                    ${item.rawData.tajuk}<br>
                    <small style="color:#666;">Mode: ${langLabel}</small>
                </td>
                <td>
                    <button class="btn-action" style="background:#10b981; color:white;" onclick="window.generateSingleRPH(${index})">
                        ⚡ Jana
                    </button>
                    <button class="btn-action" style="background:#ef4444; color:white;" onclick="window.removePreviewItem(${index})">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// 1. Fungsi Padam Item dari Preview
window.removePreviewItem = (index) => {
    previewData.splice(index, 1);
    renderPreviewTable();
};

// 2. Helper bina data RPH (Supaya boleh guna untuk Single & All)
function buildRPHData(item, user) {
    const d = item.rawData;

    const randomSP = getRandomItems(d.sp_list || [], 3).map(i => `${i.code} - ${i.desc}`).join('\n');
    let objArr = d.objektif || ["Murid dapat menguasai tajuk ini."];
    const randomObj = getRandomItems(objArr, 3).join('\n');
    const randomAkt = getRandomItems(d.aktiviti || [], 3).join('\n');
    const randomBBM = getRandomItems(d.bbm || [], 3).join(', ');
    const randomNilai = getRandomItems(d.nilai || [], 3).join(', ');

    // Logik Bahasa Refleksi
    let lang = 'BM'; 
    if(d.langMode) lang = d.langMode.toUpperCase();
    else {
        const subLower = item.subject.toLowerCase();
        if(subLower.match(/bi|english|math|mt|sc|science/)) lang = 'EN';
        else if(subLower.match(/ba|arab/)) lang = 'AR';
        else if(subLower.match(/jawi|pai|agama|tas/)) lang = 'JAWI';
    }

    const template = getReflectionTemplate(lang);
    const randomEnding = template.endings[Math.floor(Math.random() * template.endings.length)];
    const refleksi = `${template.prefix(item.niceDate, item.class, item.subject)} ${randomEnding}`;

    return {
        uid: user.uid,
        teacherName: user.displayName || user.email,
        teacherEmail: user.email,
        schoolId: user.email, 
        tarikh: item.date,
        masa: item.time,
        kelas: item.class,
        subject: item.subject,
        tajuk: d.tajuk,
        sp: randomSP,
        objektif: randomObj,
        aktiviti: randomAkt,
        bbm: randomBBM,
        nilai: randomNilai,
        refleksi: refleksi,
        status: 'draft',
        createdAt: Timestamp.now(),
        penyeliaId: '' 
    };
}

// 3. Fungsi Jana SATU RPH
window.generateSingleRPH = async (index) => {
    const item = previewData[index];
    const user = auth.currentUser;
    const btn = document.querySelector(`#row-${index} button`);
    
    if(!confirm(`Jana RPH untuk ${item.subject} (${item.class})?`)) return;

    btn.textContent = "...";
    btn.disabled = true;

    try {
        const data = buildRPHData(item, user);
        await addDoc(collection(db, 'rph'), data);
        
        // Buang dari list lepas berjaya
        previewData.splice(index, 1);
        renderPreviewTable();
        alert("Berjaya dijana!");
    } catch(e) {
        alert("Ralat: " + e.message);
        btn.textContent = "⚡ Jana";
        btn.disabled = false;
    }
};

// 4. Fungsi Jana SEMUA RPH
window.generateAllRPH = async () => {
    if(previewData.length === 0) return;
    if(!confirm(`Adakah anda pasti mahu menjana ${previewData.length} RPH serentak?`)) return;

    const btn = document.getElementById('btnGenerateAll');
    btn.textContent = "Sedang Menjana..."; 
    btn.disabled = true;
    
    const user = auth.currentUser;
    let count = 0;

    try {
        for(let item of previewData) {
            const data = buildRPHData(item, user);
            await addDoc(collection(db, 'rph'), data);
            count++;
        }
        alert(`${count} RPH berjaya dijana!`);
        window.switchGuruView('view-sejarah'); 
    } catch(e) {
        console.error(e);
        alert("Ralat: " + e.message);
    } finally {
        btn.textContent = "⚡ Jana Semua"; 
        btn.disabled = false;
    }
};

// Helper Templates Refleksi
function getReflectionTemplate(lang) {
    const t = {
        'BM': {
            prefix: (date, cls, subj) => `PdPc pada tarikh ${date}, untuk kelas ${cls} dan bagi matapelajaran ${subj}`,
            endings: [
                "telah berjalan dengan lancar. Kesemua murid dapat mengikuti aktiviti yang dijalankan dengan baik.",
                "berjaya mencapai objektif yang ditetapkan. Murid menunjukkan minat yang mendalam sepanjang sesi.",
                "memerlukan sedikit penambahbaikan dari segi pengurusan masa. Sebilangan murid perlukan bimbingan lanjut.",
                "dilaksanakan dengan jayanya. Murid dapat menjawab soalan pengukuhan dengan betul dan tepat."
            ]
        },
        'EN': {
            prefix: (date, cls, subj) => `The lesson on ${date}, for class ${cls} and subject ${subj}`,
            endings: [
                "was conducted successfully. All pupils were able to follow the activities well.",
                "achieved the set objectives. Pupils showed deep interest throughout the session.",
                "requires minor improvements in time management. A few pupils need further guidance.",
                "was carried out successfully. Pupils were able to answer reinforcement questions correctly."
            ]
        },
        'AR': {
            prefix: (date, cls, subj) => `تم تنفيذ الدرس في تاريخ ${date} للصف ${cls} لمادة ${subj}`,
            endings: [
                "بنجاح. استطاع جميع التلاميذ متابعة الأنشطة بشكل جيد.",
                "وحقق الأهداف المرجوة. أظهر التلاميذ اهتماماً كبيراً طوال الحصة.",
                "بشكل جيد، ولكن يحتاج بعض التلاميذ إلى توجيه إضافي.",
                "بنجاح. تمكن التلاميذ من الإجابة على أسئلة التعزيز بشكل صحيح."
            ]
        },
        'JAWI': {
            prefix: (date, cls, subj) => `ڤ د ڤ چ ڤد تاريخ ${date}، اونتوق كلس ${cls} دان باڬي ماتڤلاجرن ${subj}`,
            endings: [
                "تله برجالن دڠن لنچر. كسموا موريد داڤت مڠيكوتي اكتيۏيتي يڠ دجالنكن دڠن باءيق.",
                "برجاي منچاڤاي اوبجيكتيف يڠ دتتڤكن. موريد منونجوقكن مينت يڠ مندالم سڤنجڠ سيسي.",
                "ممرلوكن سديكيت ڤنمبهباءيقن دري سڬي ڤڠوروسن ماس. سبيلهڠن موريد ڤرلوكن بيمبيڠن لنجوت."
            ]
        }
    };
    return t[lang] || t['BM'];
}

function getRandomItems(arr, n) {
    if(!Array.isArray(arr)) return [];
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
}

function getDayName(num) {
    return ['Ahad','Isnin','Selasa','Rabu','Khamis','Jumaat','Sabtu'][num];
}

// =========================================================
// 5. LOGIK SEJARAH (LIST, EDIT, DELETE)
// =========================================================
window.loadRPHList = async (statusFilter) => {
    const user = auth.currentUser;
    const tbody = document.getElementById('tbodyRPHList');
    tbody.innerHTML = '<tr><td colspan="5">Memuatkan...</td></tr>';
    
    // UI Filter Active State
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active-filter');
        if (btn.getAttribute('onclick').includes(`'${statusFilter}'`)) {
            btn.classList.add('active-filter');
        }
    });

    try {
        const q = query(
            collection(db, 'rph'), 
            where('uid', '==', user.uid),
            where('status', '==', statusFilter),
            orderBy('tarikh', 'desc')
        );
        const snap = await getDocs(q);
        
        if(snap.empty) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Tiada rekod.</td></tr>`;
            return;
        }

        let html = '';
        snap.forEach(doc => {
            const d = doc.data();
            const dateDisplay = d.tarikh ? d.tarikh.split('-').reverse().join('/') : '-';

            // Butang Edit/Lihat
            let mainBtn = `<button class="btn-action" style="background:#2563eb; color:white;" onclick="window.openEditRPH('${doc.id}')">✏️ Edit</button>`;
            if(statusFilter !== 'draft') {
                mainBtn = `<button class="btn-action" style="background:#64748b; color:white;" onclick="window.openEditRPH('${doc.id}')">👁️ Lihat</button>`;
            }

            // Butang Padam (Baru Ditambah)
            let deleteBtn = `<button class="btn-action" style="background:#ef4444; color:white;" onclick="window.deleteRPH('${doc.id}')">🗑️</button>`;

            html += `
                <tr>
                    <td>${dateDisplay}</td>
                    <td>${d.kelas}</td>
                    <td>${d.subject}<br><small>${d.tajuk}</small></td>
                    <td><span style="font-weight:bold; text-transform:uppercase; font-size:0.8rem;">${d.status}</span></td>
                    <td>
                        ${mainBtn}
                        ${deleteBtn}
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5">Ralat: ${e.message}</td></tr>`;
    }
};

// Fungsi Padam RPH dari Database
window.deleteRPH = async (docId) => {
    if(!confirm("Adakah anda pasti mahu memadam RPH ini secara kekal?")) return;
    
    try {
        await deleteDoc(doc(db, 'rph', docId));
        // Cari tab mana yang sedang aktif untuk refresh list yang betul
        const activeBtn = document.querySelector('.active-filter');
        let currentStatus = 'draft';
        if(activeBtn && activeBtn.getAttribute('onclick').includes('hantar')) currentStatus = 'hantar';
        if(activeBtn && activeBtn.getAttribute('onclick').includes('disahkan')) currentStatus = 'disahkan';
        
        loadRPHList(currentStatus);
    } catch(e) {
        alert("Gagal memadam: " + e.message);
    }
};

window.openEditRPH = async (docId) => {
    window.switchGuruView('view-edit-rph');
    try {
        const snap = await getDoc(doc(db, 'rph', docId));
        if(!snap.exists()) return;
        const d = snap.data();

        document.getElementById('editDocId').value = docId;
        document.getElementById('eTarikh').value = d.tarikh;
        document.getElementById('eKelas').value = d.kelas;
        document.getElementById('eMasa').value = d.masa;
        document.getElementById('eTajuk').value = d.tajuk;
        
        document.getElementById('eSP').value = d.sp;
        document.getElementById('eObjektif').value = d.objektif;
        document.getElementById('eAktiviti').value = d.aktiviti;
        document.getElementById('eBBM').value = d.bbm;
        document.getElementById('eNilai').value = d.nilai;
        document.getElementById('eRefleksi').value = d.refleksi || '';

    } catch(e) { console.error(e); }
};

window.saveDraftRPH = async () => {
    const docId = document.getElementById('editDocId').value;
    const data = getFormData();
    try {
        await updateDoc(doc(db, 'rph', docId), data);
        alert("Draf disimpan.");
    } catch(e) { alert("Ralat: " + e.message); }
};

async function handleSubmitRPH(e) {
    e.preventDefault();
    if(!confirm("Hantar RPH ini kepada penyelia?")) return;

    const docId = document.getElementById('editDocId').value;
    const data = getFormData();
    data.status = 'hantar';
    
    try {
        await updateDoc(doc(db, 'rph', docId), data);
        alert("RPH Berjaya Dihantar!");
        window.switchGuruView('view-sejarah');
    } catch(e) { alert("Ralat: " + e.message); }
}

function getFormData() {
    return {
        masa: document.getElementById('eMasa').value,
        tajuk: document.getElementById('eTajuk').value,
        sp: document.getElementById('eSP').value,
        objektif: document.getElementById('eObjektif').value,
        aktiviti: document.getElementById('eAktiviti').value,
        bbm: document.getElementById('eBBM').value,
        nilai: document.getElementById('eNilai').value,
        refleksi: document.getElementById('eRefleksi').value
    };
}