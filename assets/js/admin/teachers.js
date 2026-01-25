// assets/js/admin/teachers.js

import { db, firebaseConfig } from '../config.js'; 
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, createUserWithEmailAndPassword, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    doc, setDoc, collection, getDocs, updateDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Global variable untuk simpan data sementara
let allUsersData = [];
let currentAdminIdToAssign = null;

export async function loadTeachers() {
    const content = document.getElementById('content');
    
    // Kita check role semasa admin yang sedang login
    const currentUserRole = localStorage.getItem('userRole'); 

    // UI CSS
    const styleCSS = `
    <style>
        .admin-section { font-family: 'Segoe UI', sans-serif; color: #333; max-width: 1000px; margin: 0 auto; }
        .form-card { background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 30px; border: 1px solid #eef2f5; }
        .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .form-input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; }
        .btn-primary { background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
        .btn-back { background: #64748b; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; }
        
        .admin-table { width: 100%; border-collapse: collapse; min-width: 600px; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        .admin-table th { background: #1e293b; color: white; padding: 15px; text-align: left; }
        .admin-table td { padding: 15px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        
        .role-select { padding: 6px; border-radius: 6px; border: 1px solid #cbd5e1; cursor: pointer; font-weight: bold; }
        .role-super { color: #7c3aed; border-color: #7c3aed; background: #f5f3ff; }
        .role-admin { color: #ea580c; border-color: #ea580c; background: #fff7ed; }
        .role-guru { color: #059669; border-color: #059669; background: #ecfdf5; }

        .btn-assign { background: #f59e0b; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 5px; }
        .btn-assign:hover { background: #d97706; }

        /* MODAL STYLES */
        .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 999; justify-content: center; align-items: center; }
        .modal-box { background: white; width: 90%; max-width: 500px; border-radius: 12px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); max-height: 80vh; display: flex; flex-direction: column; }
        .modal-title { font-size: 1.2rem; font-weight: bold; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .teacher-list-container { overflow-y: auto; flex-grow: 1; border: 1px solid #f1f5f9; border-radius: 8px; padding: 10px; margin-bottom: 20px; }
        .teacher-item { display: flex; align-items: center; padding: 8px; border-bottom: 1px solid #f8fafc; }
        .teacher-item:last-child { border-bottom: none; }
        .teacher-item:hover { background: #f8fafc; }
        .t-checkbox { width: 18px; height: 18px; margin-right: 10px; cursor: pointer; }
    </style>
    `;

    // Amaran untuk Admin Biasa (Supaya mereka tahu limit mereka)
    let accessWarning = "";
    if (currentUserRole === 'admin') {
        accessWarning = `<div style="background:#fff7ed; color:#c2410c; padding:10px; border-radius:8px; margin-bottom:15px; font-size:0.9rem;">
            ⚠️ Anda login sebagai <strong>Admin (Penyelia)</strong>. Anda hanya boleh melihat senarai, tetapi tidak boleh mengubah peranan pengguna lain.
        </div>`;
    }

    content.innerHTML = styleCSS + `
        <div class="admin-section">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2 style="margin:0; color:#1e293b;">👤 Pengurusan Guru & Staf</h2>
                <button class="btn-back" onclick="window.router.navigate('admin-home')">⬅ Kembali</button>
            </div>
            
            ${accessWarning}

            <div class="form-card" id="registerFormArea" style="display:none;">
                <h3 style="margin-top:0; border-bottom:1px solid #f1f5f9; padding-bottom:15px; color:#334155;">✨ Daftar Pengguna Baru</h3>
                <div class="form-grid">
                    <input type="text" id="newTeacherName" class="form-input" placeholder="Nama Penuh">
                    <input type="email" id="newTeacherEmail" class="form-input" placeholder="Emel Rasmi">
                    <input type="text" id="newTeacherPassword" class="form-input" placeholder="Kata Laluan (Min 6)">
                </div>
                <div style="text-align:right;">
                    <span id="regStatus" style="font-weight:600; margin-right:10px;"></span>
                    <button id="btnRegisterTeacher" class="btn-primary">➕ Daftar</button>
                </div>
            </div>

            <h3 style="color:#334155;">📋 Senarai Pengguna</h3>
            <div class="table-responsive">
                <table class="admin-table" id="teachersTable">
                    <thead>
                        <tr>
                            <th>Nama & Emel</th>
                            <th>Peranan</th>
                            <th>Status / Jagaan</th>
                            <th style="text-align:center;">Tindakan</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colspan="4" style="text-align:center; padding:30px;">⏳ Memuatkan...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div id="assignModal" class="modal-overlay">
            <div class="modal-box">
                <div class="modal-title">👥 Pilih Guru Jagaan</div>
                <p style="margin-top:0; color:#64748b; font-size:0.9rem;">Tandakan guru yang akan diselia oleh admin ini.</p>
                
                <div id="modalTeacherList" class="teacher-list-container">
                    </div>

                <div style="text-align:right; display:flex; justify-content:flex-end; gap:10px;">
                    <button onclick="document.getElementById('assignModal').style.display='none'" style="background:#e2e8f0; color:#334155; border:none; padding:10px 20px; border-radius:6px; cursor:pointer;">Batal</button>
                    <button onclick="window.saveAssignments()" style="background:#3b82f6; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer;">Simpan</button>
                </div>
            </div>
        </div>
    `;

    // Paparkan borang daftar hanya jika superadmin
    if (currentUserRole === 'superadmin') {
        document.getElementById('registerFormArea').style.display = 'block';
        document.getElementById('btnRegisterTeacher').addEventListener('click', handleRegisterTeacher);
    }

    loadTeachersList(currentUserRole);
}

// --------------------------------------------------------------------------
// 1. FUNGSI MUAT TURUN SENARAI
// --------------------------------------------------------------------------
async function loadTeachersList(currentUserRole) {
    const tbody = document.querySelector('#teachersTable tbody');
    try {
        const snap = await getDocs(collection(db, 'users'));
        allUsersData = []; // Reset global data

        snap.forEach(doc => {
            allUsersData.push({ id: doc.id, ...doc.data() });
        });

        // Susun: Superadmin -> Admin -> Guru
        allUsersData.sort((a, b) => {
            const roles = { 'superadmin': 1, 'admin': 2, 'guru': 3 };
            return (roles[a.role] || 4) - (roles[b.role] || 4);
        });

        let html = '';
        allUsersData.forEach(user => {
            // Dropdown Role Logic
            let roleSelect = `<span class="badge" style="background:#eee; color:#555; padding:5px 10px; border-radius:4px;">${user.role}</span>`;
            
            // Jika Super Admin, dia boleh ubah role sesiapa sahaja
            if (currentUserRole === 'superadmin') {
                roleSelect = `
                    <select class="role-select role-${user.role}" onchange="window.updateUserRole('${user.id}', this.value)">
                        <option value="superadmin" ${user.role === 'superadmin' ? 'selected' : ''}>👑 Super Admin</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>👔 Admin (Penyelia)</option>
                        <option value="guru" ${user.role === 'guru' ? 'selected' : ''}>👤 Guru</option>
                    </select>
                `;
            }

            // Kolum Status / Jagaan
            let statusInfo = `<span style="color:#10b981; font-weight:bold;">Aktif</span>`;
            if (user.status === 'disabled') statusInfo = `<span style="color:#ef4444; font-weight:bold;">Disekat</span>`;

            // Jika dia adalah ADMIN, tunjukkan berapa guru jagaannya
            let assignBtn = '';
            if (user.role === 'admin') {
                const count = user.assignedTeachers ? user.assignedTeachers.length : 0;
                statusInfo += `<br><small style="color:#ea580c;">Menyelia: <strong>${count}</strong> guru</small>`;
                
                if (currentUserRole === 'superadmin') {
                    assignBtn = `
                        <button class="btn-assign" onclick="window.openAssignModal('${user.id}')">
                            👥 Pilih Guru
                        </button>
                    `;
                }
            }

            // Butang Tindakan (Sekat/Aktif) - Hanya Super Admin
            let actionBtn = '';
            if (currentUserRole === 'superadmin') {
                const btnLabel = user.status === 'active' || !user.status ? 'Sekat' : 'Aktifkan';
                const btnColor = user.status === 'active' || !user.status ? '#fee2e2; color:#b91c1c' : '#dcfce7; color:#15803d';
                actionBtn = `<button style="background:${btnColor}; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; font-size:0.8rem;" onclick="window.toggleTeacherStatus('${user.id}', '${user.status || 'active'}')">${btnLabel}</button>`;
            } else {
                actionBtn = `<small style="color:#94a3b8;">Tiada akses</small>`;
            }

            html += `
                <tr>
                    <td>
                        <div style="font-weight:600;">${user.name}</div>
                        <small style="color:#64748b;">${user.email}</small>
                    </td>
                    <td>${roleSelect}</td>
                    <td>
                        ${statusInfo}
                        <div style="margin-top:5px;">${assignBtn}</div>
                    </td>
                    <td align="center">${actionBtn}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html || '<tr><td colspan="4" align="center">Tiada rekod.</td></tr>';

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:red;">Ralat: ${e.message}</td></tr>`;
    }
}

// --------------------------------------------------------------------------
// 2. LOGIK PENUGASAN (ASSIGNMENT) - MODAL
// --------------------------------------------------------------------------
window.openAssignModal = (adminId) => {
    currentAdminIdToAssign = adminId;
    const admin = allUsersData.find(u => u.id === adminId);
    if (!admin) return;

    // Senarai guru yang sudah ditanda
    const assignedList = admin.assignedTeachers || [];

    const listContainer = document.getElementById('modalTeacherList');
    let html = '';

    // Filter hanya user yang berstatus 'guru'
    const gurus = allUsersData.filter(u => u.role === 'guru');

    if (gurus.length === 0) {
        html = '<p style="text-align:center; padding:20px;">Tiada guru berdaftar dalam sistem.</p>';
    } else {
        gurus.forEach(guru => {
            const isChecked = assignedList.includes(guru.id) ? 'checked' : '';
            html += `
                <div class="teacher-item">
                    <input type="checkbox" class="t-checkbox assign-chk" value="${guru.id}" ${isChecked} id="chk-${guru.id}">
                    <label for="chk-${guru.id}" style="cursor:pointer; flex-grow:1;">
                        <div style="font-weight:600; color:#334155;">${guru.name}</div>
                        <div style="font-size:0.8rem; color:#94a3b8;">${guru.email}</div>
                    </label>
                </div>
            `;
        });
    }

    listContainer.innerHTML = html;
    document.getElementById('assignModal').style.display = 'flex';
};

window.saveAssignments = async () => {
    if (!currentAdminIdToAssign) return;

    const checkboxes = document.querySelectorAll('.assign-chk:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);

    // Update UI Button
    const btn = document.querySelector('#assignModal button[onclick="window.saveAssignments()"]');
    btn.textContent = "Menyimpan...";
    btn.disabled = true;

    try {
        const adminRef = doc(db, 'users', currentAdminIdToAssign);
        await updateDoc(adminRef, {
            assignedTeachers: selectedIds
        });

        alert("✅ Penugasan berjaya disimpan!");
        document.getElementById('assignModal').style.display = 'none';
        
        // Refresh table
        loadTeachersList('superadmin'); 

    } catch (e) {
        alert("Ralat: " + e.message);
    } finally {
        btn.textContent = "Simpan";
        btn.disabled = false;
    }
};

// --------------------------------------------------------------------------
// 3. FUNGSI LAIN (Register, Update Role, Toggle Status)
// --------------------------------------------------------------------------

// Register (Sama seperti kod lama, cuma guna secondary app)
async function handleRegisterTeacher() {
    const name = document.getElementById('newTeacherName').value;
    const email = document.getElementById('newTeacherEmail').value;
    const pass = document.getElementById('newTeacherPassword').value;
    const statusEl = document.getElementById('regStatus');

    if(!name || !email || !pass) return alert("Isi semua maklumat!");

    statusEl.textContent = "Mendaftar...";
    statusEl.style.color = "blue";

    try {
        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);
        const cred = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
        
        await setDoc(doc(db, 'users', cred.user.uid), {
            name: name, email: email, role: 'guru', status: 'active', createdAt: new Date()
        });

        await signOut(secondaryAuth);
        statusEl.textContent = "✅ Berjaya!";
        statusEl.style.color = "green";
        
        // Clear form
        document.getElementById('newTeacherName').value = '';
        document.getElementById('newTeacherEmail').value = '';
        document.getElementById('newTeacherPassword').value = '';

        loadTeachersList('superadmin');

    } catch (e) {
        statusEl.textContent = "Ralat: " + e.message;
        statusEl.style.color = "red";
    }
}

window.updateUserRole = async (uid, newRole) => {
    if(!confirm(`Tukar peranan pengguna ini kepada ${newRole.toUpperCase()}?`)) return;
    try {
        await updateDoc(doc(db, 'users', uid), { role: newRole });
        loadTeachersList('superadmin');
    } catch(e) { alert(e.message); }
};

window.toggleTeacherStatus = async (uid, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    if(!confirm(`Ubah status kepada ${newStatus}?`)) return;
    try {
        await updateDoc(doc(db, 'users', uid), { status: newStatus });
        loadTeachersList('superadmin');
    } catch(e) { alert(e.message); }
};