// js/router.js
import { auth, db } from './firebase.js';
import { renderLoginPage, renderRegisterPage, logout } from './auth.js';
import { renderDashboardPage } from './dashboard.js';
import { renderReportsPage } from './reports.js';
import { renderMachinesPage, renderMachineDetailPage } from './machines.js';
// Import fungsi setupNotificationListener dan fungsi cleanup dari notifications.js
import { setupNotificationListener, updateNotificationBadge, machinesUnsubscribe, notificationsUnsubscribe } from './notifications.js';
import { renderMaterialHandlingPage } from './material_handling.js';

console.log("[Router] Router module started loading.");

const appContent = document.getElementById('app-content');
const navLinks = document.getElementById('nav-links');
const authButtons = document.getElementById('auth-buttons');
// Tidak lagi menggunakan #notification-area untuk toggling display,
// karena sekarang ada #notification-toast-container yang fixed.
// Namun, kita tetap butuh elemen untuk badge notifikasi di navbar.


console.log("[Router] App content element:", appContent);
console.log("[Router] Nav links element:", navLinks);
console.log("[Router] Auth buttons element:", authButtons);


// Fungsi untuk memuat konten halaman berdasarkan path URL
const loadPage = async (path) => {
    console.log(`[Router] loadPage called for path: "${path}"`);

    if (!appContent) {
        console.error("[Router] appContent element not found during loadPage. Cannot render page content.");
        return;
    }

    // Tampilkan loading indicator
    appContent.innerHTML = `
        <div class="has-text-centered">
            <progress class="progress is-small is-info mt-6" max="100">Memuat halaman...</progress>
            <p>Silakan tunggu...</p>
        </div>
    `;

    const user = auth.currentUser;
    console.log(`[Router] Current user during loadPage: ${user ? user.uid : "null"}`);

    // Jika user belum login, paksa ke halaman login kecuali path adalah '/register'
    if (!user && path !== '/login' && path !== '/register') {
        console.log("[Router] User not logged in and path not login/register, redirecting to /login.");
        navigateTo('/login');
        return;
    }

    // Ambil peran pengguna untuk otorisasi
    let userRole = 'guest'; // Default role jika user belum login
    if (user) {
        try {
            console.log(`[Router] Fetching role for user ID: ${user.uid}`);
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            userRole = userData ? userData.role : 'technician'; // Default technician jika role tidak ditemukan di Firestore
            console.log(`[Router] User role fetched: ${userRole}`);
        } catch (error) {
            console.error("[Router] Error fetching user role from Firestore:", error);
            userRole = 'technician'; // Fallback jika gagal fetch role
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
            if (user && (userRole === 'admin' || userRole === 'technician')) {
                console.log("[Router] User authorized for Dashboard. Rendering Dashboard Page.");
                await renderDashboardPage(appContent);
            } else {
                console.warn(`[Router] User not authorized for Dashboard. Current role: ${userRole}.`);
                appContent.innerHTML = `<p class="notification is-danger">Anda tidak memiliki izin untuk mengakses halaman ini.</p>`;
                if (user) navigateTo('/login'); // Jika user login tapi tidak punya akses, redirect ke login
            }
            break;
        case '/reports':
            if (user && (userRole === 'admin' || userRole === 'technician')) {
                console.log("[Router] User authorized for Reports. Rendering Reports Page.");
                await renderReportsPage(appContent);
            } else {
                console.warn(`[Router] User not authorized for Reports. Current role: ${userRole}.`);
                appContent.innerHTML = `<p class="notification is-danger">Anda tidak memiliki izin untuk mengakses halaman ini.</p>`;
                if (user) navigateTo('/login');
            }
            break;
        case '/machines':
            if (user && (userRole === 'admin' || userRole === 'technician')) {
                console.log("[Router] User authorized for Machines. Rendering Machines Page.");
                await renderMachinesPage(appContent);
            } else {
                console.warn(`[Router] User not authorized for Machines. Current role: ${userRole}.`);
                appContent.innerHTML = `<p class="notification is-danger">Anda tidak memiliki izin untuk mengakses halaman ini.</p>`;
                if (user) navigateTo('/login');
            }
            break;
        case '/machines/detail':
            if (user && (userRole === 'admin' || userRole === 'technician')) {
                const urlParams = new URLSearchParams(window.location.search);
                const machineId = urlParams.get('id');
                if (machineId) {
                    console.log(`[Router] User authorized for Machine Detail. Rendering Machine Detail Page for ID: ${machineId}`);
                    await renderMachineDetailPage(appContent, machineId);
                } else {
                    console.warn("[Router] Machine ID not found for /machines/detail path.");
                    appContent.innerHTML = `<p class="notification is-warning">ID Mesin tidak ditemukan. Kembali ke <a data-nav href="/machines">Master Mesin</a>.</p>`;
                }
            } else {
                console.warn(`[Router] User not authorized for Machine Detail. Current role: ${userRole}.`);
                appContent.innerHTML = `<p class="notification is-danger">Anda tidak memiliki izin untuk mengakses halaman ini.</p>`;
                if (user) navigateTo('/login');
            }
            break;
        case '/material-handling-reports':
            if (user && (userRole === 'admin' || userRole === 'technician')) {
                console.log("[Router] User authorized for Material Handling Reports. Rendering page.");
                await renderMaterialHandlingPage(appContent);
            } else {
                console.warn(`[Router] User not authorized for Material Handling Reports. Current role: ${userRole}.`);
                appContent.innerHTML = `<p class="notification is-danger">Anda tidak memiliki izin untuk mengakses halaman ini.</p>`;
                if (user) navigateTo('/login');
            }
            break;
        default:
            // Jika path tidak dikenali atau adalah '/', default ke dashboard jika login, atau login jika belum
            if (user) {
                console.log("[Router] Default path for logged-in user. Redirecting to /dashboard.");
                navigateTo('/dashboard');
            } else {
                console.log("[Router] Default path for logged-out user. Redirecting to /login.");
                navigateTo('/login');
            }
            break;
    }
};

export const navigateTo = (path, state = {}) => {
    console.log(`[Router] navigateTo called: "${path}"`);
    if (window.location.pathname === path) {
        // Jika path sama, tidak perlu pushState baru, cukup muat ulang konten
        console.log(`[Router] Already at path "${path}", just reloading content.`);
        loadPage(path);
    } else {
        history.pushState(state, '', path);
        loadPage(path);
    }
};

document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-nav]');
    if (target) {
        e.preventDefault();
        const href = target.getAttribute('href');
        console.log(`[Router] Navigation link clicked: "${href}"`);
        navigateTo(href);
    }
});

document.addEventListener('click', (e) => {
    if (e.target.id === 'logout-button') {
        console.log("[Router] Logout button clicked.");
        logout();
    }
});

window.addEventListener('popstate', () => {
    console.log("[Router] Browser popstate event triggered. Loading current path.");
    loadPage(window.location.pathname);
});

console.log("[Router] Attaching auth.onAuthStateChanged listener.");
auth.onAuthStateChanged(async (user) => {
    console.log(`[Router] auth.onAuthStateChanged triggered. User: ${user ? user.uid : "null"}`);

    if (user) {
        console.log(`[Router] User ${user.uid} is logged in.`);
        let userRole = 'technician'; // Default
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            userRole = userData ? userData.role : 'technician';
            console.log(`[Router] User role for ${user.uid}: ${userRole}`);
        } catch (error) {
            console.error("[Router] Error fetching user role on authStateChanged:", error);
            alert("Gagal memuat peran pengguna. Beberapa fitur mungkin tidak berfungsi.");
        }

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
                <a class="navbar-item" data-nav href="/material-handling-reports">M. Handling Reports</a>
            `;
        }
        
        // Setup notifikasi in-app
        // Pastikan notification-toast-container ada di index.html
        if (document.getElementById('notification-toast-container') && setupNotificationListener) {
            console.log("[Router] Initializing notification listeners.");
            setupNotificationListener(); // Panggil fungsi setupNotificationListener dari notifications.js
        } else {
             console.warn("[Router] Notification toast container or setupNotificationListener not found. Skipping notification setup.");
        }


        const currentPath = window.location.pathname;
        if (currentPath === '/' || currentPath === '/login' || currentPath === '/register') {
            console.log(`[Router] Initial path "${currentPath}" for logged-in user, redirecting to /dashboard.`);
            navigateTo('/dashboard');
        } else {
            console.log(`[Router] Initial path "${currentPath}" for logged-in user, loading current path.`);
            loadPage(currentPath);
        }
    } else {
        console.log("[Router] User is logged out.");
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
            navLinks.innerHTML = '';
        }

        // Cleanup notifikasi saat logout
        console.log("[Router] Cleaning up notification listeners.");
        if (machinesUnsubscribe) { // Pastikan variabel global ada dan merupakan fungsi
            machinesUnsubscribe();
            // Penting: Variabel `machinesUnsubscribe` ada di notifications.js,
            // jadi kita tidak bisa langsung mengubahnya dari sini.
            // Notifications.js harus mengelola state unsubscribe-nya sendiri.
            // Namun, karena `notifications.js` dieksekusi ulang saat login,
            // listener lama akan di-cleanup oleh `setupNotificationListener` itu sendiri.
            // Untuk memastikan badge bersih:
            updateNotificationBadge(0);
        }
        if (notificationsUnsubscribe) {
            notificationsUnsubscribe();
            // updateNotificationBadge(0); // Ini sudah dihandle di atas
        }
        const notificationsDropdownContent = document.getElementById('notifications-dropdown-content');
        if(notificationsDropdownContent) notificationsDropdownContent.style.display = 'none'; // Sembunyikan dropdown

        // Jika ada toast yang masih muncul, hapus
        const toastContainer = document.getElementById('notification-toast-container');
        if (toastContainer) toastContainer.innerHTML = '';


        console.log("[Router] Navigating to /login for logged-out user.");
        navigateTo('/login');
    }
});

console.log("[Router] Router module finished loading.");
