import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from '../config.js'; 

// =========================================================================
// KONFIGURASI
// =========================================================================
const SCHOOL_START_DATE = new Date("2026-01-12"); 

const REFLECTION_BANK = {
    'BM': {
        pengukuhan: [
            "murid dapat menguasai objektif pembelajaran dengan baik hasil daripada aktiviti kumpulan.",
            "sebahagian besar murid menunjukkan minat yang mendalam dan mencapai tahap penguasaan yang disasarkan.",
            "murid memberikan respons yang sangat positif dan dapat menjawab soalan lisan dengan tepat.",
            "aktiviti yang dijalankan berjaya menarik minat murid untuk fokus sehingga akhir sesi."
        ],
        pemulihan: [
            "segelintir murid masih memerlukan bimbingan khusus untuk memahami konsep asas.",
            "terdapat murid yang kurang fokus dan memerlukan aktiviti intervensi yang lebih menarik pada masa akan datang.",
            "bimbingan rakan sebaya akan diteruskan bagi membantu murid yang lemah menguasai topik ini."
        ]
    },
    'BI': {
        pengukuhan: [
            "students were able to grasp the core concepts effectively through the group activities.",
            "majority of the pupils showed great interest and achieved the learning objectives.",
            "students participated actively and answered verbal questions correctly."
        ],
        pemulihan: [
            "a few students still need personal guidance to understand the basic vocabulary.",
            "peer coaching strategy will be implemented to help weaker students."
        ]
    },
    'ARAB': {
        pengukuhan: [
            "التلاميذ استوعبوا مهارات الدرس جيداً من خلال الأنشطة الجماعية", 
            "أظهر معظم التلاميذ اهتماماً كبيراً وحققوا أهداف التعلم"
        ],
        pemulihan: [
            "بعض التلاميذ لا يزالون بحاجة إلى توجيه خاص لفهم القواعد الأساسية",
            "سيتم استخدام استراتيجية تعليم الأقران لمساعدة التلاميذ الضعفاء"
        ]
    }
};

let teacherData = null;
let teacherRef = null;
let currentProcessingList = []; 

// =========================================================================
// 1. INIT
// =========================================================================
export function initJanaRPH(ref, data) {
    teacherRef = ref;
    teacherData = data;
    injectJanaStyles();
    renderDateSelectionModal();
}

function renderDateSelectionModal() {
    if(document.getElementById('janaModal')) document.getElementById('janaModal').remove();

    const html = `
    <div id="janaModal" class="modal-overlay">
        <div class="modal-content small-modal slide-up">
            <div class="modal-header">
                <h3>⚡ Jana RPH Automatik</h3>
                <button class="close-btn" onclick="document.getElementById('janaModal').remove()">✕</button>
            </div>
            <div class="modal-body">
                <p>Pilih julat tarikh untuk menjana RPH berdasarkan Jadual Waktu.</p>
                <div class="form-group">
                    <label>Tarikh Mula</label>
                    <input type="date" id="dateStart" class="full-width">
                </div>
                <div class="form-group">
                    <label>Tarikh Akhir</label>
                    <input type="date" id="dateEnd" class="full-width">
                </div>
                <button id="btnProceedJana" class="btn-primary full-width" style="margin-top:15px">
                    Semak Jadual & Senaraikan RPH
                </button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', html);
    
    document.getElementById('dateStart').valueAsDate = new Date();
    document.getElementById('dateEnd').valueAsDate = new Date();
    document.getElementById('btnProceedJana').onclick = processDateRange;
}

// =========================================================================
// 2. LOGIK CARI KELAS
// =========================================================================
function processDateRange() {
    const startStr = document.getElementById('dateStart').value;
    const endStr = document.getElementById('dateEnd').value;
    if(!startStr || !endStr) return;

    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    const schedule = teacherData.timetable || [];
    let rphList = [];
    let loopDate = new Date(startDate);

    while (loopDate <= endDate) {
        const days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
        const dayName = days[loopDate.getDay()];
        
        const classesToday = schedule.filter(c => c.day === dayName);

        classesToday.forEach(cls => {
            rphList.push({
                tempId: Math.random().toString(36).substr(2, 9),
                dateISO: loopDate.toISOString().split('T')[0],
                displayDate: loopDate.toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                day: dayName,
                week: calculateWeek(loopDate),
                ...cls
            });
        });

        loopDate.setDate(loopDate.getDate() + 1);
    }

    currentProcessingList = rphList;
    renderRphList(rphList);
}

function calculateWeek(date) {
    const diffTime = Math.abs(date - SCHOOL_START_DATE);
    // Masalah lama: Math.ceil(diffTime / ...) menyebabkan Isnin jatuh ke minggu sebelumnya
    
    // FORMULA BARU: Kita tambah 1 pada hasil bahagi hari
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
    const week = Math.floor(diffDays / 7) + 1;
    
    return week > 0 ? week : 1;
}

function renderRphList(list) {
    const modalBody = document.querySelector('#janaModal .modal-body');
    if (list.length === 0) {
        modalBody.innerHTML = `<div class="empty-state">Tiada kelas dijumpai dalam tarikh ini.</div>`;
        return;
    }

    const itemsHtml = list.map(item => `
        <div class="rph-preview-card" id="card-${item.tempId}">
            <div class="rph-info">
                <strong>${item.displayDate} (${item.day})</strong> - Minggu ${item.week}<br>
                ${item.subject} | ${item.className} | ${item.startTime}
            </div>
            <button class="btn-small" onclick="window.prepareRPH('${item.tempId}')">Jana</button>
        </div>
    `).join('');

    // Update HTML Modal Body dengan senarai
    modalBody.innerHTML = `
        <div class="list-header">
            <p>Ditemui <b>${list.length}</b> sesi PdPc.</p>
            <button id="btnBatch" class="btn-secondary" onclick="window.generateAllBatch()">⚡ Jana Semua</button>
        </div>
        <div class="rph-list-container">${itemsHtml}</div>
    `;
}

// =========================================================================
// 3. HELPER FUNCTIONS
// =========================================================================
function getJsonPath(subject, className) {
    // 1. Dapatkan Tahun dari nama kelas (Contoh: "6 Cerdas" -> "6")
    const yearMatch = className.match(/\d+/); 
    const year = yearMatch ? yearMatch[0] : '1'; 

    let folder = 'LAIN';
    let code = 'lain';

    // 2. Bersihkan nama subjek untuk elak isu huruf besar/kecil/jarak
    const s = subject.toUpperCase().trim();

    // 3. Mapping Subjek kepada Folder & Kod Fail
    if (s.includes('BAHASA MELAYU') || s === 'BM') { 
        folder = 'BM'; code = 'bm'; 
    } 
    else if (s.includes('BAHASA INGGERIS') || s.includes('ENGLISH') || s === 'BI') { 
        folder = 'BI'; code = 'bi'; 
    } 
    else if (s.includes('MATEMATIK') || s === 'MATH' || s === 'MT') { 
        folder = 'MT'; code = 'mt'; 
    } 
    else if (s.includes('SAINS') || s === 'SCIENCE' || s === 'SN') { 
        folder = 'SN'; code = 'sn'; 
    } 
    else if (s.includes('SEJARAH') || s === 'SEJ') { 
        folder = 'SEJ'; code = 'sej'; 
    } 
    else if (s.includes('AGAMA') || s.includes('ISLAM') || s === 'PAI' || s === 'PI') { 
        folder = 'PAI'; code = 'pai'; 
    } 
    else if (s.includes('ARAB') || s === 'BA') { 
        folder = 'BA'; code = 'ba'; 
    } 
    else if (s.includes('REKA BENTUK') || s === 'RBT') { 
        folder = 'RBT'; code = 'rbt'; 
    } 
    else if (s.includes('SENI') || s === 'PSV') { 
        folder = 'PSV'; code = 'psv'; 
    } 
    else if (s.includes('MUZIK') || s === 'MZ') { 
        folder = 'MZ'; code = 'mz'; 
    } 
    else if (s.includes('MORAL') || s === 'PM') { 
        folder = 'PM'; code = 'pm'; 
    } 
    else if (s.includes('JASMANI') || s.includes('KESIHATAN') || s === 'PJPK') { 
        folder = 'PJPK'; code = 'pjpk'; 
    }

    // 4. Pulangkan Path Lengkap
    // Pastikan folder 'assets' wujud dalam struktur projek anda
    return `data/SR/${folder}/${code}-${year}.json`;
}

function generateReflection(item) {
    let lang = 'BM'; // Default Bahasa Melayu untuk subjek umum (Matematik, Sains, Sejarah, dll)
    const sub = item.subject.toUpperCase();

    // Pengesanan Bahasa Refleksi
    if(sub.includes('ENGLISH') || sub.includes('INGGERIS') || sub === 'BI') {
        lang = 'BI';
    }
    else if(sub.includes('ARAB') || sub === 'BA') {
        lang = 'ARAB';
    }

    const bank = REFLECTION_BANK[lang] || REFLECTION_BANK['BM'];
    
    // Pilih ayat secara rawak dari bank
    const randPengukuhan = bank.pengukuhan[Math.floor(Math.random() * bank.pengukuhan.length)];
    const randPemulihan = bank.pemulihan[Math.floor(Math.random() * bank.pemulihan.length)];

    let text = "";
    
    if (lang === 'BI') {
        text += `Consolidation : PdPc on ${item.displayDate}, for class ${item.className} and subject ${item.subject}, ${randPengukuhan}\n`;
        text += `Remedial : PdPc on ${item.displayDate}, for class ${item.className} and subject ${item.subject}, ${randPemulihan}`;
    } 
    else if (lang === 'ARAB') {
        text += `التعزيز : الدرس في ${item.displayDate}، للصف ${item.className} ومادة ${item.subject}، ${randPengukuhan}\n`;
        text += `التصحيح : الدرس في ${item.displayDate}، للصف ${item.className} ومادة ${item.subject}، ${randPemulihan}`;
    } 
    else {
        // Format Bahasa Melayu (Digunakan juga untuk Matematik, Sains, dll)
        text += `Pengukuhan : PdPc pada ${item.displayDate}, untuk kelas ${item.className} dan matapelajaran ${item.subject}, ${randPengukuhan}\n`;
        text += `Pemulihan : PdPc pada ${item.displayDate}, untuk kelas ${item.className} dan matapelajaran ${item.subject}, ${randPemulihan}`;
    }
    
    return text;
}

// =========================================================================
// 4. LOGIK JANA SATU (SINGLE)
// =========================================================================
window.prepareRPH = async (tempId) => {
    const item = currentProcessingList.find(i => i.tempId === tempId);
    if(!item) return;

    const jsonPath = getJsonPath(item.subject, item.className);
    let rphContent = {}; 

    try {
        const res = await fetch(jsonPath);
        if(res.ok) {
            const fullData = await res.json();
            const weekKey = `MINGGU ${item.week}`;
            const found = fullData.find(d => d.minggu.toUpperCase() === weekKey);
            if(found) rphContent = found.content || {};
        }
    } catch (e) { console.warn("JSON error", e); }

    const reflection = generateReflection(item);
    openEditor(item, rphContent, reflection);
};

// =========================================================================
// 5. LOGIK JANA SEMUA (BATCH)
// =========================================================================
window.generateAllBatch = async () => {
    if(!confirm(`Anda pasti mahu menjana ${currentProcessingList.length} RPH secara automatik?`)) return;

    const btn = document.getElementById('btnBatch');
    const originalText = btn.textContent;
    btn.disabled = true;

    let successCount = 0;

    for (let i = 0; i < currentProcessingList.length; i++) {
        const item = currentProcessingList[i];
        btn.textContent = `Memproses (${i+1}/${currentProcessingList.length})...`;

        try {
            const jsonPath = getJsonPath(item.subject, item.className);
            let rphContent = {}; 
            try {
                const res = await fetch(jsonPath);
                if(res.ok) {
                    const fullData = await res.json();
                    const weekKey = `MINGGU ${item.week}`;
                    const found = fullData.find(d => d.minggu.toUpperCase() === weekKey);
                    if(found) rphContent = found.content || {};
                }
            } catch(e){}

            const reflection = generateReflection(item);
            const arrToString = (arr) => Array.isArray(arr) ? arr.join('\n') : (arr || '');
            const actToString = (arr) => Array.isArray(arr) ? arr.map(a => `${a.fase}: ${a.text}`).join('\n\n') : '';

            const finalData = {
                uid: teacherData.uid || teacherRef.id, 
                email: teacherData.email,
                subject: item.subject,
                className: item.className,
                dateISO: item.dateISO,
                week: item.week,
                status: 'draft', 
                createdAt: Timestamp.now(),
                
                tajuk: rphContent.tajuk || '',
                sk: arrToString(rphContent.sk),
                sp: arrToString(rphContent.sp),
                objektif: arrToString(rphContent.objektif),
                aktiviti: actToString(rphContent.aktiviti),
                refleksi: reflection,
                bbm: arrToString(rphContent.bbm),
                nilai: arrToString(rphContent.nilai)
            };

            await addDoc(collection(db, 'records'), finalData);
            
            const card = document.getElementById(`card-${item.tempId}`);
            if(card) {
                card.style.background = "#dcfce7";
                card.style.borderColor = "#86efac";
                card.innerHTML += `<span style="margin-left:auto; color:green; font-weight:bold;">✓ Disimpan</span>`;
            }
            
            successCount++;

        } catch (error) {
            console.error("Gagal item:", item, error);
        }
    }

    btn.textContent = originalText;
    btn.disabled = false;
    alert(`Proses Selesai! ${successCount}/${currentProcessingList.length} RPH berjaya dijana.`);
};

// =========================================================================
// 6. EDITOR MODAL
// =========================================================================
function openEditor(item, content, reflectionText) {
    const arrToString = (arr) => Array.isArray(arr) ? arr.join('\n') : (arr || '');
    const actToString = (arr) => Array.isArray(arr) ? arr.map(a => `${a.fase}: ${a.text}`).join('\n\n') : '';

    const html = `
    <div id="editorModal" class="modal-overlay" style="z-index:1100">
        <div class="modal-content full-screen-modal slide-up">
            <div class="modal-header">
                <h3>📝 Edit RPH: ${item.subject} (${item.displayDate})</h3>
                <div style="display:flex; gap:10px">
                    <button class="btn-secondary" onclick="document.getElementById('editorModal').remove()">Batal</button>
                    <button class="btn-primary" id="btnSaveFinal">💾 Simpan Draft</button>
                </div>
            </div>
            <div class="modal-body rph-editor-grid">
                <div class="editor-section">
                    <h4>Info Utama</h4>
                    <div class="form-row">
                        <div class="form-group"><label>Tajuk/Tema</label><input id="edTajuk" value="${content.tajuk || ''}"></div>
                        <div class="form-group"><label>Kemahiran</label><input id="edKemahiran" value="${content.kemahiran || ''}"></div>
                    </div>
                </div>
                <div class="editor-section">
                    <div class="form-row">
                        <div class="form-group half"><label>SK</label><textarea id="edSK" rows="4">${arrToString(content.sk)}</textarea></div>
                        <div class="form-group half"><label>SP</label><textarea id="edSP" rows="4">${arrToString(content.sp)}</textarea></div>
                    </div>
                    <div class="form-group"><label>Objektif</label><textarea id="edObj" rows="4">${arrToString(content.objektif)}</textarea></div>
                </div>
                <div class="editor-section">
                    <label>Aktiviti</label><textarea id="edAkt" rows="8" style="font-family:monospace">${actToString(content.aktiviti)}</textarea>
                </div>
                <div class="editor-section">
                    <label>Refleksi (Auto)</label><textarea id="edRef" rows="4" style="background:#f0fdf4; border-color:#22c55e;">${reflectionText}</textarea>
                </div>
                <div class="editor-section">
                    <div class="form-row">
                        <div class="form-group half"><label>BBM</label><textarea id="edBBM">${arrToString(content.bbm)}</textarea></div>
                        <div class="form-group half"><label>Nilai</label><textarea id="edNilai">${arrToString(content.nilai)}</textarea></div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('btnSaveFinal').onclick = async () => {
        const btn = document.getElementById('btnSaveFinal');
        btn.textContent = "Menyimpan...";
        
        const finalData = {
            uid: teacherData.uid || teacherRef.id, 
            email: teacherData.email,
            subject: item.subject,
            className: item.className,
            dateISO: item.dateISO,
            week: item.week,
            status: 'draft', 
            createdAt: Timestamp.now(),
            tajuk: document.getElementById('edTajuk').value,
            sk: document.getElementById('edSK').value,
            sp: document.getElementById('edSP').value,
            objektif: document.getElementById('edObj').value,
            aktiviti: document.getElementById('edAkt').value,
            refleksi: document.getElementById('edRef').value,
            bbm: document.getElementById('edBBM').value,
            nilai: document.getElementById('edNilai').value
        };

        try {
            await addDoc(collection(db, 'records'), finalData);
            alert("Berjaya disimpan!");
            document.getElementById('editorModal').remove();
            
            const card = document.getElementById(`card-${item.tempId}`); 
            if(card) {
                card.style.background = "#dcfce7";
                card.innerHTML += `<span style="color:green; font-weight:bold; margin-left:auto;">✓ Siap</span>`;
            }
        } catch (e) { alert("Gagal simpan: " + e.message); }
        btn.textContent = "💾 Simpan Draft";
    };
}

// =========================================================================
// 7. STYLES (DIKEMASKINI UNTUK ISU SCROLLING)
// =========================================================================
function injectJanaStyles() {
    if(document.getElementById('jana-css')) return;
    const style = document.createElement('style');
    style.id = 'jana-css';
    style.innerHTML = `
        /* MODAL OVERLAY */
        .modal-overlay { 
            position:fixed; top:0; left:0; width:100%; height:100%; 
            background:rgba(0,0,0,0.5); 
            display:flex; justify-content:center; align-items:center; 
            z-index:1000; backdrop-filter:blur(2px); 
        }

        /* MODAL CONTENT GENERAL */
        .modal-content { 
            background:#f8fafc; border-radius:12px; 
            display:flex; flex-direction:column; 
            box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);
            overflow: hidden; /* Pastikan anak tidak terkeluar */
        }

        /* KHAS UNTUK MODAL KECIL (Jana RPH List) - INI YANG KITA BAIKI */
        .small-modal { 
            width: 90%; 
            max-width: 600px; /* Lebarkan sedikit */
            max-height: 85vh; /* PENTING: Jangan lebih 85% tinggi skrin */
            background: white;
            padding: 0; /* Padding kita letak pada header/body */
        }

        /* KHAS UNTUK EDITOR (Full Screen) */
        .full-screen-modal { 
            width:95%; height:90%; max-width:1000px; 
        }

        /* HEADER & BODY SCROLLING */
        .modal-header { 
            padding: 15px 20px; 
            background: white; 
            border-bottom: 1px solid #e2e8f0; 
            display: flex; justify-content: space-between; align-items: center; 
            flex-shrink: 0; /* Jangan kecut */
        }
        
        .modal-body { 
            padding: 20px; 
            overflow-y: auto; /* INI YANG MEMBOLEHKAN SKROL */
            flex: 1; /* Ambil baki ruang tinggi yang ada */
        }

        .close-btn { background:none; border:none; font-size:1.5rem; cursor:pointer; }
        .slide-up { animation: slideUp 0.3s ease; }
        
        /* CARD STYLES */
        .rph-preview-card { 
            background:white; padding:15px; border-radius:8px; 
            border:1px solid #e2e8f0; 
            display:flex; justify-content:space-between; align-items:center; 
            margin-bottom:10px; 
        }
        .rph-info { font-size:0.9rem; color:#334155; }
        
        .list-header { 
            display:flex; justify-content:space-between; align-items:center; 
            margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid #eee; 
            position: sticky; top: 0; background: #f8fafc; z-index: 10; /* Header list melekat */
        }
        
        /* FORM STYLES */
        .rph-editor-grid { display:flex; flex-direction:column; gap:20px; }
        .editor-section { background:white; padding:15px; border-radius:8px; border:1px solid #f1f5f9; }
        .editor-section h4 { margin-top:0; color:#4f46e5; border-bottom:1px solid #eee; padding-bottom:10px; }
        .half { width: 48%; }
        .form-row { display:flex; gap:15px; justify-content: space-between; }
        .form-group { width: 100%; margin-bottom: 10px; }
        textarea, input { width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-family:inherit; resize:vertical; box-sizing: border-box; }
        
        .btn-small { padding: 5px 10px; background: #e0e7ff; color: #4338ca; border: none; border-radius: 4px; cursor: pointer; }
        .btn-small:hover { background: #4338ca; color: white; }
        
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    `;
    document.head.appendChild(style);
}