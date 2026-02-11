import { auth, db } from './config.js'; 
import { 
    getRedirectResult,
    signInWithEmailAndPassword, 
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    doc, getDoc, updateDoc, Timestamp, 
    collection, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =========================================================
// 1. PENGURUSAN LOGIN & ROLE (DATABASE ROUTING)
// =========================================================
export async function handleLoginSuccess(user) {
    const email = user.email.toLowerCase();
    
    try {
        console.log(`[Auth] Memproses log masuk: ${email}`);

        // -------------------------------------------------------------
        // LANGKAH 1: ADMIN SEKOLAH (BYPASS DATABASE)
        // -------------------------------------------------------------
        if (email.startsWith('sekolah-')) {
            console.log("[Auth] Identiti: Admin Sekolah");
            localStorage.setItem('userRole', 'school-admin');
            return 'school-admin';
        }

        // -------------------------------------------------------------
        // LANGKAH 2: SEMAK SUPERADMIN
        // -------------------------------------------------------------
        const superRef = doc(db, 'users', user.uid);
        const superSnap = await getDoc(superRef);
        if (superSnap.exists() && superSnap.data().role === 'superadmin') {
            console.log("[Auth] Identiti: Superadmin");
            localStorage.setItem('userRole', 'superadmin');
            return 'superadmin';
        }

        // -------------------------------------------------------------
        // LANGKAH 3: SEMAK ADMIN SEKOLAH (DB CHECK)
        // -------------------------------------------------------------
        const schoolRef = doc(db, 'schools', email);
        const schoolSnap = await getDoc(schoolRef);
        if (schoolSnap.exists()) {
            console.log("[Auth] Identiti: Admin Sekolah (DB)");
            localStorage.setItem('userRole', 'school-admin');
            return 'school-admin';
        }

        // -------------------------------------------------------------
        // LANGKAH 4: CARI GURU / PENYELIA (QUERY SEARCH)
        // -------------------------------------------------------------
        let determinedRole = null;
        let foundRecord = false;
        let userData = null;

        // CARA A: Cek Koleksi Global 'teachers' (Guna Query, bukan ID)
        // Ini memastikan rekod ditemui walaupun ID dokumen bukan emel
        const globalQ = query(collection(db, 'teachers'), where('email', '==', email));
        const globalSnap = await getDocs(globalQ);

        if (!globalSnap.empty) {
            console.log("[Auth] Rekod dijumpai di Koleksi Global.");
            userData = globalSnap.docs[0].data(); // Ambil data pertama
            foundRecord = true;
        } 
        else {
            // CARA B: Fallback - Cari dalam setiap sekolah
            console.log("[Auth] Mencari dalam sub-koleksi sekolah...");
            const schoolsQ = query(collection(db, 'schools'));
            const schoolsSnap = await getDocs(schoolsQ);

            for (const schoolDoc of schoolsSnap.docs) {
                // Cari dalam sub-koleksi 'teachers' sekolah ini
                const teachersRef = collection(db, 'schools', schoolDoc.id, 'teachers');
                const qTeacher = query(teachersRef, where('email', '==', email));
                const teacherSnap = await getDocs(qTeacher);

                if (!teacherSnap.empty) {
                    userData = teacherSnap.docs[0].data();
                    foundRecord = true;
                    
                    // Update Last Login (Pilihan)
                    try {
                        await updateDoc(teacherSnap.docs[0].ref, { 
                            lastLogin: Timestamp.now(),
                            uid: user.uid 
                        });
                    } catch(e) { console.log("Gagal update lastLogin:", e); }
                    
                    break; // Jumpa, berhenti loop
                }
            }
        }

        // -------------------------------------------------------------
        // LANGKAH 5: PENENTUAN ROLE (HIERARKI KETAT)
        // -------------------------------------------------------------
        if (foundRecord && userData) {
            console.log("[Auth] Data User Ditemui:", userData);

            // Periksa Flag (Boolean) atau String Role (Legacy)
            const isPenyelia = (userData.isPenyelia === true) || (userData.role === 'penyelia');
            const isGuru = (userData.isGuru === true) || (userData.role === 'guru');

            // LOGIK UTAMA: Utamakan Penyelia secara mutlak
            if (isPenyelia) {
                determinedRole = 'penyelia';
            } else if (isGuru) {
                determinedRole = 'guru';
            } else {
                // Fallback jika akaun wujud tapi tiada role/flag
                determinedRole = 'guru'; 
            }

            console.log(`[Auth] Keputusan Akhir: ${determinedRole.toUpperCase()}`);
            localStorage.setItem('userRole', determinedRole);
            return determinedRole;
        }

        // -------------------------------------------------------------
        // LANGKAH 6: GAGAL
        // -------------------------------------------------------------
        alert(`Akaun (${email}) tiada dalam rekod. Sila hubungi Admin Sekolah.`);
        await signOut(auth);
        localStorage.clear();
        return null;

    } catch (error) {
        console.error("Ralat Auth:", error);
        alert("Ralat log masuk: " + error.message);
        throw error;
    }
}

// Check Redirect (Google Login)
(async function checkRedirect() {
    try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
            console.log("Redirect login berjaya.");
        }
    } catch (error) {
        console.error("Redirect Error:", error);
    }
})();
