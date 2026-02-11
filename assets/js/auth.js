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
        // Jika emel bermula dengan 'sekolah-', terus set sebagai school-admin
        if (email.startsWith('sekolah-')) {
            console.log("[Auth] Identiti: Admin Sekolah");
            localStorage.setItem('userRole', 'school-admin');
            return 'school-admin';
        }

        // -------------------------------------------------------------
        // LANGKAH 2: SEMAK SUPERADMIN
        // -------------------------------------------------------------
        // Contoh hardcoded superadmin (pilihan) atau database
        if (email === 'superadmin@moe.gov.my') { 
            return 'superadmin'; 
        }

        const superAdminRef = doc(db, 'users', user.uid);
        const superAdminSnap = await getDoc(superAdminRef);

        if (superAdminSnap.exists()) {
            console.log("[Auth] Identiti: Superadmin");
            localStorage.setItem('userRole', 'superadmin');
            return 'superadmin';
        } 
        
        // -------------------------------------------------------------
        // LANGKAH 3: SEMAK GURU & PENYELIA (MULTIPLE DOCS)
        // -------------------------------------------------------------
        let determinedRole = null; 
        let foundRecord = false;

        const schoolsSnap = await getDocs(collection(db, 'schools'));
        
        for (const schoolDoc of schoolsSnap.docs) {
            // Cari SEMUA dokumen yang ada emel ini dalam subcollection teachers
            const teacherQuery = query(
                collection(db, 'schools', schoolDoc.id, 'teachers'), 
                where('email', '==', email)
            );
            
            const teacherSnap = await getDocs(teacherQuery);

            // Jika jumpa sekurang-kurangnya satu dokumen
            if (!teacherSnap.empty) {
                console.log(`[Auth] Jumpa ${teacherSnap.size} rekod di sekolah ${schoolDoc.id}`);
                
                let isPenyelia = false;
                let isGuru = false;

                // Loop semua dokumen yang dijumpai
                teacherSnap.forEach((docSnap) => {
                    const data = docSnap.data();
                    const rawRole = (data.role || '').trim().toLowerCase();
                    
                    if (rawRole === 'penyelia') isPenyelia = true;
                    if (rawRole === 'guru') isGuru = true;

                    // Update lastLogin
                    try {
                        const ref = doc(db, 'schools', schoolDoc.id, 'teachers', docSnap.id);
                        updateDoc(ref, { 
                            lastLogin: Timestamp.now(), 
                            uid: user.uid 
                        });
                    } catch(e) {}
                });

                // Keutamaan Role
                if (isPenyelia) {
                    determinedRole = 'penyelia';
                } else {
                    determinedRole = 'guru';
                }

                console.log(`[Auth] Keputusan Akhir: ${determinedRole}`);
                foundRecord = true;
                break; // Berhenti cari di sekolah lain
            }
        }

        // -------------------------------------------------------------
        // LANGKAH 4: PENGESAHAN AKHIR
        // -------------------------------------------------------------
        if (!foundRecord) {
            alert("Akaun tiada dalam rekod guru/penyelia. Sila hubungi Admin.");
            await signOut(auth);
            localStorage.clear();
            return null;
        }

        localStorage.setItem('userRole', determinedRole);
        return determinedRole;

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
            // Kita biarkan router handle, cuma simpan user session
        }
    } catch (error) {
        console.error("Redirect Error:", error);
    }
})();