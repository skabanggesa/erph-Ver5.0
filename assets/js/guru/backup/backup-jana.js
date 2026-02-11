import { auth, db } from '../config.js';
import { 
    collection, addDoc, query, where, getDocs, Timestamp, doc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getRandomItems, getDayName } from './guru-utils.js';

let previewData = []; 
const fileCache = {}; 
let teacherProfile = null; 

// =========================================================
// 1. DATA KANDUNGAN SISTEM (Label & Ayat)
// =========================================================
const SYSTEM_CONTENT = {
    'BM': {
        labels: {
            // Aktiviti
            act1: "SET INDUKSI",
            act2: "PERKEMBANGAN",
            act3: "PENUTUP",
            // Refleksi
            refKukuh: "PENGUKUHAN",
            refPulih: "PEMULIHAN",
            // Prefix Refleksi
            getPrefix: (d, c, s) => `PdPc pada ${d}, kelas ${c}, subjek ${s} telah dilaksanakan.`
        },
        induksi: [
            "Guru menayangkan video pendek berkaitan topik dan bersoal jawab dengan murid.",
            "Guru menunjukkan gambar rangsangan dan meminta murid meneka tajuk pelajaran.",
            "Guru mengimbas kembali pelajaran lalu dan mengaitkan dengan tajuk hari ini.",
            "Murid diminta menyanyikan lagu berkaitan tajuk untuk menaikkan semangat.",
            "Guru membawa objek maujud ke dalam kelas dan meminta murid memerhatikannya."
        ],
        perkembangan: [
            "Murid dibahagikan kepada kumpulan kecil dan membincangkan isi pelajaran (Round Table).",
            "Guru menerangkan konsep utama menggunakan peta minda di papan putih.",
            "Murid menjalankan aktiviti 'Gallery Walk' untuk melihat hasil kerja kumpulan lain.",
            "Murid melengkapkan lembaran kerja secara individu dengan bimbingan guru.",
            "Aktiviti 'Hot Seat': Seorang murid menjawab soalan rakan-rakan lain di hadapan kelas."
        ],
        penutup: [
            "Guru membuat rumusan ringkas mengenai topik yang dipelajari hari ini.",
            "Murid menjawab kuiz ringkas secara lisan untuk menguji kefahaman.",
            "Sesi soal jawab terbuka antara guru dan murid untuk menutup sesi.",
            "Murid diminta menyatakan satu nilai murni yang diperolehi daripada kelas hari ini."
        ],
        pengukuhan: [
            "Murid diberikan latihan pengayaan yang lebih mencabar.",
            "Murid membimbing rakan sebaya yang lemah (Guru Muda).",
            "Murid diberikan lembaran kerja tambahan untuk memantapkan pemahaman."
        ],
        pemulihan: [
            "Murid diberikan bimbingan terus secara personal oleh guru.",
            "Murid membuat pembetulan serta-merta dengan bantuan guru.",
            "Murid diberikan latihan asas yang lebih mudah difahami."
        ]
    },
    'EN': {
        labels: {
            act1: "INTRODUCTION",
            act2: "PROGRESSIONS",
            act3: "CLOSING",
            refKukuh: "REINFORCEMENT",
            refPulih: "REMEDIAL",
            getPrefix: (d, c, s) => `Lesson on ${d}, class ${c}, subject ${s} was conducted successfully.`
        },
        induksi: [
            "Teacher plays a short video related to the topic and asks simple questions.",
            "Teacher shows stimulus pictures and asks pupils to guess the topic.",
            "Teacher recalls previous lesson and relates it to today's topic.",
            "Pupils sing a song related to the theme to arouse interest.",
            "Teacher creates a mystery box activity to introduce the lesson."
        ],
        perkembangan: [
            "Pupils work in groups to discuss the topic (Round Table activity).",
            "Teacher explains the main concept using a mind map on the whiteboard.",
            "Pupils conduct a 'Gallery Walk' to view other groups' work.",
            "Pupils complete worksheets individually with teacher's guidance.",
            "Pupils participate in a role-play activity based on the situation."
        ],
        penutup: [
            "Teacher summarizes the lesson and highlights key points.",
            "Pupils answer a simple verbal quiz to test understanding.",
            "Q&A session between teacher and pupils to wrap up the class.",
            "Pupils engage in a 'Traffic Light' self-assessment activity."
        ],
        pengukuhan: [
            "Pupils are given enrichment exercises.",
            "Pupils help their peers as 'Little Teachers'.",
            "Pupils are given extra worksheets to strengthen understanding."
        ],
        pemulihan: [
            "Pupils receive direct personal guidance from the teacher.",
            "Pupils do immediate corrections with teacher's help.",
            "Pupils are given simplified exercises to build confidence."
        ]
    },
    'AR': {
        labels: {
            act1: "المقدمة",
            act2: "تطور الدرس",
            act3: "الخاتمة",
            refKukuh: "التعزيز",
            refPulih: "المعالجة",
            getPrefix: (d, c, s) => `تم تنفيذ الدرس في تاريخ ${d} للصف ${c} لمادة ${s}.`
        },
        induksi: [
            "يعرض المعلم فيديو قصير يتعلق بالموضوع ويطرح أسئلة بسيطة.",
            "يعرض المعلم صوراً ويطلب من التلاميذ تخمين موضوع الدرس.",
            "يراجع المعلم الدرس السابق ويربطه بدرس اليوم.",
            "ينشد التلاميذ نشيداً يتعلق بالموضوع لإثارة الاهتمام."
        ],
        perkembangan: [
            "يناقش التلاميذ الموضوع في مجموعات صغيرة.",
            "يشرح المعلم المفهوم الأساسي باستخدام الخرائط الذهنية.",
            "يقوم التلاميذ بجولة (Gallery Walk) لمشاهدة أعمال المجموعات الأخرى.",
            "يكمل التلاميذ ورقة العمل بشكل فردي بتوجيه من المعلم.",
            "يقوم التلاميذ بتمثيل حوار بسيط أمام الفصل."
        ],
        penutup: [
            "يلخص المعلم النقاط الرئيسية للدرس.",
            "يجيب التلاميذ على أسئلة شفهية بسيطة لاختبار الفهم.",
            "جلسة سؤال وجواب لختم الحصة.",
            "يطلب المعلم من التلاميذ ذكر قيمة أخلاقية تعلموها."
        ],
        pengukuhan: [
            "تم إعطاء تمارين إضافية للتلاميذ المتقنين.",
            "يقوم التلاميذ المتميزون بمساعدة أصدقائهم.",
            "تم تكليف التلاميذ بإنشاء جمل جديدة بأنفسهم."
        ],
        pemulihan: [
            "تم تقديم توجيه فردي ومباشر من قبل المعلم.",
            "يقوم التلاميذ بالتصحيح الفوري بمساعدة المعلم.",
            "تم إعطاء تمارين مبسطة ليسهل فهمها."
        ]
    },
    'JAWI': {
        labels: {
            act1: "سيت ايندوكسي",
            act2: "ڤركمبڠن",
            act3: "ڤنوتوڤ",
            refKukuh: "ڤڠوكوهن",
            refPulih: "ڤموليهن",
            getPrefix: (d, c, s) => `ڤ د ڤ چ ڤد تاريخ ${d}، اونتوق كلس ${c} دان باڬي ماتڤلاجرن ${s} تله دلقسانكن.`
        },
        induksi: [
            "ڬورو ماناياڠكن ۏيديو ڤينديق بركاءيتن توڤيق دان برسوال جواب.",
            "ڬورو منونجوقكن ڬمبر رڠساڠن دان ممينتا موريد منكا تاجوق.",
            "ڬورو مڠيمبس كمبالي ڤلاجرن لالو دان مڠاءيتكن دڠن هاري اين.",
            "موريد دمينتا مڽاوبوت حروف/ڤركاتاءن جاوي يڠ دتوليس دڤاڤن ڤوتيه."
        ],
        perkembangan: [
            "موريد دباهاڬيكن كڤد كومڤولن كچيل اونتوق لاتيهن منوليس جاوي.",
            "ڬورو منرڠكن قاعده ڤنوليسن يڠ بتول دڤاڤن ڤوتيه.",
            "موريد منجالنكن اكتيۏيتي 'Gallery Walk' اونتوق مليهت توليسن راكن.",
            "موريد ملڠكڤكن لمبرن كرجا جاوي سچارا اينديۏيدو.",
            "اكتيۏيتي لاتيه توبي ممباچا تيك س جاوي ريڠكس."
        ],
        penutup: [
            "ڬورو ممبوات روموسن ريڠكس مڠناءي ڤلاجرن هاري اين.",
            "موريد منجواب كويز ريڠكس مڠيجا ڤركاتاءن جاوي.",
            "سيسي سوال جواب تربوك انتارا ڬورو دان موريد.",
            "موريد دمينتا ممباچا سمولا ڤركاتاءن يڠ دڤلاجري سچارا كلس."
        ],
        pengukuhan: [
            "موريد دبريكن لاتيهن ڤڠاياءن منوليس جاوي.",
            "موريد ممبيمبيڠ راكن سباي يڠ لمه (ڬورو مودا).",
            "موريد دبريكن تيك س باچاءن جاوي تبهن."
        ],
        pemulihan: [
            "موريد دبريكن بيمبيڠن چارا مڽامبوڠ حروف دڠن بتول.",
            "موريد ممبوات ڤمبتولن سرتا-مرتا دڠن بنتوان ڬورو.",
            "موريد دبريكن لاتيهن ايجاءن يڠ لبيه موده."
        ]
    }
};

// =========================================================
// 2. INIT JANA
// =========================================================
export async function initJana() {
    window.previewRPH = previewRPH;
    window.generateAllRPH = generateAllRPH;
    window.generateSingleRPH = generateSingleRPH;
    window.removePreviewItem = removePreviewItem;

    // Load awal profil (Optional, untuk UX)
    const user = auth.currentUser;
    if (user) {
        try {
            const docRef = doc(db, 'teachers', user.email);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                teacherProfile = docSnap.data();
            }
        } catch (e) {
            console.error("Ralat init profil:", e);
        }
    }
}

// =========================================================
// 3. CONFIG SUBJEK & PENGESANAN BAHASA
// =========================================================
function getSubjectConfig(subjectName, className) {
    const s = subjectName.toLowerCase();
    const c = className.toLowerCase();
    
    // 1. TENTUKAN BAHASA
    let lang = 'BM'; 

    if (s.match(/\bbi\b/) || s.includes('english') || s.includes('inggeris') || s.includes('cefr') || s.includes('language')) {
        lang = 'EN';
    }
    // DLP Detection (Science/Math in English)
    else if (s.includes('science') || s.includes('math') || s.includes('physic') || s.includes('chem') || s.includes('bio')) {
        lang = 'EN'; 
    }
    else if (s.match(/\bba\b/) || s.includes('bahasa arab') || s.includes('arab') || s.includes('lughah')) {
        lang = 'AR';
    }
    else if (s.includes('jawi') || s.includes('tasmik') || s.includes('khat')) {
        lang = 'JAWI';
    }

    // 2. TENTUKAN TAHAP
    let level = 'SR'; 
    let prefix = 'd'; 
    let year = '1';

    const smMatch = c.match(/t\s?([1-6])/i) || c.match(/form\s?([1-6])/i) || c.match(/tingkatan\s?([1-6])/i);
    if (smMatch) {
        level = 'SM'; 
        prefix = 't'; 
        year = smMatch[1];
    } else {
        const srMatch = c.match(/[1-6]/); 
        if (srMatch) year = srMatch[0];
    }

    // 3. KOD FAIL
    let code = 'bm'; 
    if (lang === 'EN') code = 'bi';
    else if (lang === 'AR') code = 'ba';
    else if (s.match(/\bmt\b/) || s.includes('mate') || s.includes('math')) code = 'mt';
    else if (s.match(/\bsc\b/) || s.includes('sain') || s.includes('science')) code = 'sc';
    else if (s.match(/\bpai\b/) || s.includes('agama')) code = 'pai';
    else if (s.match(/\bsj\b/) || s.includes('sejarah')) code = 'sj';
    else if (s.match(/\brbt\b/)) code = 'rbt';
    else if (s.match(/\bpm\b/)) code = 'pm';
    else if (s.match(/\bpj\b/)) code = 'pj';
    else if (s.match(/\bpk\b/)) code = 'pk';
    else if (s.match(/\bpsv\b/)) code = 'psv';
    else if (s.match(/\bmz\b/)) code = 'mz';

    if(lang === 'JAWI') code = 'pai'; 

    const folder = code.toUpperCase();
    
    return {
        fileName: `${folder}/${code}-${prefix}${year}.json`,
        langMode: lang, 
        level: level
    };
}

// =========================================================
// 4. PREVIEW RPH
// =========================================================
async function previewRPH() {
    const startStr = document.getElementById('dateStart').value;
    const endStr = document.getElementById('dateEnd').value;
    const weekNum = document.getElementById('weekSelect').value;

    if(!startStr || !endStr) { alert("Sila pilih tarikh mula dan akhir."); return; }

    const tbody = document.getElementById('tbodyPreview');
    const previewArea = document.getElementById('previewArea');
    const user = auth.currentUser;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Sedang mengimbas jadual...</td></tr>';
    previewArea.style.display = 'block';

    try {
        const qJadual = query(collection(db, 'timetable'), where('uid', '==', user.uid));
        const scheduleSnap = await getDocs(qJadual);
        const schedule = [];
        scheduleSnap.forEach(d => schedule.push(d.data()));

        if(schedule.length === 0) {
             tbody.innerHTML = '<tr><td colspan="4" style="color:red; text-align:center;">Tiada jadual waktu.</td></tr>';
             return;
        }

        // Check Existing
        const qExisting = query(
            collection(db, 'rph'), 
            where('uid', '==', user.uid),
            where('tarikh', '>=', startStr),
            where('tarikh', '<=', endStr)
        );
        const existingSnap = await getDocs(qExisting);
        const existingSet = new Set();
        existingSnap.forEach(doc => {
            const d = doc.data();
            existingSet.add(`${d.tarikh}_${d.kelas}_${d.subject}`);
        });

        let currentDate = new Date(startStr);
        const endDate = new Date(endStr);
        previewData = []; 
        
        while(currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay(); 
            const dateStr = currentDate.toLocaleDateString('en-CA'); 
            const niceDate = currentDate.toLocaleDateString('ms-MY');

            const classesToday = schedule.filter(s => s.hari === dayOfWeek);

            for (let cls of classesToday) {
                let topicData = "Tiada Data";
                let rawData = null;
                let status = "gagal";
                let isExist = existingSet.has(`${dateStr}_${cls.kelas}_${cls.subjek}`);
                
                const config = getSubjectConfig(cls.subjek, cls.kelas);
                
                if (config.fileName) {
                    try {
                        let jsonData = fileCache[config.fileName];
                        if(!jsonData) {
                            const rootPath = config.level === 'SM' ? './data/SM/' : './data/SR/';
                            const response = await fetch(`${rootPath}${config.fileName}`);
                            if(response.ok) {
                                jsonData = await response.json();
                                fileCache[config.fileName] = jsonData; 
                            }
                        }
                        
                        if(jsonData) {
                            const weekData = jsonData.find(w => w.minggu == weekNum);
                            if(weekData && weekData.rph && weekData.rph.length > 0) {
                                rawData = weekData.rph[0]; 
                                topicData = rawData.tajuk || "Tajuk Dijumpai";
                                status = "boleh";
                            }
                        }
                    } catch(e) { }
                }

                if(status === "boleh") {
                    previewData.push({
                        date: dateStr,
                        niceDate: niceDate,
                        time: `${cls.masaMula} - ${cls.masaTamat}`,
                        class: cls.kelas,
                        subject: cls.subjek,
                        week: weekNum,
                        langMode: config.langMode, 
                        rawData: rawData,
                        isExist: isExist 
                    });
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        renderPreviewTable();

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="4">Ralat: ${e.message}</td></tr>`;
    }
}

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
        let actionBtn = item.isExist 
            ? `<button class="btn-action" disabled style="background:#ccc; cursor:not-allowed;">Wujud</button>`
            : `<button class="btn-action" style="background:#10b981; color:white;" onclick="window.generateSingleRPH(${index})">⚡</button>`;
        
        let rowStyle = item.isExist ? 'background-color:#f0fdf4; opacity:0.8;' : '';

        html += `
            <tr id="row-${index}" style="${rowStyle}">
                <td>${item.niceDate}<br><small>${getDayName(new Date(item.date).getDay())}</small></td>
                <td>${item.class}</td>
                <td><strong>${item.subject}</strong> <span class="badge" style="background:#ddd; color:#333; font-size:0.7em;">${item.langMode}</span><br><small>${item.rawData.tajuk}</small></td>
                <td><div style="display:flex; gap:5px;">${actionBtn} <button class="btn-action" style="background:#ef4444; color:white;" onclick="window.removePreviewItem(${index})">🗑️</button></div></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function removePreviewItem(index) {
    previewData.splice(index, 1);
    renderPreviewTable();
}

// =========================================================
// 5. HELPER UNTUK DAPATKAN PROFIL TERKINI
// =========================================================
async function fetchLatestProfile(userEmail) {
    try {
        const docRef = doc(db, 'teachers', userEmail);
        const docSnap = await getDoc(docRef);
        if(docSnap.exists()) {
            return docSnap.data();
        }
    } catch(e) {
        console.error("Gagal refresh profil:", e);
    }
    return null;
}

// =========================================================
// 6. DATA BUILDER (STATUS: DRAFT)
// =========================================================
async function buildRPHData(item, user) {
    const d = item.rawData;
    const lang = item.langMode || 'BM'; 

    // FETCH PROFIL TERKINI untuk elak isu penyelia kosong
    let currentProfile = teacherProfile; 
    if(!currentProfile || !currentProfile.penyelia) {
        currentProfile = await fetchLatestProfile(user.email);
    }

    const penyelia = currentProfile?.penyelia || currentProfile?.penyeliaId || '';
    const school = currentProfile?.schoolId || user.email;

    const randomSP = getRandomItems(d.sp_list || [], 3).map(i => `${i.code} - ${i.desc}`).join('\n');
    const randomObj = getRandomItems(d.objektif || [], 2).join('\n');
    const randomBBM = getRandomItems(d.bbm || [], 3).join(', ');
    const randomNilai = getRandomItems(d.nilai || [], 3).join(', ');

    const sysData = SYSTEM_CONTENT[lang] || SYSTEM_CONTENT['BM'];
    const lbl = sysData.labels;

    const induksi = getRandomItems(sysData.induksi, 1)[0];
    const perkembangan = getRandomItems(sysData.perkembangan, 1)[0];
    const penutup = getRandomItems(sysData.penutup, 1)[0];

    const formattedAktiviti = `1. ${lbl.act1}:\n${induksi}\n\n2. ${lbl.act2}:\n${perkembangan}\n\n3. ${lbl.act3}:\n${penutup}`;

    const tindakanKukuh = getRandomItems(sysData.pengukuhan, 1)[0];
    const tindakanPulih = getRandomItems(sysData.pemulihan, 1)[0];
    const prefixText = lbl.getPrefix(item.niceDate, item.class, item.subject);
    const formattedRefleksi = `${prefixText}\n\n${lbl.refKukuh}: ${tindakanKukuh}\n\n${lbl.refPulih}: ${tindakanPulih}`;

    return {
        uid: user.uid,
        teacherName: user.displayName || user.email,
        teacherEmail: user.email,
        schoolId: school, 
        penyeliaId: penyelia, // ID Penyelia disimpan

        tarikh: item.date,
        masa: item.time,
        kelas: item.class,
        subject: item.subject,
        minggu: item.week, 
        
        tajuk: d.tajuk,
        sp: randomSP,
        objektif: randomObj,
        
        aktiviti: formattedAktiviti, 
        bbm: randomBBM,
        nilai: randomNilai,
        refleksi: formattedRefleksi, 
        
        status: 'draft', // DITETAPKAN KEPADA DRAFT
        createdAt: Timestamp.now()
    };
}

// =========================================================
// 7. FUNGSI SIMPAN (DRAFT)
// =========================================================
async function generateSingleRPH(index) {
    const item = previewData[index];
    if(item.isExist) { alert("RPH ini sudah wujud."); return; }

    const user = auth.currentUser;
    const btn = document.querySelector(`#row-${index} button`); 
    if(!confirm(`Simpan sebagai DRAF RPH untuk ${item.subject}?`)) return;

    btn.textContent = "..."; btn.disabled = true;

    try {
        const data = await buildRPHData(item, user);
        
        await addDoc(collection(db, 'rph'), data);
        previewData.splice(index, 1);
        renderPreviewTable();
        alert("Disimpan dalam Draf.");
    } catch(e) {
        alert("Ralat: " + e.message);
        btn.textContent = "⚡"; btn.disabled = false;
    }
}

async function generateAllRPH() {
    const validItems = previewData.filter(i => !i.isExist);
    if(validItems.length === 0) { alert("Tiada item baharu."); return; }
    if(!confirm(`Simpan ${validItems.length} RPH baharu sebagai DRAF?`)) return;

    const btn = document.getElementById('btnGenerateAll');
    btn.textContent = "Menjana..."; btn.disabled = true;
    
    const user = auth.currentUser;
    let count = 0;

    try {
        for(let item of validItems) {
            const data = await buildRPHData(item, user);
            await addDoc(collection(db, 'rph'), data);
            count++;
        }
        alert(`${count} RPH berjaya disimpan ke DRAF.`);
        if(window.switchGuruView) window.switchGuruView('view-sejarah');
    } catch(e) {
        console.error(e);
        alert("Ralat pukal: " + e.message);
    } finally {
        btn.textContent = "⚡ Jana Semua"; btn.disabled = false;
    }
}