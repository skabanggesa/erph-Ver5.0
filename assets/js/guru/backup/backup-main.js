import { auth } from '../config.js';
// Fungsi utils kekal
import { generateWeekOptions } from './guru-utils.js'; 
import { initJadual } from './guru-jadual.js';
import { initJana } from './guru-jana.js';
import { initSejarah } from './guru-sejarah.js';

export async function loadGuruDashboard() {
    const container = document.getElementById('main-content');
    if (!container) return;

    const user = auth.currentUser;
    const userName = user.displayName || user.email;

    // HTML Structure yang lebih bersih (tanpa inline style yang berat)
    container.innerHTML = `
        <div class="guru-container">
            
            <header>
                <div>
                    <h2 style="margin:0; color:var(--primary);">Dashboard Guru</h2>
                    <p style="color:var(--secondary); margin:0;">Selamat datang, <strong>${userName}</strong></p>
                </div>
                <button onclick="window.showGuruMenu()" id="btnHomeGuru" style="display:none;" class="btn-action">
                   🏠 Menu Utama
                </button>
            </header>

            <div id="view-guru-menu" class="guru-view" style="display:block;">
                <div class="grid-menu">
                    
                    <button class="card-menu" onclick="window.switchGuruView('view-jadual')" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
                        <div style="font-size: 2.5em; margin-bottom: 10px;">📅</div>
                        <h3>Jadual Waktu</h3>
                        <p>Tetapkan jadual kelas mingguan.</p>
                    </button>

                    <button class="card-menu" onclick="window.switchGuruView('view-jana-rph')" style="background: linear-gradient(135deg, #3b82f6, #2563eb);">
                        <div style="font-size: 2.5em; margin-bottom: 10px;">🤖</div>
                        <h3>Jana RPH</h3>
                        <p>Automatik dari data & jadual.</p>
                    </button>

                    <button class="card-menu" onclick="window.switchGuruView('view-sejarah')" style="background: linear-gradient(135deg, #10b981, #059669);">
                        <div style="font-size: 2.5em; margin-bottom: 10px;">📂</div>
                        <h3>Sejarah & Status</h3>
                        <p>Edit, Hantar & Cetak.</p>
                    </button>

                </div>
            </div>

            <div id="view-jadual" class="guru-view" style="display:none;">
                <div class="table-container">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                        <h3>📅 Jadual Waktu Induk</h3>
                    </div>

                    <form id="formJadual" style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
                        <div class="form-grid">
                            <div>
                                <label>Hari</label>
                                <select id="jHari" class="input-std" required>
                                    <option value="1">Isnin</option><option value="2">Selasa</option><option value="3">Rabu</option>
                                    <option value="4">Khamis</option><option value="5">Jumaat</option>
                                </select>
                            </div>
                            <div>
                                <label>Masa Mula</label>
                                <input type="time" id="jMasaMula" class="input-std" required>
                            </div>
                            <div>
                                <label>Masa Tamat</label>
                                <input type="time" id="jMasaTamat" class="input-std" required>
                            </div>
                            <div>
                                <label>Kelas</label>
                                <input type="text" id="jKelas" placeholder="Cth: 1 Arif" class="input-std" required>
                            </div>
                            <div>
                                <label>Subjek</label>
                                <input type="text" id="jSubjek" placeholder="Cth: BM" class="input-std" required>
                            </div>
                        </div>
                        <button type="submit" class="btn-action" style="background:var(--primary); color:white; padding:10px 20px;">+ Tambah Slot</button>
                    </form>

                    <div id="timetableContainer" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px;">
                        <p>Memuatkan jadual...</p>
                    </div>
                </div>
            </div>

            <div id="view-jana-rph" class="guru-view" style="display:none;">
                <div class="table-container">
                    <h3>🤖 Penjana RPH Automatik</h3>
                    
                    <div style="display:flex; gap:15px; flex-wrap:wrap; align-items:end; background:#f8fafc; padding:20px; border-radius:8px;">
                        <div>
                            <label>Tarikh Mula</label>
                            <input type="date" id="dateStart" class="input-std">
                        </div>
                        <div>
                            <label>Tarikh Akhir</label>
                            <input type="date" id="dateEnd" class="input-std">
                        </div>
                        <div>
                             <label>Minggu</label>
                             <select id="weekSelect" class="input-std">
                                ${generateWeekOptions()}
                             </select>
                        </div>
                        <button onclick="window.previewRPH()" class="btn-action" style="background:var(--primary); color:white; height:42px; padding:0 25px;">
                            🔍 Cari
                        </button>
                    </div>

                    <div id="previewArea" style="margin-top:30px; display:none;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                             <h4 style="margin:0;">Hasil Carian:</h4>
                             <button onclick="window.generateAllRPH()" id="btnGenerateAll" class="btn-action" style="background:var(--success); color:white; display:none;">
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

                    <div id="printZone" style="display:none;">
                        <h4 style="margin-top:0; color:var(--success);">🖨️ Cetak RPH Disahkan</h4>
                        <div style="display:flex; gap:10px; align-items:end;">
                            <div><label>Dari</label><input type="date" id="printStartDate" class="input-std"></div>
                            <div><label>Hingga</label><input type="date" id="printEndDate" class="input-std"></div>
                            <button onclick="window.printApprovedRPH()" class="btn-action" style="background:var(--success); color:white; height:42px;">Cetak PDF</button>
                        </div>
                    </div>

                    <div style="margin-bottom:15px;"></div> 

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
                <div class="table-container" style="max-width:900px; margin:0 auto;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
                        <h3>✏️ Edit RPH</h3>
                        <button onclick="window.switchGuruView('view-sejarah')" class="btn-action" style="background:#cbd5e1; color:#333;">Tutup</button>
                    </div>
                    <form id="formEditRPH">
                        <input type="hidden" id="editDocId">
                        
                        <div class="form-grid">
                            <div><label>Tarikh</label><input type="text" id="eTarikh" class="input-std" readonly style="background:#f1f5f9;"></div>
                            <div><label>Kelas</label><input type="text" id="eKelas" class="input-std" readonly style="background:#f1f5f9;"></div>
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

                        <div style="margin-top:25px; display:flex; gap:15px; padding-top:20px; border-top:1px solid #eee;">
                            <button type="button" onclick="window.saveDraftRPH()" class="btn-action" style="background:var(--warning); color:white; padding:12px 25px;">Simpan Draf</button>
                            <button type="submit" class="btn-action" style="background:var(--primary); color:white; padding:12px 25px;">🚀 Hantar ke Penyelia</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    // Setup Logic & Navigation
    window.switchGuruView = (viewId) => {
        document.querySelectorAll('.guru-view').forEach(el => el.style.display = 'none');
        document.getElementById(viewId).style.display = 'block';
        
        const btn = document.getElementById('btnHomeGuru');
        btn.style.display = (viewId === 'view-guru-menu') ? 'none' : 'block';

        if(viewId === 'view-sejarah') loadRPHList('draft'); 
    };
    window.showGuruMenu = () => window.switchGuruView('view-guru-menu');

    // Init Modules
    initJadual();
    initJana();
    initSejarah();
}