// js/auth.js
import { auth, db, firebase_firestore_FieldValue } from './firebase.js'; // Import dari firebase.js
import { navigateTo } from './router.js'; // Untuk mengalihkan halaman setelah login/register

// --- UI Rendering Functions ---
// Fungsi ini mengembalikan string HTML untuk halaman login
export const renderLoginPage = () => `
    <div class="columns is-centered">
        <div class="column is-4">
            <h1 class="title has-text-centered">Log In</h1>
            <div class="box">
                <form id="login-form">
                    <div class="field">
                        <label class="label">Email</label>
                        <div class="control">
                            <input class="input" type="email" placeholder="e.g. alex@example.com" id="login-email" required>
                        </div>
                    </div>

                    <div class="field">
                        <label class="label">Password</label>
                        <div class="control">
                            <input class="input" type="password" placeholder="********" id="login-password" required>
                        </div>
                    </div>

                    <div class="field">
                        <div class="control">
                            <button class="button is-primary is-fullwidth" type="submit">Log In</button>
                        </div>
                    </div>
                    <p class="has-text-centered">Belum punya akun? <a data-nav href="/register">Daftar di sini</a></p>
                </form>
            </div>
        </div>
    </div>
`;

// Fungsi ini mengembalikan string HTML untuk halaman registrasi
export const renderRegisterPage = () => `
    <div class="columns is-centered">
        <div class="column is-4">
            <h1 class="title has-text-centered">Daftar Akun Baru</h1>
            <div class="box">
                <form id="register-form">
                    <div class="field">
                        <label class="label">Email</label>
                        <div class="control">
                            <input class="input" type="email" placeholder="e.g. alex@example.com" id="register-email" required>
                        </div>
                    </div>

                    <div class="field">
                        <label class="label">Password</label>
                        <div class="control">
                            <input class="input" type="password" placeholder="********" id="register-password" required>
                        </div>
                    </div>

                    <div class="field">
                        <label class="label">Nama Lengkap</label>
                        <div class="control">
                            <input class="input" type="text" placeholder="Nama Lengkap Anda" id="register-display-name" required>
                        </div>
                    </div>

                    <div class="field">
                        <div class="control">
                            <button class="button is-primary is-fullwidth" type="submit">Daftar</button>
                        </div>
                    </div>
                    <p class="has-text-centered">Sudah punya akun? <a data-nav href="/login">Login di sini</a></p>
                </form>
            </div>
        </div>
    </div>
`;

// --- Authentication Logic ---

// Event listener untuk submit form login
document.addEventListener('submit', async (e) => {
    if (e.target.id === 'login-form') {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            await auth.signInWithEmailAndPassword(email, password);
            alert('Login berhasil!');
            // onAuthStateChanged di router.js akan menangani navigasi
        } catch (error) {
            console.error('Error logging in:', error);
            let errorMessage = "Terjadi kesalahan saat login.";
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                errorMessage = "Email atau password salah.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "Format email tidak valid.";
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = "Kesalahan koneksi internet. Mohon coba lagi.";
            }
            alert(errorMessage);
        }
    } else if (e.target.id === 'register-form') {
        e.preventDefault();
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const displayName = document.getElementById('register-display-name').value;

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await userCredential.user.updateProfile({ displayName: displayName });

            // Simpan profil pengguna di Firestore dengan role default 'technician'
            await db.collection('users').doc(userCredential.user.uid).set({
                email: userCredential.user.email,
                displayName: displayName,
                role: 'technician', // Default role untuk pendaftaran baru
                createdAt: firebase_firestore_FieldValue.serverTimestamp()
            });

            alert('Registrasi berhasil! Anda telah login.');
            // onAuthStateChanged di router.js akan menangani navigasi
        } catch (error) {
            console.error('Error registering:', error);
            let errorMessage = "Terjadi kesalahan saat mendaftar.";
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "Email ini sudah terdaftar.";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "Password terlalu lemah (minimal 6 karakter).";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "Format email tidak valid.";
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = "Kesalahan koneksi internet. Mohon coba lagi.";
            }
            alert(errorMessage);
        }
    }
});

// Fungsi logout
export const logout = async () => {
    try {
        await auth.signOut();
        alert('Anda telah logout.');
        // onAuthStateChanged di router.js akan menangani navigasi
    } catch (error) {
        console.error('Error logging out:', error);
        alert('Terjadi kesalahan saat logout.');
    }
};

console.log("Auth module loaded and listeners attached.");
