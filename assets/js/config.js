// assets/js/config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
// Tambah 'GoogleAuthProvider' dalam import di bawah
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Konfigurasi Firebase (Dikekalkan)
export const firebaseConfig = {
  apiKey: "AIzaSyD7ACSYTNUReg_S2peCRI7CPCrA_z08j7Y",
  authDomain: "mysystem-dd004.firebaseapp.com",
  projectId: "mysystem-dd004",
  storageBucket: "mysystem-dd004.firebasestorage.app",
  messagingSenderId: "817549355696",
  appId: "1:817549355696:web:3d3a1b8f2b8d2f5c2fa975",
  measurementId: "G-941YH4R81F"
};

// Inisialisasi Aplikasi
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Provider Google (PENTING: Ini diperlukan oleh butang DELIMa di index.html)
export const googleProvider = new GoogleAuthProvider();

// Helper untuk subjek
export const MAP_SUBJECT_TO_FILE = {
  'BM': 'BAHASA MELAYU',
  'BI': 'BAHASA INGGERIS',
  'MT': 'MATEMATIK',
  'SC': 'SAINS',
  'SJ': 'SEJARAH',
  'BA': 'BAHASA ARAB',
  'PJ': 'PENDIDIKAN JASMANI',
  'PK': 'PENDIDIKAN KESIHATAN',
  'PM': 'PENDIDIKAN MORAL',
  'PSV': 'PENDIDIKAN SENI VISUAL',
  'MZ': 'MUZIK',
  'RBT': 'REKA BENTUK DAN TEKNOLOGI',
  'PAI': 'PENDIDIKAN AGAMA ISLAM'
};