// assets/js/guru/rph-generator.js

import { auth, db } from '../config.js';
import { 
  doc, getDoc, collection, addDoc, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * HELPER: Menjana Refleksi Rawak Mengikut Bahasa
 * (Tanpa nombor __/__, memilih 1 daripada 7 ayat)
 */
function getAutoRefleksi(subjectName) {
    const s = subjectName.toUpperCase();
    let options = [];

    // 1. BAHASA INGGERIS (English Reflections)
    if (s.includes('INGGERIS') || s.includes('BI') || s.includes('ENGLISH') || s.includes('CEFR')) {
        options = [
            "Learning objectives were achieved successfully. All pupils were able to complete the tasks given.",
            "The lesson went smoothly. Pupils showed great interest and participated actively.",
            "Pupils were able to master the skills taught today. Enrichment activities were given.",
            "Most pupils achieved the learning objectives. Remedial guidance was given to a few pupils.",
            "The teaching and learning session was successful. Pupils responded positively to the activities.",
            "Objectives achieved. Pupils demonstrated good understanding of the topic.",
            "The lesson was conducted successfully. Pupils enjoyed the group activities conducted."
        ];
    }
    
    // 2. BAHASA ARAB (Arabic Reflections)
    else if (s.includes('ARAB') || s.includes('BA') || s.includes('AL-LUGHAH')) {
        options = [
            "تحققت أهداف التعلم بنجاح. تمكن التلاميذ من استيعاب الدرس جيدا.", // Objektif tercapai. Murid faham baik.
            "سارت الحصة الدراسية بسلاسة. أظهر التلاميذ تفاعلاً إيجابياً.", // Kelas lancar. Murid respon positif.
            "تمكن التلاميذ من إتقان المهارات المدروسة اليوم.", // Murid kuasai kemahiran hari ini.
            "أكمل معظم التلاميذ التدريبات الموكلة إليهم بنجاح.", // Kebanyakan murid siapkan latihan berjaya.
            "كانت الأنشطة ممتعة وشارك التلاميذ فيها بحماس.", // Aktiviti menyeronokkan, murid serta semangat.
            "تم تحقيق الأهداف. تم تقديم إرشادات إضافية للتلاميذ الذين يحتاجون للمساعدة.", // Objektif capai. Bimbingan diberi.
            "استجاب التلاميذ بشكل جيد لشرح المعلم والأنشطة الصفية." // Murid respon baik pada penerangan guru.
        ];
    }

    // 3. BAHASA MELAYU & LAIN-LAIN (General Reflections)
    else {
        options = [
            "Objektif pembelajaran tercapai. Murid dapat menguasai kemahiran yang diajar dengan baik.",
            "Sesi PdPc berjalan lancar dan murid mengambil bahagian secara aktif dalam aktiviti kumpulan.",
            "Murid menunjukkan minat yang mendalam terhadap topik hari ini dan menyiapkan tugasan.",
            "Sebahagian besar murid berjaya mencapai objektif. Latihan pengukuhan diberikan.",
            "Murid memberi respon yang sangat positif sepanjang sesi pembelajaran berlangsung.",
            "Objektif tercapai. Murid dapat menjawab soalan penilaian dengan tepat.",
            "PdPc dilaksanakan dengan jaya. Murid seronok melakukan aktiviti yang dirancang."
        ];
    }

    // Pilih satu secara rawak
    const randomIndex = Math.floor(Math.random() * options.length);
    return options[randomIndex];
}

/**
 * LOGIK UTAMA: Menjana Data RPH & Simpan ke Firestore
 */
async function createRphInDatabase(user, dateObj, sesi) {
    // 1. Dapatkan Tahun (Digit) untuk penentuan fail JSON
    const digitMatch = sesi.kelas.match(/\d/); 
    const yearDigit = digitMatch ? digitMatch[0] : "1"; 

    // 2. PEMETAAN SUBJEK (Subject Mapping)
    const subjectName = sesi.matapelajaran.toUpperCase();
    let filePrefix = 'sp-bi'; // Default fallback

    if (subjectName.includes('INGGERIS') || subjectName.includes('BI')) filePrefix = 'sp-bi';
    else if (subjectName.includes('MELAYU') || subjectName.includes('BM')) filePrefix = 'sp-bm';
    else if (subjectName.includes('REKA BENTUK') || subjectName.includes('RBT')) filePrefix = 'sp-rbt';
    else if (subjectName.includes('MATEMATIK') || subjectName.includes('MATE')) filePrefix = 'sp-mate';
    else if (subjectName.includes('SAINS')) filePrefix = 'sp-sains';
    else if (subjectName.includes('SEJARAH')) filePrefix = 'sp-sejarah';
    else if (subjectName.includes('ISLAM') || subjectName.includes('PAI')) filePrefix = 'sp-pai';
    else if (subjectName.includes('MORAL') || subjectName.includes('PM')) filePrefix = 'sp-pm';
    else if (subjectName.includes('ARAB') || subjectName.includes('BA')) filePrefix = 'sp-ba'; 
    else filePrefix = `sp-${sesi.matapelajaran.toLowerCase().replace(/\s+/g, '-')}`;

    const jsonUrl = `./data/${filePrefix}-${yearDigit}.json`; 

    // 3. FETCH DATA JSON
    const res = await fetch(jsonUrl);
    if(!res.ok) throw new Error(`Fail data ${filePrefix}-${yearDigit}.json tiada.`);
    const fullData = await res.json();

    let selectedUnitKey = "";
    let selectedItem = null;
    let skillName = "";

    // 4. LOGIK PEMILIHAN TOPIK (TAKWIM BULANAN)
    const currentMonth = dateObj.getMonth(); 

    if (Array.isArray(fullData)) {
        // --- Format Array ---
        const hasUnitKey = fullData.some(item => item.unit);
        const primaryField = hasUnitKey ? 'unit' : 'kategori'; 
        
        const uniqueUnits = [...new Set(fullData.map(item => item[primaryField] || "Topik Umum"))];
        const totalUnits = uniqueUnits.length;
        
        let targetIndex = Math.floor((currentMonth / 12) * totalUnits);
        if (targetIndex >= totalUnits) targetIndex = totalUnits - 1;

        selectedUnitKey = uniqueUnits[targetIndex];
        const filteredItems = fullData.filter(item => (item[primaryField] || "Topik Umum") === selectedUnitKey);
        
        // Pilih item rawak dalam unit
        selectedItem = filteredItems[Math.floor(Math.random() * filteredItems.length)];
        skillName = selectedItem.kategori || subjectName;

    } else {
        // --- Format Objek ---
        const tahunKey = `TAHUN ${yearDigit}`;
        const dataTahun = fullData[tahunKey] || fullData;
        const unitKeys = Object.keys(dataTahun);
        
        let targetIndex = Math.floor((currentMonth / 12) * unitKeys.length);
        if (targetIndex >= unitKeys.length) targetIndex = unitKeys.length - 1;

        selectedUnitKey = unitKeys[targetIndex];
        const selectedUnitData = dataTahun[selectedUnitKey];
        const skillKeys = Object.keys(selectedUnitData);
        skillName = skillKeys[Math.floor(Math.random() * skillKeys.length)];
        
        const skillItems = selectedUnitData[skillName];
        selectedItem = skillItems[Math.floor(Math.random() * skillItems.length)];
    }

    // 5. FORMAT DATA
    const formatArr = (val) => Array.isArray(val) ? val.join('\n') : (val || '-');

    const finalRphData = {
        tajuk: `${selectedUnitKey} (${skillName})`,
        objectives: selectedItem.objectives || selectedItem.standards || '-',
        activities: formatArr(selectedItem.activities),
        aids: formatArr(selectedItem.aids),
        penilaian: formatArr(selectedItem.assessment || selectedItem.penilaian)
    };

    // --- BARU: DAPATKAN REFLEKSI RAWAK ---
    const randomRefleksi = getAutoRefleksi(subjectName);

    // 6. SIMPAN KE FIRESTORE
    await addDoc(collection(db, 'rph'), {
        uid: user.uid,
        tarikh: Timestamp.fromDate(dateObj),
        matapelajaran: sesi.matapelajaran,
        kelas: sesi.kelas,
        masaMula: sesi.masaMula,
        masaTamat: sesi.masaTamat,
        status: 'draft',
        createdAt: Timestamp.now(),
        dataRPH: finalRphData, 
        refleksi: randomRefleksi // Masukkan ayat rawak
    });

    return `${sesi.matapelajaran} (${sesi.kelas})`;
}

/**
 * UI PENJANA RPH (Filter Julat Tarikh)
 */
export function loadRphGenerator() {
  const content = document.getElementById('content');
  
  content.innerHTML = `
    <style>
      .generator-container { max-width: 850px; margin: 20px auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
      .header-box { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; margin-bottom: 25px; padding-bottom: 15px; }
      
      .filter-row { display: flex; gap: 15px; background: #f8fafc; padding: 20px; border-radius: 10px; margin-bottom: 20px; align-items: flex-end; flex-wrap: wrap; border: 1px solid #e2e8f0; }
      .filter-item { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 150px; }
      .filter-item label { font-size: 0.8rem; font-weight: bold; color: #64748b; }
      .filter-item input { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; }
      
      .class-list-item { background: white; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; transition: 0.2s; }
      .class-list-item:hover { border-color: #3b82f6; background: #f0f7ff; }
      .date-badge { background: #1e293b; color: white; padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; margin-bottom: 5px; display: inline-block; }
      
      .btn-generate-all { background: #10b981; color: white; border: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%; margin-bottom: 20px; font-size: 1rem; }
      .btn-generate-all:disabled { background: #cbd5e1; cursor: not-allowed; }
      .btn-single { padding: 8px 15px; border-radius: 6px; border: 1px solid #3b82f6; background: white; color: #3b82f6; cursor: pointer; font-weight: 600; }
      .btn-single:hover { background: #3b82f6; color: white; }
    </style>

    <div class="generator-container">
      <div class="header-box">
         <h2 style="margin:0; color:#1e293b;">⚡ Penjana RPH Automatik</h2>
         <button class="btn btn-secondary" onclick="window.router.navigate('guru-home')">⬅ Kembali</button>
      </div>

      <div class="filter-row">
        <div class="filter-item">
          <label>Tarikh Mula:</label>
          <input type="date" id="genStartDate">
        </div>
        <div class="filter-item">
          <label>Tarikh Akhir:</label>
          <input type="date" id="genEndDate">
        </div>
        <button class="btn btn-primary" style="height:42px;" onclick="window.findClassesInRange()">Cari Kelas</button>
      </div>

      <div id="genActionArea"></div>
      <div id="classListArea">
        <p style="text-align:center; color:#94a3b8; padding:30px;">Pilih julat tarikh untuk melihat senarai kelas.</p>
      </div>
    </div>
  `;

  // Default tarikh: Hari Ini
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('genStartDate').value = today;
  document.getElementById('genEndDate').value = today;
}

/**
 * FUNGSI: Cari Kelas Dalam Julat Tarikh
 */
window.findClassesInRange = async () => {
    const startStr = document.getElementById('genStartDate').value;
    const endStr = document.getElementById('genEndDate').value;
    const listArea = document.getElementById('classListArea');
    const actionArea = document.getElementById('genActionArea');

    if (!startStr || !endStr) return;

    listArea.innerHTML = '<p style="text-align:center; padding:20px;">⏳ Menyusun jadual...</p>';
    actionArea.innerHTML = '';

    try {
        const user = auth.currentUser;
        const jadualSnap = await getDoc(doc(db, 'jadual', user.uid));
        
        if (!jadualSnap.exists()) {
            listArea.innerHTML = '<p style="color:red; text-align:center;">Jadual tidak ditemui.</p>';
            return;
        }

        const jadualData = jadualSnap.data().senarai || [];
        const HARI_MS = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
        
        let current = new Date(startStr);
        const end = new Date(endStr);
        let allFoundClasses = [];

        // Loop setiap hari
        while (current <= end) {
            const namaHari = HARI_MS[current.getDay()];
            const kelasHariIni = jadualData.filter(j => j.hari === namaHari);
            
            kelasHariIni.forEach(k => {
                allFoundClasses.push({
                    ...k,
                    tarikhObj: new Date(current),
                    tarikhStr: current.toISOString().split('T')[0],
                    hariLabel: namaHari
                });
            });
            current.setDate(current.getDate() + 1); // Tambah 1 hari
        }

        if (allFoundClasses.length === 0) {
            listArea.innerHTML = '<p style="text-align:center; padding:20px;">Tiada kelas dalam julat tarikh ini.</p>';
            return;
        }

        // Paparkan Butang Pukal
        const bulkData = encodeURIComponent(JSON.stringify(allFoundClasses));
        actionArea.innerHTML = `
            <button class="btn-generate-all" id="btnBulk" onclick="window.bulkGenerateRph('${bulkData}')">
                🚀 Jana Semua (${allFoundClasses.length} RPH) + Auto Refleksi
            </button>
        `;

        // Paparkan Senarai
        let html = '<h4 style="margin-bottom:15px; color:#475569;">Senarai Kelas Ditemui:</h4>';
        allFoundClasses.forEach((kelas) => {
            const classData = encodeURIComponent(JSON.stringify(kelas));
            html += `
                <div class="class-list-item">
                    <div>
                        <span class="date-badge">${kelas.tarikhStr} (${kelas.hariLabel})</span><br>
                        <strong style="color:#1e293b;">${kelas.matapelajaran}</strong> | ${kelas.kelas}<br>
                        <small style="color:#64748b;">${kelas.masaMula} - ${kelas.masaTamat}</small>
                    </div>
                    <button class="btn-single" onclick="window.singleGenerateRph('${classData}', this)">Jana</button>
                </div>
            `;
        });
        listArea.innerHTML = html;

    } catch (e) {
        listArea.innerHTML = `<p style="color:red;">Ralat: ${e.message}</p>`;
    }
};

/**
 * EVENT: Jana Satu Sahaja
 */
window.singleGenerateRph = async (encodedData, btn) => {
    const data = JSON.parse(decodeURIComponent(encodedData));
    btn.disabled = true;
    btn.textContent = "⌛";

    try {
        await createRphInDatabase(auth.currentUser, new Date(data.tarikhStr), data);
        btn.textContent = "✅ Siap";
        btn.style.background = "#dcfce7";
        btn.style.color = "#166534";
        btn.style.borderColor = "#86efac";
    } catch (e) {
        alert("Ralat: " + e.message);
        btn.disabled = false;
        btn.textContent = "Jana";
    }
};

/**
 * EVENT: Jana Pukal (Bulk)
 */
window.bulkGenerateRph = async (encodedData) => {
    const list = JSON.parse(decodeURIComponent(encodedData));
    if (!confirm(`Jana ${list.length} RPH dengan Refleksi Rawak?`)) return;

    const btn = document.getElementById('btnBulk');
    btn.disabled = true;
    btn.textContent = "Sedang menjana... Sila tunggu.";

    try {
        for (const item of list) {
            await createRphInDatabase(auth.currentUser, new Date(item.tarikhStr), item);
        }
        alert("✅ Semua RPH berjaya dijana dengan refleksi rawak!");
        window.router.navigate('guru-rph-history');
    } catch (e) {
        alert("Ralat: " + e.message);
        btn.disabled = false;
        btn.textContent = "🚀 Cuba Semula";
    }
};