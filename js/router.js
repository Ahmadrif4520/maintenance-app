// js/router.js
import { auth, db } from './firebase.js';
import { renderLoginPage, renderRegisterPage, logout } from './auth.js';
import { renderDashboardPage } from './dashboard.js'; // PASTIKAN INI TERIMPOR
import { renderReportsPage } from './reports.js';
import { renderMachinesPage, renderMachineDetailPage } from './machines.js';
import { setupNotificationListener } from './notifications.js';

// ... (kode lainnya) ...

const loadPage = async (path) => {
    // ... (kode loading indicator dan cek user login) ...

    let userRole = 'guest';
    if (user) {
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            userRole = userData ? userData.role : 'technician'; // Default technician jika role tidak ditemukan
        } catch (error) {
            console.error("Error fetching user role:", error);
            userRole = 'technician';
        }
    }

    switch (path) {
        // ... (kasus login dan register) ...
        case '/dashboard':
            // Izinkan admin dan teknisi akses dashboard
            if (user && (userRole === 'admin' || userRole === 'technician')) {
                await renderDashboardPage(appContent); // Panggil fungsi renderDashboardPage
            } else {
                appContent.innerHTML = `<p class="notification is-danger">Anda tidak memiliki izin untuk mengakses halaman ini.</p>`;
                if (user) navigateTo('/login');
            }
            break;
        // ... (kasus reports, machines, dll) ...
    }
};

// ... (kode lainnya) ...
