// js/router.js
import { auth, db } from './firebase.js'; // Import auth dan db dari firebase.js
import { renderLoginPage, renderRegisterPage, logout } from './auth.js';
import { renderDashboardPage } from './dashboard.js';
import { renderReportsPage } from './reports.js';
import { renderMachinesPage, renderMachineDetailPage } from './machines.js';
import { setupNotificationListener } from './notifications.js';

const appContent = document.getElementById('app-content');
const navLinks = document.getElementById('nav-links');
const authButtons = document.getElementById('auth-buttons');
const notificationArea = document.getElementById('notification-area'); // Ambil elemen notifikasi

// Fungsi untuk memuat konten halaman berdasarkan path URL
const loadPage = async (path) => {
    // Bersihkan konten sebelumnya dan tampilkan loading indicator
    appContent.innerHTML = `
        <div class="has-text-centered">
            <progress class="progress is-small is-info mt-6" max="100">Loading...</progress>
            <p>Memuat halaman...</p>
        </div>
    `;

    const user = auth.currentUser;
    // Jika user belum login, paksa ke halaman login kecuali path adalah '/register'
    if (!user && path !== '/login' && path !== '/register') {
        navigateTo('/login');
        return;
    }

    // Pastikan user memiliki role sebelum merender halaman yang dilindungi
    let userRole = 'guest';
    if (user) {
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            userRole = userData ? userData.role : 'technician'; // Default technician jika role tidak ditemukan
        } catch (error) {
            console.error("Error fetching user role:", error);
            // Jika gagal mengambil role, asumsikan teknisi atau handle error lebih lanjut
            userRole = 'technician';
        }
    }

    switch (path) {
        case '/login':
            appContent.innerHTML = renderLoginPage();
            break;
        case '/register':
            appContent.innerHTML = renderRegisterPage();
            break;
        case '/dashboard':
            // Contoh: hanya admin dan teknisi yang bisa akses dashboard
            if (user && (userRole === 'admin' || userRole === 'technician')) {
                await renderDashboardPage(appContent);
            } else {
                appContent.innerHTML = `<p class="notification is-danger">Anda tidak memiliki izin untuk mengakses halaman ini.</p>`;
                if (user) navigateTo('/login'); // Redirect ke login jika tidak ada izin dan sudah login
            }
            break;
        case '/reports':
            if (user && (userRole === 'admin' || userRole === 'technician')) {
                await renderReportsPage(appContent);
            } else {
                appContent.innerHTML = `<p class="notification is-danger">Anda tidak memiliki izin untuk mengakses halaman ini.</p>`;
                if (user) navigateTo('/login');
            }
            break;
        case '/machines':
            if (user && (userRole === 'admin' || userRole === 'technician')) {
                await renderMachinesPage(appContent);
            } else {
                appContent.innerHTML = `<p class="notification is-danger">Anda tidak memiliki izin untuk mengakses halaman ini.</p>`;
                if (user) navigateTo('/login');
            }
            break;
        case '/machines/detail': // Contoh untuk detail mesin, perlu parameter ID
            if (user && (userRole === 'admin' || userRole === 'technician')) {
                const urlParams = new URLSearchParams(window.location.search);
                const machineId = urlParams.get('id');
                if (machineId) {
                    await renderMachineDetailPage(appContent, machineId);
                } else {
                    appContent.innerHTML = `<p class="notification is-warning">ID Mesin tidak ditemukan. Kembali ke <a data-nav href="/machines">Master Mesin</a>.</p>`;
                }
            } else {
                appContent.innerHTML = `<p class="notification is-danger">Anda tidak memiliki izin untuk mengakses halaman ini.</p>`;
                if (user) navigateTo('/login');
            }
            break;
        default:
            // Default ke dashboard jika login, atau login jika belum
            if (user) {
                navigateTo('/dashboard');
            } else {
                navigateTo('/login');
            }
            break;
    }
};

// Fungsi untuk navigasi antar halaman tanpa full page reload
export const navigateTo = (path, state = {}) => {
    history.pushState(state, '', path);
    loadPage(path);
};

// Event listener untuk tombol navigasi yang memiliki atribut data-nav
document.addEventListener('click', (e) => {
    // Pastikan elemen yang diklik adalah link dengan data-nav
    const target = e.target.closest('[data-nav]');
    if (target) {
        e.preventDefault(); // Mencegah reload halaman penuh
        navigateTo(target.getAttribute('href'));
    }
});

// Event listener untuk tombol logout (diberi ID 'logout-button' di HTML)
document.addEventListener('click', (e) => {
    if (e.target.id === 'logout-button') {
        logout();
    }
});

// Tangani tombol back/forward browser
window.addEventListener('popstate', () => {
    loadPage(window.location.pathname);
});

// --- Inisialisasi Aplikasi berdasarkan Status Autentikasi ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // Pengguna login
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        const userRole = userData ? userData.role : 'technician'; // Default role jika belum ada di Firestore

        // Update tombol autentikasi dan navigasi
        authButtons.innerHTML = `
            <span class="navbar-item has-text-white">Halo, ${user.displayName || user.email} (${userRole})</span>
            <a class="button is-light" id="logout-button">
                Log Out
            </a>
        `;
        navLinks.innerHTML = `
            <a class="navbar-item" data-nav href="/dashboard">Dashboard</a>
            <a class="navbar-item" data-nav href="/reports">Log Laporan</a>
            <a class="navbar-item" data-nav href="/machines">Master Mesin</a>
        `;
        
        // Setup notifikasi in-app
        setupNotificationListener(); // Pastikan fungsi ini diimplementasikan di notifications.js

        // Muat halaman awal sesuai URL saat ini atau default ke dashboard
        const currentPath = window.location.pathname;
        if (currentPath === '/' || currentPath === '/login' || currentPath === '/register') {
            navigateTo('/dashboard');
        } else {
            loadPage(currentPath);
        }
    } else {
        // Pengguna logout
        authButtons.innerHTML = `
            <a class="button is-primary" data-nav href="/register">
                <strong>Sign up</strong>
            </a>
            <a class="button is-light" data-nav href="/login">
                Log in
            </a>
        `;
        navLinks.innerHTML = ''; // Hapus navigasi
        notificationArea.style.display = 'none'; // Sembunyikan area notifikasi saat logout
        navigateTo('/login'); // Kembali ke halaman login
    }
});

console.log("Router module loaded and auth state listener attached.");
