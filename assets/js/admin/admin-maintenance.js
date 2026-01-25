// assets/js/admin/admin-maintenance.js

import { db } from '../config.js';
import { 
    collection, getDocs, writeBatch, doc, Timestamp, setDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Pastikan nama fungsi ini sama dengan yang ada dalam router.js
export function loadMaintenance() {
    const content = document.getElementById('content');
    
    content.innerHTML = `
        <style>
            .maint-wrapper { max-width: 800px; margin: 0 auto; padding: 30px 20px; font-family: 'Segoe UI', sans-serif; }
            .header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
            .btn-back { background: #64748b; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; }
            
            /* Section Card Styles */
            .tool-card { background: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 25px; border: 1px solid #e2e8f0; overflow: hidden; }
            .tool-header { padding: 15px 20px; font-weight: bold; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #e2e8f0; }
            .tool-body { padding: 20px; }

            /* Colors */
            .bg-blue { background: #f0f9ff; color: #0369a1; }
            .bg-green { background: #f0fdf4; color: #15803d; }
            .bg-red { background: #fef2f2; color: #b91c1c; }

            /* Buttons */
            .btn-action { padding: 10px 20px; border-radius: 6px; border: none; font-weight: 600; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; gap: 8px; }
            .btn-backup { background: #0ea5e9; color: white; }
            .btn-backup:hover { background: #0284c7; }
            
            .btn-restore { background: #22c55e; color: white; }
            .btn-restore:hover { background: #16a34a; }

            .btn-wipe { background: #dc2626; color: white; }
            .btn-wipe:hover { background: #b91c1c; }

            /* File Input */
            .file-input { border: 1px solid #cbd5e1; padding: 8px; border-radius: 6px; width: 100%; margin-bottom: 10px; }
        </style>

        <div class="maint-wrapper">
            <div class="header-flex">
                <h2 style="color:#1e293b; margin:0;">🛠️ Senggaraan Sistem</h2>
                <button class="btn-back" onclick="window.router.navigate('admin-home')">⬅ Kembali</button>
            </div>

            <div class="tool-card">
                <div class="tool-header bg-blue">
                    💾 BACKUP DATA
                </div>
                <div class="tool-body">
                    <p style="margin-top:0;">Simpan salinan keselamatan semua RPH ke dalam komputer anda sebagai fail JSON.</p>
                    <button id="btnBackup" class="btn-action btn-backup">
                        ⬇️ Muat Turun Data RPH (.json)
                    </button>
                    <p id="backupStatus" style="font-size:0.9rem; margin-top:10px; font-weight:bold;"></p>
                </div>
            </div>

            <div class="tool-card">
                <div class="tool-header bg-green">
                    ♻️ RESTORE DATA
                </div>
                <div class="tool-body">
                    <p style="margin-top:0;">Muat naik fail JSON backup untuk memulihkan data RPH yang hilang.</p>
                    <input type="file" id="restoreFile" accept=".json" class="file-input">
                    <button id="btnRestore" class="btn-action btn-restore">
                        ⬆️ Pulihkan Data (Restore)
                    </button>
                    <p id="restoreStatus" style="font-size:0.9rem; margin-top:10px; font-weight:bold;"></p>
                </div>
            </div>

            <div class="tool-card" style="border-color:#fca5a5;">
                <div class="tool-header bg-red">
                    ⚠️ ZON BAHAYA: RESET TAHUNAN
                </div>
                <div class="tool-body">
                    <p>Padam <strong>SEMUA</strong> rekod RPH. Tindakan ini tidak boleh dikembalikan. Sila buat backup dahulu!</p>
                    <button id="btnWipeRph" class="btn-action btn-wipe">
                        🗑️ PADAM SEMUA DATA RPH
                    </button>
                    <p id="wipeStatus" style="font-size:0.9rem; margin-top:10px; font-weight:bold;"></p>
                </div>
            </div>
        </div>
    `;

    // Event Listeners
    document.getElementById('btnBackup').addEventListener('click', backupRPH);
    document.getElementById('btnRestore').addEventListener('click', restoreRPH);
    document.getElementById('btnWipeRph').addEventListener('click', wipeAllRPH);
}

/**
 * FUNGSI 1: BACKUP (Download JSON)
 */
async function backupRPH() {
    const status = document.getElementById('backupStatus');
    const btn = document.getElementById('btnBackup');

    status.textContent = "Sedang mengambil data...";
    status.style.color = "orange";
    btn.disabled = true;

    try {
        const querySnapshot = await getDocs(collection(db, 'rph'));
        const rphList = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Convert Timestamp Firestore ke format yang boleh disimpan dalam JSON (String/Seconds)
            // Kita simpan 'seconds' supaya mudah convert balik nanti
            const record = {
                _id: doc.id, // Simpan ID asal dokumen
                ...data,
                tarikh: data.tarikh ? { seconds: data.tarikh.seconds, nanoseconds: data.tarikh.nanoseconds } : null,
                createdAt: data.createdAt ? { seconds: data.createdAt.seconds, nanoseconds: data.createdAt.nanoseconds } : null
            };
            rphList.push(record);
        });

        if (rphList.length === 0) {
            status.textContent = "Tiada data untuk di-backup.";
            status.style.color = "red";
            btn.disabled = false;
            return;
        }

        // Buat file JSON Blob
        const jsonStr = JSON.stringify(rphList, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        // Auto download
        const a = document.createElement('a');
        a.href = url;
        const today = new Date().toISOString().split('T')[0];
        a.download = `backup-rph-${today}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        status.textContent = `✅ Berjaya! Fail backup (${rphList.length} rekod) telah dimuat turun.`;
        status.style.color = "green";

    } catch (e) {
        console.error(e);
        status.textContent = "Ralat: " + e.message;
        status.style.color = "red";
    } finally {
        btn.disabled = false;
    }
}

/**
 * FUNGSI 2: RESTORE (Upload JSON)
 */
async function restoreRPH() {
    const fileInput = document.getElementById('restoreFile');
    const status = document.getElementById('restoreStatus');
    const btn = document.getElementById('btnRestore');

    if (fileInput.files.length === 0) {
        alert("Sila pilih fail .json dahulu.");
        return;
    }

    if(!confirm("Adakah anda pasti mahu memulihkan data? Data dengan ID yang sama akan ditimpa.")) return;

    const file = fileInput.files[0];
    const reader = new FileReader();

    status.textContent = "Sedang membaca fail...";
    status.style.color = "orange";
    btn.disabled = true;

    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (!Array.isArray(data)) {
                throw new Error("Format fail tidak sah. Data mesti dalam bentuk Array.");
            }

            status.textContent = `Sedang memproses ${data.length} rekod ke database...`;

            // Kita guna batch untuk laju (limit 500 per batch)
            // Di sini kita buat loop simple dengan batch chunking
            const batchSize = 400; 
            let batch = writeBatch(db);
            let count = 0;
            let totalProcessed = 0;

            for (const item of data) {
                const docId = item._id; // Ambil ID asal
                delete item._id; // Buang field _id supaya tak masuk dalam data dokumen

                // CONVERT BALIK TARIKH KE FIRESTORE TIMESTAMP
                if (item.tarikh && item.tarikh.seconds) {
                    item.tarikh = new Timestamp(item.tarikh.seconds, item.tarikh.nanoseconds);
                }
                if (item.createdAt && item.createdAt.seconds) {
                    item.createdAt = new Timestamp(item.createdAt.seconds, item.createdAt.nanoseconds);
                }
                // Jika reviewedAt wujud
                if (item.reviewedAt && item.reviewedAt.seconds) {
                    item.reviewedAt = new Timestamp(item.reviewedAt.seconds, item.reviewedAt.nanoseconds);
                }
                if (item.updatedAt && item.updatedAt.seconds) {
                    item.updatedAt = new Timestamp(item.updatedAt.seconds, item.updatedAt.nanoseconds);
                }

                const docRef = doc(db, 'rph', docId); // Guna ID asal
                batch.set(docRef, item); // 'set' akan overwrite atau create new

                count++;
                totalProcessed++;

                // Jika batch dah penuh, commit dan reset
                if (count >= batchSize) {
                    await batch.commit();
                    batch = writeBatch(db);
                    count = 0;
                    status.textContent = `Sedang menyimpan... (${totalProcessed}/${data.length})`;
                }
            }

            // Commit baki terakhir
            if (count > 0) {
                await batch.commit();
            }

            status.textContent = `✅ Berjaya memulihkan ${totalProcessed} rekod RPH!`;
            status.style.color = "green";
            fileInput.value = ''; // Reset input

        } catch (err) {
            console.error(err);
            status.textContent = "Ralat fail: " + err.message;
            status.style.color = "red";
        } finally {
            btn.disabled = false;
        }
    };

    reader.readAsText(file);
}

/**
 * FUNGSI 3: WIPE ALL (Padam Semua)
 */
async function wipeAllRPH() {
    const status = document.getElementById('wipeStatus');
    const btn = document.getElementById('btnWipeRph');
    
    if(!confirm("AMARAN KRITIKAL: Anda akan memadam SEMUA rekod RPH dalam sistem. Sila pastikan anda SUDAH BUAT BACKUP.")) return;
    
    const verify = prompt("Taip 'PADAM' untuk sahkan:");
    if (verify !== 'PADAM') return;

    status.textContent = "Sedang memadam...";
    status.style.color = "red";
    btn.disabled = true;
    
    try {
        const q = collection(db, 'rph');
        const snapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        let count = 0;

        snapshot.forEach(doc => {
            batch.delete(doc.ref);
            count++;
        });

        await batch.commit();

        status.textContent = `✅ ${count} rekod telah dipadam.`;
        status.style.color = "green";
        btn.innerHTML = "Selesai";

    } catch (e) {
        status.textContent = "Ralat: " + e.message;
        btn.disabled = false;
    }
}