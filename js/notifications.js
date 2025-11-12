// js/notifications.js
import { db, auth, firebase_firestore_FieldValue } from './firebase.js';

let machinesUnsubscribe = null; // Ini adalah variabel internal notifications.js
let notificationsUnsubscribe = null; // Ini adalah variabel internal notifications.js

const SERVICE_WARNING_THRESHOLD_PERCENT = 90;
const SERVICE_OVERDUE_THRESHOLD_PERCENT = 100;

// Export updateNotificationBadge agar router.js bisa mengaksesnya
export const updateNotificationBadge = (count) => {
    const badge = document.getElementById('unread-notifications-badge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
};

export const setupNotificationListener = () => {
    console.log("[Notifications] Setting up machine service monitoring.");

    // Pastikan listener sebelumnya dihentikan jika ada
    if (machinesUnsubscribe) {
        machinesUnsubscribe();
        machinesUnsubscribe = null; // Reset setelah unsubscribe
    }
    if (notificationsUnsubscribe) {
        notificationsUnsubscribe();
        notificationsUnsubscribe = null; // Reset setelah unsubscribe
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
        console.warn("[Notifications] No current user, skipping notification listener setup.");
        return;
    }

    // --- Listener untuk memantau status servis mesin ---
    machinesUnsubscribe = db.collection('machines').onSnapshot(async (snapshot) => {
        console.log("[Notifications] Machine data changed. Checking service status...");
        snapshot.forEach(doc => {
            const machine = doc.data();
            checkMachineServiceStatus(machine, currentUser.uid); // Pass currentUser.uid
        });
    }, (error) => {
        console.error("[Notifications] Error listening to machines for service checks:", error);
    });

    // --- Listener untuk menampilkan notifikasi UI ---
    notificationsUnsubscribe = db.collection('notifications')
        .where('toUserId', '==', currentUser.uid) // Filter hanya untuk notifikasi user ini
        .where('isRead', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(5) // Tampilkan 5 notifikasi terakhir yang belum dibaca
        .onSnapshot(async (snapshot) => {
            const unreadCount = snapshot.size;
            updateNotificationBadge(unreadCount);
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const notification = change.doc.data();
                    const notificationId = change.doc.id;
                    console.log("[Notifications] New unread notification:", notification.message);
                    displayNotificationToast(notification.message, notification.type, notificationId);
                }
            });
        }, (error) => {
            console.error("[Notifications] Error listening to user notifications:", error);
        });

    // Setup event listener untuk klik badge/toggle notifikasi
    const notificationsDropdownToggle = document.getElementById('notifications-dropdown-toggle');
    if (notificationsDropdownToggle) {
        notificationsDropdownToggle.addEventListener('click', async () => {
            await displayNotificationsDropdown();
        });
    }
};

// Fungsi baru untuk membersihkan listener dan UI notifikasi
export const cleanupNotificationListenersAndUI = () => {
    console.log("[Notifications] Cleaning up notification listeners and UI.");
    if (machinesUnsubscribe) {
        machinesUnsubscribe();
        machinesUnsubscribe = null;
    }
    if (notificationsUnsubscribe) {
        notificationsUnsubscribe();
        notificationsUnsubscribe = null;
    }
    updateNotificationBadge(0); // Set badge ke 0
    const notificationsDropdownContent = document.getElementById('notifications-dropdown-content');
    if (notificationsDropdownContent) {
        notificationsDropdownContent.style.display = 'none'; // Sembunyikan dropdown
        notificationsDropdownContent.innerHTML = ''; // Bersihkan konten dropdown
    }
    const toastContainer = document.getElementById('notification-toast-container');
    if (toastContainer) {
        toastContainer.innerHTML = ''; // Bersihkan semua toast yang mungkin masih ada
    }
};


async function checkMachineServiceStatus(machine, currentUserId) {
    const machineId = machine.docId; // Gunakan docId Firestore sebagai ID unik mesin
    const machineName = machine.name;
    const machineCategory = machine.category;

    let currentVal = 0;
    let intervalVal = 0;
    let unit = 'Jam';
    let thresholdField = ''; // Field untuk menyimpan status notifikasi terakhir di dokumen mesin

    if (machineCategory === 'material_handling') {
        currentVal = machine.additionalDetails?.odometerKm || 0;
        intervalVal = machine.additionalDetails?.serviceIntervalKm || 0;
        unit = 'Km';
        thresholdField = 'lastNotifiedOdometerThreshold';
    } else { // general, cooling_tower, kompresor_unit
        currentVal = machine.currentRuntimeHours || 0;
        intervalVal = machine.serviceIntervalHours || 0;
        unit = 'Jam';
        thresholdField = 'lastNotifiedRuntimeThreshold';
    }

    if (intervalVal <= 0 || !currentUserId) { // Tidak ada interval servis yang ditentukan atau tidak ada user login
        return;
    }

    const currentPercentage = (currentVal / intervalVal) * 100;
    let notificationType = '';
    let notificationMessage = '';
    let triggeredThreshold = 0;

    if (currentPercentage >= SERVICE_OVERDUE_THRESHOLD_PERCENT) {
        notificationType = 'critical';
        notificationMessage = `Mesin ${machineName} (ID: ${machine.machineId}) sudah ${unit} operasionalnya melebihi batas servis! (${currentVal}/${intervalVal} ${unit})`;
        triggeredThreshold = SERVICE_OVERDUE_THRESHOLD_PERCENT;
    } else if (currentPercentage >= SERVICE_WARNING_THRESHOLD_PERCENT) {
        notificationType = 'warning';
        notificationMessage = `Mesin ${machineName} (ID: ${machine.machineId}) akan segera memerlukan servis! (${currentVal}/${intervalVal} ${unit})`;
        triggeredThreshold = SERVICE_WARNING_THRESHOLD_PERCENT;
    }

    if (notificationType) {
        // Ambil status notifikasi terakhir dari dokumen mesin
        // Pastikan field threshold ada
        const lastNotifiedThreshold = machine[thresholdField]?.threshold || 0;
        const lastNotifiedValue = machine[thresholdField]?.value || 0;

        // Hanya kirim notifikasi jika ambang batas baru tercapai
        // atau jika ambang batas yang sama terlampaui secara signifikan (misal >5% dari interval)
        if (triggeredThreshold > lastNotifiedThreshold || (triggeredThreshold === lastNotifiedThreshold && currentVal > lastNotifiedValue + (intervalVal * 0.05))) {
            await sendServiceNotification(machineId, machineName, notificationMessage, notificationType, currentUserId, triggeredThreshold, currentVal, intervalVal, thresholdField);
        }
    }
}

async function sendServiceNotification(docId, machineName, message, type, toUserId, threshold, currentVal, intervalVal, thresholdField) {
    // Cek apakah notifikasi yang sama (belum dibaca) sudah ada
    const existingNotificationsSnapshot = await db.collection('notifications')
        .where('machineId', '==', docId) // Gunakan docId sebagai machineId di notifikasi
        .where('type', '==', type)
        .where('isRead', '==', false)
        .where('toUserId', '==', toUserId)
        .limit(1)
        .get();

    if (existingNotificationsSnapshot.empty) {
        const notificationData = {
            machineId: docId, // Simpan docId mesin yang memicu
            machineName: machineName,
            message: message,
            type: type,
            isRead: false,
            createdAt: firebase_firestore_FieldValue.serverTimestamp(),
            toUserId: toUserId,
            triggeredThreshold: threshold,
            currentValue: currentVal,
            intervalValue: intervalVal
        };
        await db.collection('notifications').add(notificationData);
        console.log(`[Notifications] New notification added for ${machineName}: ${message}`);

        // Update dokumen mesin dengan status notifikasi terakhir
        await db.collection('machines').doc(docId).update({
            [thresholdField]: {
                threshold: threshold,
                value: currentVal,
                timestamp: firebase_firestore_FieldValue.serverTimestamp()
            }
        });
    }
}


function displayNotificationToast(message, type, notificationId) {
    const container = document.getElementById('notification-toast-container');
    if (!container) {
        console.warn("[Notifications] Toast container not found.");
        return;
    }

    const toast = document.createElement('div');
    toast.className = `notification is-${type === 'critical' ? 'danger' : (type === 'warning' ? 'warning' : 'info')} is-light animated fadeInRight`;
    toast.style.position = 'relative';
    toast.style.marginBottom = '10px';
    toast.style.minWidth = '300px';
    toast.style.maxWidth = '400px';

    toast.innerHTML = `
        <button class="delete" aria-label="delete" onclick="markNotificationAsRead('${notificationId}', this.parentNode)"></button>
        ${message}
    `;

    container.appendChild(toast);

    // Otomatis hapus setelah beberapa detik
    setTimeout(() => {
        if (toast.parentNode === container) { // Pastikan toast masih di DOM
            toast.classList.remove('fadeInRight');
            toast.classList.add('fadeOutRight');
            toast.addEventListener('animationend', () => toast.remove());
        }
    }, 5000); // Tampilkan selama 5 detik

    // Tambahkan ke window scope agar bisa diakses dari onclick
    window.markNotificationAsRead = markNotificationAsRead;
}

// Global function agar bisa diakses dari inline onclick di toast
async function markNotificationAsRead(notificationId, toastElement) {
    try {
        await db.collection('notifications').doc(notificationId).update({ isRead: true });
        console.log(`[Notifications] Notification ${notificationId} marked as read.`);
        if (toastElement && toastElement.parentNode) {
            toastElement.classList.remove('fadeInRight');
            toastElement.classList.add('fadeOutRight');
            toastElement.addEventListener('animationend', () => toastElement.remove());
        }
        updateNotificationBadge(-1); // Kurangi badge setelah dibaca (akan di-refresh oleh listener)
    } catch (error) {
        console.error("[Notifications] Error marking notification as read:", error);
        alert("Gagal menandai notifikasi sebagai sudah dibaca.");
    }
}

async function displayNotificationsDropdown() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Buat atau temukan dropdown container
    let dropdownContent = document.getElementById('notifications-dropdown-content');
    if (!dropdownContent) {
        dropdownContent = document.createElement('div');
        dropdownContent.id = 'notifications-dropdown-content';
        dropdownContent.className = 'dropdown-content';
        dropdownContent.style.position = 'absolute';
        dropdownContent.style.top = '100%';
        dropdownContent.style.right = '0';
        dropdownContent.style.minWidth = '300px';
        dropdownContent.style.zIndex = '100';
        dropdownContent.style.backgroundColor = 'white'; // Agar terlihat di atas elemen lain
        dropdownContent.style.border = '1px solid #dbdbdb';
        dropdownContent.style.borderRadius = '4px';
        dropdownContent.style.boxShadow = '0 2px 3px rgba(10, 10, 10, 0.1), 0 0 0 1px rgba(10, 10, 10, 0.1)';

        const notificationsDropdownToggle = document.getElementById('notifications-dropdown-toggle');
        if (notificationsDropdownToggle) {
            notificationsDropdownToggle.parentNode.appendChild(dropdownContent);
        } else {
            console.error("[Notifications] #notifications-dropdown-toggle not found for dropdown positioning.");
            return;
        }
    }
    
    // Toggle visibilitas
    if (dropdownContent.style.display === 'block') {
        dropdownContent.style.display = 'none';
        return;
    }
    dropdownContent.style.display = 'block';


    dropdownContent.innerHTML = '<p class="dropdown-item">Memuat notifikasi...</p>';

    try {
        const snapshot = await db.collection('notifications')
            .where('toUserId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .limit(10) // Tampilkan 10 notifikasi terbaru (bisa dibaca atau belum)
            .get();

        if (snapshot.empty) {
            dropdownContent.innerHTML = '<p class="dropdown-item">Tidak ada notifikasi.</p>';
            return;
        }

        let notificationsHtml = '';
        snapshot.forEach(doc => {
            const notification = doc.data();
            const createdAtDate = notification.createdAt && typeof notification.createdAt.toDate === 'function' ? notification.createdAt.toDate() : (notification.createdAt ? new Date(notification.createdAt) : null);
            const formattedTime = createdAtDate ? createdAtDate.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
            
            const itemClass = notification.isRead ? 'has-text-grey-light' : 'has-text-weight-bold';
            const actionButton = notification.isRead ? '' : `<button class="button is-small is-primary is-light is-pulled-right" onclick="markNotificationAsRead('${doc.id}', this.closest('.dropdown-item'))">Tandai Dibaca</button>`;

            notificationsHtml += `
                <div class="dropdown-item ${itemClass}">
                    <p class="is-size-7 has-text-grey">${formattedTime}</p>
                    <p>${notification.message}</p>
                    ${actionButton}
                    <hr class="dropdown-divider">
                </div>
            `;
        });
        dropdownContent.innerHTML = notificationsHtml;

    } catch (error) {
        console.error("[Notifications] Error fetching notifications for dropdown:", error);
        dropdownContent.innerHTML = '<p class="dropdown-item has-text-danger">Gagal memuat notifikasi.</p>';
    }
}
