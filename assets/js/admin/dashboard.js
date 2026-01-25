// assets/js/admin/dashboard.js

import { auth } from '../config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export function loadAdminDashboard() {
    const content = document.getElementById('content');
    const userName = localStorage.getItem('userName') || 'Pentadbir';

    // Kita cipta struktur layout khas untuk Admin
    // 'adminContent' adalah tempat sub-halaman akan dimuatkan nanti
    content.innerHTML = `
        <div class="admin-dashboard-wrapper" style="font-family: 'Segoe UI', sans-serif;">
            
            <div style="background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h2 style="margin:0;">Panel Pentadbir</h2>
                    <small>Selamat datang, ${userName}</small>
                </div>
                <button id="adminLogoutBtn" style="background:#c0392b; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer;">Log Keluar</button>
            </div>

            <div class="admin-menu-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px;">
                
                <button onclick="router.navigate('admin-teachers')" style="${btnStyle('#34495e')}">
                    👨‍🏫 Urus Guru
                </button>

                <button onclick="router.navigate('admin-rph-review')" style="${btnStyle('#2980b9')}">
                    📚 Semakan RPH
                </button>

                <button onclick="router.navigate('admin-analytics')" style="${btnStyle('#8e44ad')}">
                    📊 Analisis & Laporan
                </button>

                <button onclick="router.navigate('admin-maintenance')" style="${btnStyle('#e67e22')}">
                    🛠️ Penyelenggaraan
                </button>
            </div>

            <div id="adminContent" style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); min-height: 400px;">
                <p style="text-align:center; color:#7f8c8d; margin-top:50px;">
                    Sila pilih menu di atas untuk memulakan tugasan.
                </p>
            </div>

        </div>
    `;

    // Event Listener Logout Khas
    document.getElementById('adminLogoutBtn').addEventListener('click', async () => {
        if(confirm("Log keluar dari Panel Admin?")) {
            await signOut(auth);
            window.location.href = 'index.html';
        }
    });
}

function btnStyle(color) {
    return `
        background: ${color}; 
        color: white; 
        border: none; 
        padding: 15px; 
        border-radius: 8px; 
        font-size: 1rem; 
        cursor: pointer; 
        transition: transform 0.2s;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        font-weight: 600;
    `;
}