// js/router.js
import { auth, db } from './firebase.js'; // Import auth dan db dari firebase.js
import { renderLoginPage, renderRegisterPage, logout } from './auth.js';
import { renderDashboardPage } from './dashboard.js';
import { renderReportsPage } from './reports.js';
import { renderMachinesPage, renderMachineDetailPage } from './machines.js';
import { setupNotificationListener } from './notifications.js'; // Pastikan ini diimpor jika diperlukan

console.log("[Router] Router module started loading."); // Debug log

const appContent = document.getElementById('app-content');
const navLinks = document.getElementById('nav-links');
const authButtons = document.getElementById('auth-buttons');
const notificationArea = document.getElementById('notification-area');

// Debug log untuk memastikan elemen DOM ditemukan
console.log("[Router] App content element:", appContent);
console.log("[Router] Nav links element:", navLinks);
console.log("[Router] Auth buttons element:", authButtons);
console.log("[Router] Notification area element:", notificationArea);


// Fungsi untuk memuat konten halaman berdasarkan path URL
const loadPage = async (path) => {
    console.log(`[Router] loadPage called for path: "${path}"`); // Debug log

    // Bersihkan konten sebelumnya dan tampilkan loading indicator
    if (appContent) { // Pastikan appContent ada sebelum menggunakannya
        appContent.innerHTML = `
            <div class="has-text-centered">
                <progress class="progress is-small is-info mt-6" max="100">Memuat halaman...</progress>
                <p>Silakan tunggu...</p>
            </div>
        `;
    } else {
        console.error("[Router] appContent element not found during loadPage. Cannot render page content.");
        return; // Hentikan eksekusi jika elemen utama tidak ada
    }

    const user = auth.currentUser;
    console.log(`[Router] Current user during loadPage: ${user ? user.uid : "null"}`); // Debug log

    // Jika user belum login, paksa ke halaman login kecuali path adalah '/register'
    if (!user && path !== '/login' && path !== '/register') {
        console.log("[Router] User not logged in and path not login/register, redirecting to /login."); // Debug log
        navigateTo('/login');
        return;
    }

    // Ambil peran pengguna untuk otorisasi
    let userRole = 'guest'; // Default role jika user belum login
    if (user) {
        try {
            console.log(`[Router] Fetching role for user ID: ${user.uid}`); // Debug log
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            userRole = userData ? userData.role : 'technician'; // Default technician jika role tidak ditemukan di Firestore
            console.log(`[Router] User role fetched: ${userRole}`); // Debug log
        } catch (error) {
            console.error("[Router] Error fetching user role from Firestore:", error); // Debug log
            // Jika gagal mengambil role, asumsikan teknisi sebagai fallback
            userRole = 'technician';
            alert("Gagal memuat peran pengguna. Anda mungkin tidak dapat mengakses beberapa fitur. Mohon coba login ulang.");
        }
    }

    // Render halaman berdasarkan path dan otorisasi
    switch (path) {
        case '/login':
            console.log("[Router] Rendering Login Page.");
            appContent.innerHTML = renderLoginPage();
            break;
        case '/register':
            console.log("[Router] Rendering Register Page.");
            appContent.innerHTML = renderRegisterPage();
            break;
        case '/dashboard':
            // Izinkan admin dan teknisi akses dashboard
            if (user && (userRole === 'admin' || userRole === 'technician')) {
                console.log("[Router] User authorized for Dashboard. Rendering Dashboard Page.");
                await renderDashboardPage(appContent);
            } else {
                console.warn(`[Router] User not authorized for Dashboard. Current role: ${userRole}.`); // Debug log
                appContent.innerHTML = `<p class="notification is-danger">Anda tidak memiliki izin untuk mengakses halaman ini.</p>`;
                if (user) navigateTo('/login'); // Redirect ke login jika user login tapi tidak punya akses
            }
            break;
        case '/reports':
            if (user && (userRole === 'admin' || userRole === 'technician')) {
                console.log("[Router] User authorized for Reports. Rendering Reports Page.");
                await renderReportsPage(appContent);
            } else {
                console.warn(`[Router] User not authorized for Reports. Current role: ${userRole}.`); // Debug log
                appContent.innerHTML = `<p class="notification is-danger">Anda tidak memiliki izin untuk mengakses halaman ini.</p>`;
                if (user) navigateTo('/login');
            }
            break;
        case '/machines':
            if (user && (userRole === 'admin' || userRole === 'technician')) {
                console.log("[Router] User authorized for Machines. Rendering Machines Page.");
                await renderMachinesPage(appContent);
            } else {
                console.warn(`[Router] User not authorized for Machines. Current role: ${userRole}.`); // Debug log
                appContent.innerHTML = `<p class="notification is-danger">Anda tidak memiliki izin untuk mengakses halaman ini.</p>`;
                if (user) navigateTo('/login');
            }
            break;
        case '/machines/detail': // Untuk detail mesin, perlu parameter ID
            if (user && (userRole === 'admin' || userRole === 'technician')) {
                const urlParams = new URLSearchParams(window.location.search);
                const machineId = urlParams.get('id');
                if (machineId) {
                    console.log(`[Router] User authorized for Machine Detail. Rendering Machine Detail Page for ID: ${machineId}`); // Debug log
                    await renderMachineDetailPage(appContent, machineId);
                } else {
                    console.warn("[Router] Machine ID not found for /machines/detail path."); // Debug log
                    appContent.innerHTML = `<p class="notification is-warning">ID Mesin tidak ditemukan. Kembali ke <a data-nav href="/machines">Master Mesin</a>.</p>`;
                }
            } else {
                console.warn(`[Router] User not authorized for Machine Detail. Current role: ${userRole}.`); // Debug log
                appContent.innerHTML = `<p class="notification is-danger">Anda tidak memiliki izin untuk mengakses halaman ini.</p>`;
                if (user) navigateTo('/login');
            }
            break;
        default:
            // Default ke dashboard jika login, atau login jika belum
            if (user) {
                console.log("[Router] Default path for logged-in user. Redirecting to /dashboard."); // Debug log
                navigateTo('/dashboard');
            } else {
                console.log("[Router] Default path for logged-out user. Redirecting to /login."); // Debug log
                navigateTo('/login');
            }
            break;
    }
};

// Fungsi untuk navigasi antar halaman tanpa full page reload
export const navigateTo = (path, state = {}) => {
    console.log(`[Router] navigateTo called: "${path}"`); // Debug log
    if (window.location.pathname === path) {
        // Jika path sama, tidak perlu pushState baru, cukup muat ulang konten
        console.log(`[Router] Already at path "${path}", just reloading content.`);
        loadPage(path);
    } else {
        history.pushState(state, '', path);
        loadPage(path);
    }
};

// Event listener untuk tombol navigasi yang memiliki atribut data-nav
document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-nav]'); // Menggunakan closest() untuk menangani klik pada anak elemen
    if (target) {
        e.preventDefault(); // Mencegah reload halaman penuh
        const href = target.getAttribute('href');
        console.log(`[Router] Navigation link clicked: "${href}"`); // Debug log
        navigateTo(href);
    }
});

// Event listener untuk tombol logout (diberi ID 'logout-button' di HTML)
document.addEventListener('click', (e) => {
    if (e.target.id === 'logout-button') {
        console.log("[Router] Logout button clicked."); // Debug log
        logout(); // Panggil fungsi logout dari auth.js
    }
});

// Tangani tombol back/forward browser
window.addEventListener('popstate', () => {
    console.log("[Router] Browser popstate event triggered. Loading current path."); // Debug log
    loadPage(window.location.pathname);
});

// --- Inisialisasi Aplikasi berdasarkan Status Autentikasi ---
console.log("[Router] Attaching auth.onAuthStateChanged listener."); // Debug log
auth.onAuthStateChanged(async (user) => {
    console.log(`[Router] auth.onAuthStateChanged triggered. User: ${user ? user.uid : "null"}`); // Debug log

    if (user) {
        // Pengguna login
        console.log(`[Router] User ${user.uid} is logged in.`); // Debug log
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        const userRole = userData ? userData.role : 'technician'; // Default role jika belum ada di Firestore
        console.log(`[Router] User role for ${user.uid}: ${userRole}`); // Debug log

        // Update tombol autentikasi dan navigasi
        if (authButtons) {
            authButtons.innerHTML = `
                <span class="navbar-item has-text-white">Halo, ${user.displayName || user.email} (${userRole})</span>
                <a class="button is-light" id="logout-button">
                    Log Out
                </a>
            `;
        }
        if (navLinks) {
            navLinks.innerHTML = `
                <a class="navbar-item" data-nav href="/dashboard">Dashboard</a>
                <a class="navbar-item" data-nav href="/reports">Log Laporan</a>
                <a class="navbar-item" data-nav href="/machines">Master Mesin</a>
            `;
        }
        
        // Setup notifikasi in-app
        if (notificationArea && setupNotificationListener) { // Pastikan elemen dan fungsi setupNotificationListener ada
            notificationArea.style.display = 'block'; // Tampilkan area notifikasi
            setupNotificationListener(); // Panggil fungsi setupNotificationListener dari notifications.js
        } else {
             console.warn("[Router] Notification area or setupNotificationListener not found. Skipping notification setup.");
        }


        // Muat halaman awal sesuai URL saat ini atau default ke dashboard
        const currentPath = window.location.pathname;
        if (currentPath === '/' || currentPath === '/login' || currentPath === '/register') {
            console.log(`[Router] Initial path "${currentPath}" for logged-in user, redirecting to /dashboard.`); // Debug log
            navigateTo('/dashboard');
        } else {
            console.log(`[Router] Initial path "${currentPath}" for logged-in user, loading current path.`); // Debug log
            loadPage(currentPath);
        }
    } else {
        // Pengguna logout
        console.log("[Router] User is logged out."); // Debug log
        if (authButtons) {
            authButtons.innerHTML = `
                <a class="button is-primary" data-nav href="/register">
                    <strong>Sign up</strong>
                </a>
                <a class="button is-light" data-nav href="/login">
                    Log in
                </a>
            `;
        }
        if (navLinks) {
            navLinks.innerHTML = ''; // Hapus navigasi
        }
        if (notificationArea) {
             notificationArea.style.display = 'none'; // Sembunyikan area notifikasi saat logout
        }
        
        console.log("[Router] Navigating to /login for logged-out user."); // Debug log
        navigateTo('/login'); // Kembali ke halaman login
    }
});

console.log("[Router] Router module finished loading."); // Debug log
