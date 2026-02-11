import { db } from '../config.js';
import { 
    getAuth, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    collection, 
    doc, 
    setDoc, 
    deleteDoc, 
    onSnapshot,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =========================================================
// 1. FUNGSI UTAMA (RENDER UI)
// =========================================================
/**
 * Fungsi ini bertanggungjawab untuk memaparkan keseluruhan 
 * antaramuka (UI) Dashboard Super Admin ke dalam elemen #main-content.
 */
export function initAdminDashboard() {
    const container = document.getElementById('main-content');
    
    // Inject HTML & CSS yang telah dikemaskini
    container.innerHTML = `
        <style>
            /* Layout & General Styles */
            .sa-wrapper { padding: 10px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            .sa-container { display: grid; grid-template-columns: 1fr 2fr; gap: 20px; }
            .card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); border: 1px solid #f0f0f0; }
            .card h3 { margin-top: 0; color: #4f46e5; border-bottom: 2px solid #eef2ff; padding-bottom: 12px; font-size: 1.2rem; }
            
            /* Header & Dashboard Title */
            .sa-header { 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                margin-bottom: 25px; 
                background: white; 
                padding: 15px 25px; 
                border-radius: 12px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            }
            .sa-header h1 { margin: 0; font-size: 1.5rem; color: #1f2937; }
            .sa-header p { margin: 5px 0 0 0; color: #6b7280; font-size: 0.9rem; }

            /* Form Styles */
            .form-group { margin-bottom: 18px; }
            .form-group label { display: block; font-weight: 600; margin-bottom: 8px; font-size: 0.85rem; color: #374151; }
            .form-control { 
                width: 100%; 
                padding: 12px; 
                border: 1.5px solid #e5e7eb; 
                border-radius: 8px; 
                box-sizing: border-box; 
                transition: border-color 0.2s;
            }
            .form-control:focus { outline: none; border-color: #4f46e5; background: #fafaff; }
            
            /* Buttons */
            .btn-submit { width: 100%; background: #4f46e5; color: white; padding: 12px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1rem; transition: background 0.3s; }
            .btn-submit:hover { background: #4338ca; }
            .btn-submit:disabled { background: #a5b4fc; cursor: not-allowed; }

            .btn-logout { 
                background: #ef4444; 
                color: white; 
                padding: 10px 18px; 
                border: none; 
                border-radius: 8px; 
                cursor: pointer; 
                font-weight: 600; 
                display: flex; 
                align-items: center; 
                gap: 8px; 
                transition: all 0.2s;
                font-size: 0.9rem;
            }
            .btn-logout:hover { background: #dc2626; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3); }

            /* Table Styles */
            .table-container { overflow-x: auto; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { text-align: left; background: #f9fafb; padding: 12px; font-size: 0.8rem; color: #4b5563; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #f3f4f6; }
            td { padding: 14px 12px; border-bottom: 1px solid #f3f4f6; font-size: 0.9rem; color: #111827; }
            
            /* Badges & Actions */
            .badge { background: #d1fae5; color: #065f46; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
            .btn-sm { padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.75rem; margin-right: 5px; font-weight: 600; transition: transform 0.1s; }
            .btn-sm:active { transform: scale(0.95); }
            .btn-edit { background: #fef3c7; color: #92400e; }
            .btn-edit:hover { background: #fde68a; }
            .btn-delete { background: #fee2e2; color: #b91c1c; }
            .btn-delete:hover { background: #fecaca; }

            /* Utility */
            .loading-spinner { text-align: center; padding: 30px; color: #6366f1; font-style: italic; }

            /* Responsive */
            @media (max-width: 900px) { 
                .sa-container { grid-template-columns: 1fr; } 
                .sa-header { flex-direction: column; text-align: center; gap: 15px; }
            }
        </style>

        <div class="sa-wrapper">
            <div class="sa-header">
                <div>
                    <h1>Dashboard Super Admin</h1>
                    <p>Selamat datang! Urus pendaftaran sekolah dan pentadbir sistem di sini.</p>
                </div>
                <button id="btnLogout" class="btn-logout">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                    </svg>
                    Log Keluar
                </button>
            </div>

            <div class="sa-container">
                
                <div class="card">
                    <h3>+ Daftar Sekolah Baru</h3>
                    <form id="formAddSchool">
                        <div class="form-group">
                            <label>Nama Sekolah</label>
                            <input type="text" id="schoolName" class="form-control" placeholder="Cth: SK Taman Mawar" required>
                        </div>
                        <div class="form-group">
                            <label>Kod Sekolah / Email Rasmi</label>
                            <input type="email" id="schoolEmail" class="form-control" placeholder="admin@sekolah.edu.my" required>
                            <small style="color: #6b7280; font-size: 0.75rem; display: block; margin-top: 5px;">
                                Email ini akan digunakan sebagai ID login Admin Sekolah.
                            </small>
                        </div>
                        <button type="submit" class="btn-submit">Daftar Sekolah</button>
                    </form>
                </div>

                <div class="card">
                    <h3>Senarai Sekolah Berdaftar</h3>
                    <div id="loadingList" class="loading-spinner">Sedang memuatkan data pangkalan data...</div>
                    <div class="table-container">
                        <table id="schoolsTable" style="display:none;">
                            <thead>
                                <tr>
                                    <th>Nama Sekolah</th>
                                    <th>Email Admin (ID)</th>
                                    <th>Status</th>
                                    <th>Tindakan</th>
                                </tr>
                            </thead>
                            <tbody id="schoolsListBody"></tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    `;

    // Jalankan Logic Pendaftaran
    initFormListener();
    
    // Jalankan Logic Paparan Realtime
    loadSchoolsRealtime();

    // Jalankan Logic Logout
    initLogoutListener();
}

// =========================================================
// 2. LOGIK PENDAFTARAN (CREATE)
// =========================================================
function initFormListener() {
    const form = document.getElementById('formAddSchool');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('schoolName').value.trim();
        const email = document.getElementById('schoolEmail').value.trim().toLowerCase(); 
        const btn = document.querySelector('.btn-submit');

        if (!name || !email) {
            return alert("Sila pastikan semua maklumat telah diisi dengan lengkap.");
        }

        try {
            btn.textContent = "Sedang Menyimpan...";
            btn.disabled = true;

            // Simpan ke Firestore: Collection 'schools'
            // Menggunakan 'email' sebagai Document ID untuk keunikan data
            await setDoc(doc(db, "schools", email), {
                schoolName: name,
                schoolCode: email, 
                role: 'admin',     
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            alert(`Berjaya! Sekolah ${name} telah didaftarkan ke dalam sistem.`);
            form.reset();

        } catch (error) {
            console.error("Ralat semasa mendaftar sekolah:", error);
            alert("Gagal mendaftar sekolah. Sila cuba lagi. Ralat: " + error.message);
        } finally {
            btn.textContent = "Daftar Sekolah";
            btn.disabled = false;
        }
    });
}

// =========================================================
// 3. LOGIK PAPARAN & KEMASKINI (READ, UPDATE, DELETE)
// =========================================================
function loadSchoolsRealtime() {
    const tbody = document.getElementById('schoolsListBody');
    const table = document.getElementById('schoolsTable');
    const loading = document.getElementById('loadingList');

    // Dengar perubahan database secara Realtime (onSnapshot)
    // Firestore akan automatik kemaskini UI jika ada data masuk/keluar
    onSnapshot(collection(db, "schools"), (snapshot) => {
        tbody.innerHTML = ''; // Bersihkan kandungan lama
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color: #999;">Tiada rekod sekolah dijumpai dalam sistem.</td></tr>';
        } else {
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const emailID = docSnap.id; 

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>${data.schoolName}</strong></td>
                    <td><code style="background:#f1f1f1; padding:2px 5px; border-radius:4px;">${data.schoolCode}</code></td>
                    <td><span class="badge">Aktif</span></td>
                    <td>
                        <button class="btn-sm btn-edit" onclick="editSchool('${emailID}', '${data.schoolName}')">Edit</button>
                        <button class="btn-sm btn-delete" onclick="deleteSchool('${emailID}')">Padam</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

        // Sembunyikan loading, paparkan table
        if (loading) loading.style.display = 'none';
        if (table) table.style.display = 'table';
    }, (error) => {
        console.error("Error fetching schools data:", error);
        if (loading) loading.innerHTML = "<span style='color:red'>Ralat kritikal memuatkan data. Sila periksa sambungan internet anda.</span>";
    });

    // Ekspos fungsi ke scope window supaya butang onclick dalam string HTML berfungsi
    window.editSchool = editSchool;
    window.deleteSchool = deleteSchool;
}

/**
 * Fungsi untuk mengemaskini nama sekolah
 * @param {string} docId - ID dokumen (email)
 * @param {string} oldName - Nama sekolah sedia ada
 */
async function editSchool(docId, oldName) {
    const newName = prompt("Kemaskini Nama Sekolah:", oldName);
    
    if (newName && newName.trim() !== "" && newName !== oldName) {
        try {
            const schoolRef = doc(db, "schools", docId);
            await setDoc(schoolRef, { 
                schoolName: newName.trim(),
                updatedAt: serverTimestamp() 
            }, { merge: true });
            
            console.log("Data sekolah berjaya dikemaskini.");
        } catch (e) {
            console.error("Ralat kemaskini:", e);
            alert("Gagal mengemaskini nama sekolah: " + e.message);
        }
    }
}

/**
 * Fungsi untuk memadam data sekolah daripada pangkalan data
 * @param {string} docId - ID dokumen yang akan dipadam
 */
async function deleteSchool(docId) {
    const confirmDelete = confirm("AMARAN: Adakah anda pasti mahu memadam sekolah ini?\n\nSemua data berkaitan pentadbir bagi sekolah ini akan dikeluarkan daripada senarai utama.");
    
    if (confirmDelete) {
        try {
            await deleteDoc(doc(db, "schools", docId));
            alert("Rekod sekolah telah berjaya dipadam secara kekal.");
        } catch (e) {
            console.error("Ralat pemadaman:", e);
            alert("Gagal memadam rekod: " + e.message);
        }
    }
}

// =========================================================
// 4. LOGIK PENGURUSAN SESI (LOGOUT)
// =========================================================
/**
 * Fungsi untuk mengendalikan proses log keluar pengguna
 */
function initLogoutListener() {
    const logoutBtn = document.getElementById('btnLogout');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', async () => {
        const confirmLogout = confirm("Adakah anda pasti ingin mendaftar keluar?");
        
        if (confirmLogout) {
            const auth = getAuth();
            try {
                // Proses Sign Out daripada Firebase Auth
                await signOut(auth);
                
                // Maklumkan pengguna dan lari ke halaman login
                alert("Anda telah berjaya log keluar.");
                window.location.href = "index.html"; // Pastikan fail ini wujud
                
            } catch (error) {
                console.error("Ralat semasa log keluar:", error);
                alert("Terdapat ralat semasa cuba log keluar: " + error.message);
            }
        }
    });
}
// Kod berakhir di sini. Pastikan fail config.js mengandungi konfigurasi Firebase yang betul.