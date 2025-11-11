// js/router.js
import { auth, db } from './firebase.js';
import { renderLoginPage, renderRegisterPage, logout } from './auth.js';
import { renderDashboardPage } from './dashboard.js';
import { renderReportsPage } from './reports.js';
import { renderMachinesPage, renderMachineDetailPage } from './machines.js'; // PASTIKAN KEDUA INI TERIMPOR
import { setupNotificationListener } from './notifications.js';

// ... (kode lainnya) ...

const loadPage = async (path) => {
    // ... (kode loading indicator dan cek user login) ...

    let userRole = 'guest';
    if (user) {
        try {
            console.log(`[Router] Fetching role for user ID: ${user.uid}`);
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            userRole = userData ? userData.role : 'technician';
            console.log(`[Router] User role fetched: ${userRole}`);
        } catch (error) {
            console.error("[Router] Error fetching user role:", error);
            userRole = 'technician';
            alert("Gagal memuat peran pengguna. Anda mungkin tidak dapat mengakses beberapa fitur.");
        }
    }

    switch (path) {
        // ... (kasus login, register, dashboard, reports) ...
        case '/machines':
            if (user && (userRole === 'admin' || userRole === 'technician')) {
                console.log("[Router] User authorized for Machines. Rendering Machines Page.");
                await renderMachinesPage(appContent); // Panggil fungsi renderMachinesPage
            } else {
                console.warn(`[Router] User not authorized for Machines. Current role: ${userRole}`);
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
                    await renderMachineDetailPage(appContent, machineId); // Panggil fungsi renderMachineDetailPage
                } else {
                    console.warn("[Router] Machine ID not found for /machines/detail.");
                    appContent.innerHTML = `<p class="notification is-warning">ID Mesin tidak ditemukan. Kembali ke <a data-nav href="/machines">Master Mesin</a>.</p>`;
                }
            } else {
                console.warn(`[Router] User not authorized for Machine Detail. Current role: ${userRole}`);
                appContent.innerHTML = `<p class="notification is-danger">Anda tidak memiliki izin untuk mengakses halaman ini.</p>`;
                if (user) navigateTo('/login');
            }
            break;
        // ... (sisa kasus default) ...
    }
};

// ... (sisa kode router.js) ...
