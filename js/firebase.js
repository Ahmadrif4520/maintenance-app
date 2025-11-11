
// js/firebase.js
// Firebase configuration Anda dari konsol Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDjB3h7EsI-A7B56bkgvcKDVgvMJYSCjPU",
  authDomain: "chinaglaze-app.firebaseapp.com",
  databaseURL: "https://chinaglaze-app-default-rtdb.firebaseio.com",
  projectId: "chinaglaze-app",
  storageBucket: "chinaglaze-app.firebasestorage.app",
  messagingSenderId: "546767539175",
  appId: "1:546767539175:web:c67b1cd90638e8cc4fcb42",
  measurementId: "G-6PZN326DJ0"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);

// Ekspor objek-objek Firebase yang sering digunakan
export const auth = firebase.auth();
export const db = firebase.firestore();

// Ekspor FieldValue untuk serverTimestamp()
export const firebase_firestore_FieldValue = firebase.firestore.FieldValue;

console.log("Firebase initialized.");

