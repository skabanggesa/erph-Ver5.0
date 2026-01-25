// assets/js/guru/guru-dashboard.js

/**
 * Fungsi utama untuk memuatkan Dashboard Guru.
 */
export function loadGuruDashboard() {
    const content = document.getElementById('content');
    
    // Periksa sistem navigasi
    if (typeof window.router === 'undefined') {
        content.innerHTML = '<p class="error">Ralat sistem: Fungsi navigasi tidak ditemui.</p>';
        return;
    }

    const userName = localStorage.getItem('userName') || 'Cikgu';

    content.innerHTML = `
        <div class="guru-dashboard-container" style="max-width: 1000px; margin: 0 auto; padding: 20px;">
            
            <header style="margin-bottom: 30px; border-bottom: 2px solid #f0f0f0; padding-bottom: 15px;">
                <h2 style="color: #2c3e50; margin-bottom: 5px;">Dashboard Guru</h2>
                <p style="color: #7f8c8d;">Selamat datang, <strong>${userName}</strong>. Sila pilih tugasan anda.</p>
            </header>

            <div class="guru-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
                
                <div class="action-card" onclick="router.navigate('guru-rph-generator')" style="${cardStyle('#1976d2')}">
                    <div style="font-size: 2.5em; margin-bottom: 15px;">📝</div>
                    <h3 style="margin: 0; font-size: 1.2em;">Jana RPH Harian</h3>
                    <p style="font-size: 0.9em; opacity: 0.9; margin-top: 10px;">Cipta RPH baharu secara automatik berdasarkan jadual waktu.</p>
                </div>

                <div class="action-card" onclick="router.navigate('guru-rph-history')" style="${cardStyle('#2e7d32')}">
                    <div style="font-size: 2.5em; margin-bottom: 15px;">📂</div>
                    <h3 style="margin: 0; font-size: 1.2em;">Sejarah & Laporan</h3>
                    <p style="font-size: 0.9em; opacity: 0.9; margin-top: 10px;">Lihat, edit, atau cetak RPH yang telah dibuat sebelum ini.</p>
                </div>

                <div class="action-card" onclick="router.navigate('guru-jadual')" style="${cardStyle('#f57c00')}">
                    <div style="font-size: 2.5em; margin-bottom: 15px;">📅</div>
                    <h3 style="margin: 0; font-size: 1.2em;">Urus Jadual Waktu</h3>
                    <p style="font-size: 0.9em; opacity: 0.9; margin-top: 10px;">Kemaskini sesi pengajaran mingguan untuk penjanaan automatik.</p>
                </div>

            </div>

            <div style="margin-top: 40px; padding: 20px; background: #f9f9f9; border-radius: 10px; border-left: 5px solid #1976d2;">
                <h4 style="margin-top: 0; color: #2c3e50;">Peringatan Mesra:</h4>
                <ul style="color: #555; font-size: 0.95em; line-height: 1.6;">
                    <li>Pastikan jadual waktu anda dikemaskini sebelum menjana RPH.</li>
                    <li>RPH yang dijana akan disimpan sebagai <strong>Draf</strong>. Sila semak dan tambah refleksi sebelum menghantar.</li>
                </ul>
            </div>
        </div>
    `;
}

/**
 * Helper style untuk kad
 */
function cardStyle(color) {
    return `
        background: ${color};
        color: white;
        padding: 30px 20px;
        border-radius: 12px;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        text-align: center;
    `;
}