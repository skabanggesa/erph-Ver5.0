// assets/js/admin/dashboard.js

import { firebaseConfig, db } from '../config.js'; 
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, setDoc, getDocs, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 1. FUNGSI UTAMA (Dipanggil oleh Router) ---
export function loadAdminDashboard() {
    
    // --- DEBUGGING START ---
    // (Popup ini akan memberitahu kita apa role sebenar anda)
    const role = localStorage.getItem('userRole');
    console.log("Role yang dikesan:", role);
    alert("Sistem mengesan Role anda ialah: " + role); 
    // --- DEBUGGING END ---

    console.log("Memuatkan Dashboard Admin...");
    
    const contentDiv = document.getElementById('main-content');
    if (!contentDiv) return;

    // LOGIK PEMILIHAN PAPARAN
    // A. JIKA SUPER ADMIN
    if (role === 'superadmin') {
        renderSuperAdminUI(contentDiv);
    } 
    // B. JIKA ADMIN SEKOLAH
    else if (role === 'admin') {
        renderSchoolAdminUI(contentDiv);
    } 
    // C. LAIN-LAIN (Error handling)
    else {
        contentDiv.innerHTML = `
            <div style="padding:20px; color:red; text-align:center;">
                <h3>Akses Ditolak</h3>
                <p>Role anda ('${role}') tidak dibenarkan mengakses halaman ini.</p>
                <p>Sila logout dan login semula.</p>
            </div>
        `;
    }
}

// =========================================================
// BAHAGIAN A: UI SUPER ADMIN (Daftar Sekolah & Admin Sekolah)
// =========================================================
function renderSuperAdminUI(container) {
    container.innerHTML = `
        <div class="dashboard-header" style="margin-bottom:30px; border-bottom:1px solid #ddd; padding-bottom:10px;">
            <h1 style="color: #4f46e5;">Dashboard Super Admin</h1>
            <p>Pengurusan Pendaftaran Sekolah & Admin Sekolah</p>
        </div>

        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
            
            <div style="flex: 1; min-width: 320px; background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin-top:0; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px;">Daftar Sekolah Baru</h3>
                <form id="formRegisterAdmin">
                    <div style="margin-bottom:15px;">
                        <label style="display:block; font-weight:bold; font-size:14px; margin-bottom:5px;">Nama Sekolah</label>
                        <input type="text" id="schoolName" required placeholder="Contoh: SK Taman Indah" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                    <div style="margin-bottom:15px;">
                        <label style="display:block; font-weight:bold; font-size:14px; margin-bottom:5px;">Nama Admin</label>
                        <input type="text" id="adminName" required placeholder="Nama Cikgu Admin" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                    <div style="margin-bottom:15px;">
                        <label style="display:block; font-weight:bold; font-size:14px; margin-bottom:5px;">Email Admin (Login)</label>
                        <input type="email" id="adminEmail" required placeholder="admin@sekolah.com" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                    <div style="margin-bottom:15px;">
                        <label style="display:block; font-weight:bold; font-size:14px; margin-bottom:5px;">Kata Laluan Sementara</label>
                        <input type="text" id="adminPass" required value="password123" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:5px; background:#f9fafb;">
                    </div>
                    <button type="submit" id="btnSubmitAdmin" style="width:100%; background:#4f46e5; color:white; padding:12px; border:none; border-radius:5px; cursor:pointer; font-weight:bold; transition:0.3s;">
                        + Daftar Sekolah
                    </button>
                </form>
            </div>

            <div style="flex: 1.5; min-width: 320px; background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin-top:0; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px;">Senarai Sekolah Berdaftar</h3>
                <div id="schoolListContainer" style="max-height: 500px; overflow-y: auto;">
                    <p style="color:#666;">Sedang memuatkan data...</p>
                </div>
            </div>
        </div>
    `;

    // Pasang Event Listener
    document.getElementById('formRegisterAdmin').addEventListener('submit', handleRegisterSchoolAdmin);
    
    // Muatkan senarai
    loadSchoolAdminsList();
}

// LOGIK: Daftar Admin Sekolah (Guna Secondary App supaya tak logout)
async function handleRegisterSchoolAdmin(e) {
    e.preventDefault();

    const schoolName = document.getElementById('schoolName').value;
    const name = document.getElementById('adminName').value;
    const email = document.getElementById('adminEmail').value;
    const pass = document.getElementById('adminPass').value;
    const btn = document.getElementById('btnSubmitAdmin');

    btn.disabled = true;
    btn.textContent = "Sedang Mendaftar...";

    // 1. Initialize Secondary App
    let secondaryApp;
    try {
        secondaryApp = initializeApp(firebaseConfig, "SecondaryApp" + Date.now()); 
    } catch (err) {
        secondaryApp = initializeApp(firebaseConfig, "SecondaryAppBackup");
    }
    
    const secondaryAuth = getAuth(secondaryApp);

    try {
        // 2. Create User dalam Auth
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
        const newUser = userCredential.user;

        // 3. Simpan Data dalam Firestore
        await setDoc(doc(db, "users", newUser.uid), {
            uid: newUser.uid,
            name: name,
            email: email,
            role: 'admin',      
            schoolName: schoolName,
            createdAt: Timestamp.now()
        });

        // 4. Logout user baru & bersihkan memori
        await signOut(secondaryAuth);
        
        alert(`Berjaya!\nSekolah: ${schoolName}\nLogin: ${email}\nPassword: ${pass}`);
        
        // Reset Borang
        document.getElementById('formRegisterAdmin').reset();
        loadSchoolAdminsList(); // Refresh senarai

    } catch (error) {
        console.error(error);
        alert("Ralat Pendaftaran: " + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "+ Daftar Sekolah";
    }
}

// LOGIK: Senarai Sekolah
async function loadSchoolAdminsList() {
    const container = document.getElementById('schoolListContainer');
    try {
        const q = query(collection(db, "users"), where("role", "==", "admin"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            container.innerHTML = "<p>Tiada sekolah didaftarkan lagi.</p>";
            return;
        }

        let html = `<table style="width:100%; border-collapse: collapse; font-size:14px;">
            <thead style="background:#f9fafb; color:#374151;">
                <tr>
                    <th style="padding:10px; text-align:left; border-bottom:1px solid #ddd;">Sekolah</th>
                    <th style="padding:10px; text-align:left; border-bottom:1px solid #ddd;">Admin</th>
                    <th style="padding:10px; text-align:left; border-bottom:1px solid #ddd;">Email</th>
                </tr>
            </thead>
            <tbody>`;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            html += `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px; font-weight:500;">${data.schoolName || '-'}</td>
                <td style="padding:10px;">${data.name}</td>
                <td style="padding:10px; color:#6b7280;">${data.email}</td>
            </tr>`;
        });

        html += "</tbody></table>";
        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<p style='color:red'>Ralat memuatkan senarai: ${error.message}</p>`;
    }
}

// =========================================================
// BAHAGIAN B: UI ADMIN SEKOLAH (Placeholder Dulu)
// =========================================================
function renderSchoolAdminUI(container) {
    container.innerHTML = `
        <div style="text-align:center; padding: 50px;">
            <h1 style="color:#059669;">Dashboard Admin Sekolah</h1>
            <p>Selamat datang! Anda telah log masuk sebagai Admin Sekolah.</p>
            <div style="margin-top:20px; padding:20px; background:#ecfdf5; display:inline-block; border-radius:8px;">
                <h3>Status: Berjaya Login</h3>
                <p>Modul pendaftaran Guru & Penyelia akan datang di sini.</p>
            </div>
        </div>
    `;
}