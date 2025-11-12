// js/notifications.js
import { db, auth, firebase_firestore_FieldValue } from './firebase.js';

let machinesUnsubscribe = null;
let notificationsUnsubscribe = null;

const SERVICE_WARNING_THRESHOLD_PERCENT = 90;
const SERVICE_OVERDUE_THRESHOLD_PERCENT = 100;

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

    if (machinesUnsubscribe) {
        machinesUnsubscribe();
        machinesUnsubscribe = null;
    }
    if (notificationsUnsubscribe) {
        notificationsUnsubscribe();
        notificationsUnsubscribe = null;
    }

    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.uid) {
        console.warn("[Notifications] No current user or user UID, skipping notification listener setup.");
        return;
    }

    // --- Listener untuk memantau status servis mesin ---
    machinesUnsubscribe = db.collection('machines').onSnapshot(async (snapshot) => {
        console.log("[Notifications] Machine data changed. Checking service status...");
        snapshot.forEach(doc => {
            const machine = { docId: doc.id, ...doc.data() };
            checkMachineServiceStatus(machine, currentUser.uid);
        });
    }, (error) => {
        console.error("[Notifications] Error listening to machines for service checks:", error);
    });

    // --- Listener untuk menampilkan notifikasi UI (toast dan badge) ---
    // PENTING: Firestore listener secara otomatis akan memperbarui badge saat isRead berubah,
    // jadi kita tidak perlu secara manual mengurangi badge di markNotificationAsRead.
    notificationsUnsubscribe = db.collection('notifications')
        .where('toUserId', '==', currentUser.uid)
        .where('isRead', '==', false)
        .orderBy('createdAt', 'desc')
        .onSnapshot(async (snapshot) => { // Tanpa limit agar mendapatkan hitungan total yang belum dibaca
            const unreadCount = snapshot.size;
            updateNotificationBadge(unreadCount);
            
            // Hanya tampilkan toast untuk notifikasi BARU yang ditambahkan
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const notification = change.doc.data();
                    const notificationId = change.doc.id;
                    // Cek apakah toast untuk notifikasi ini sudah ada, untuk menghindari duplikasi
                    if (!document.getElementById(`toast-${notificationId}`)) {
                        console.log("[Notifications] New unread notification:", notification.message);
                        displayNotificationToast(notification.message, notification.type, notificationId);
                    }
                }
            });
        }, (error) => {
            console.error("[Notifications] Error listening to user notifications:", error);
        });

    const notificationsDropdownToggle = document.getElementById('notifications-dropdown-toggle');
    if (notificationsDropdownToggle) {
        notificationsDropdownToggle.addEventListener('click', async (event) => {
            event.preventDefault();
            await displayNotificationsDropdown();
        });
    }
};

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
    updateNotificationBadge(0);
    const notificationsDropdownContent = document.getElementById('notifications-dropdown-content');
    if (notificationsDropdownContent) {
        notificationsDropdownContent.style.display = 'none';
        notificationsDropdownContent.innerHTML = '';
    }
    const toastContainer = document.getElementById('notification-toast-container');
    if (toastContainer) {
        toastContainer.innerHTML = '';
    }
};


async function checkMachineServiceStatus(machine, currentUserId) {
    const docId = machine.docId;
    const machineIdCustom = machine.machineId;
    const machineName = machine.name;
    const machineCategory = machine.category;

    if (!docId || !currentUserId || !machineIdCustom) {
        console.warn("[Notifications] Missing docId, machineIdCustom, or currentUserId. Skipping service status check for machine:", machine);
        return;
    }

    let currentVal = 0;
    let intervalVal = 0;
    let unit = 'Jam';
    let thresholdField = '';

    if (machineCategory === 'material_handling') {
        currentVal = machine.additionalDetails?.odometerKm || 0;
        intervalVal = machine.additionalDetails?.serviceIntervalKm || 0;
        unit = 'Km';
        thresholdField = 'lastNotifiedOdometerThreshold';
    } else {
        currentVal = machine.currentRuntimeHours || 0;
        intervalVal = machine.serviceIntervalHours || 0;
        unit = 'Jam';
        thresholdField = 'lastNotifiedRuntimeThreshold';
    }

    if (intervalVal <= 0) {
        return;
    }

    const currentPercentage = (currentVal / intervalVal) * 100;
    let notificationType = '';
    let notificationMessage = '';
    let triggeredThreshold = 0;

    if (currentPercentage >= SERVICE_OVERDUE_THRESHOLD_PERCENT) {
        notificationType = 'critical';
        notificationMessage = `Mesin ${machineName} (ID: ${machineIdCustom}) sudah ${unit} operasionalnya melebihi batas servis! (${currentVal}/${intervalVal} ${unit})`;
        triggeredThreshold = SERVICE_OVERDUE_THRESHOLD_PERCENT;
    } else if (currentPercentage >= SERVICE_WARNING_THRESHOLD_PERCENT) {
        notificationType = 'warning';
        notificationMessage = `Mesin ${machineName} (ID: ${machineIdCustom}) akan segera memerlukan servis! (${currentVal}/${intervalVal} ${unit})`;
        triggeredThreshold = SERVICE_WARNING_THRESHOLD_PERCENT;
    }

    if (notificationType) {
        const lastNotifiedThreshold = machine[thresholdField]?.threshold || 0;
        const lastNotifiedValue = machine[thresholdField]?.value || 0;

        if (triggeredThreshold > lastNotifiedThreshold || (triggeredThreshold === lastNotifiedThreshold && currentVal > lastNotifiedValue + (intervalVal * 0.05))) {
            await sendServiceNotification(docId, machineIdCustom, machineName, notificationMessage, notificationType, currentUserId, triggeredThreshold, currentVal, intervalVal, thresholdField);
        }
    }
}

async function sendServiceNotification(docId, machineIdCustom, machineName, message, type, toUserId, threshold, currentVal, intervalVal, thresholdField) {
    if (!toUserId) {
        console.error("[Notifications] sendServiceNotification called with undefined toUserId.");
        return;
    }

    const existingNotificationsSnapshot = await db.collection('notifications')
        .where('machineId', '==', docId)
        .where('type', '==', type)
        .where('isRead', '==', false)
        .where('toUserId', '==', toUserId)
        .limit(1)
        .get();

    if (existingNotificationsSnapshot.empty) {
        const notificationData = {
            machineId: docId,
            machineIdCustom: machineIdCustom,
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
    toast.id = `toast-${notificationId}`; // Memberikan ID unik pada setiap toast
    toast.className = `notification is-${type === 'critical' ? 'danger' : (type === 'warning' ? 'warning' : 'info')} is-light animated fadeInRight`;
    toast.style.position = 'relative';
    toast.style.marginBottom = '10px';
    toast.style.minWidth = '300px';
    toast.style.maxWidth = '400px';

    toast.innerHTML = `
        <button class="delete" aria-label="delete" onclick="window.markNotificationAsRead('${notificationId}', this.parentNode)"></button>
        ${message}
    `;

    container.appendChild(toast);

    setTimeout(() => {
        const currentToast = document.getElementById(`toast-${notificationId}`);
        if (currentToast && currentToast.parentNode === container) { // Pastikan toast masih ada dan di containernya
            currentToast.classList.remove('fadeInRight');
            currentToast.classList.add('fadeOutRight');
            currentToast.addEventListener('animationend', () => currentToast.remove());
        }
    }, 5000);
}

// Global function agar bisa diakses dari inline onclick di toast
window.markNotificationAsRead = async (notificationId, toastElement) => {
    try {
        await db.collection('notifications').doc(notificationId).update({ isRead: true });
        console.log(`[Notifications] Notification ${notificationId} marked as read.`);
        
        // Hapus toast dari DOM
        if (toastElement && toastElement.parentNode) {
toastElement.remove();
            toastElement.classList.remove('fadeInRight');
            toastElement.classList.add('fadeOutRight');
            // Tambahkan listener untuk menghapus setelah animasi selesai
            toastElement.addEventListener('animationend', () => toastElement.remove());
        } else {
            // Jika toastElement tidak valid, coba cari berdasarkan ID
            const specificToast = document.getElementById(`toast-${notificationId}`);
            if (specificToast) {
                specificToast.classList.remove('fadeInRight');
                specificToast.classList.add('fadeOutRight');
                specificToast.addEventListener('animationend', () => specificToast.remove());
            }
        }
        // Badge akan diupdate secara otomatis oleh snapshot listener `notificationsUnsubscribe`
        // karena status isRead berubah di Firestore
    } catch (error) {
        console.error("[Notifications] Error marking notification as read:", error);
        alert("Gagal menandai notifikasi sebagai sudah dibaca.");
    }
};

async function displayNotificationsDropdown() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

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
        dropdownContent.style.backgroundColor = 'white';
        dropdownContent.style.border = '1px solid #dbdbdb';
        dropdownContent.style.borderRadius = '4px';
        dropdownContent.style.boxShadow = '0 2px 3px rgba(10, 10, 10, 0.1), 0 0 0 1px rgba(10, 10, 10, 0.1)';
        dropdownContent.style.maxHeight = '400px';
        dropdownContent.style.overflowY = 'auto';

        const notificationsDropdownToggle = document.getElementById('notifications-dropdown-toggle');
        if (notificationsDropdownToggle && notificationsDropdownToggle.parentNode) {
            notificationsDropdownToggle.parentNode.appendChild(dropdownContent);
        } else {
            console.error("[Notifications] #notifications-dropdown-toggle not found for dropdown positioning.");
            return;
        }
    }
    
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
            .limit(10)
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
            const actionButton = notification.isRead ? '' : `<button class="button is-small is-primary is-light is-pulled-right" onclick="window.markNotificationAsRead('${doc.id}', null)">Tandai Dibaca</button>`;
            // Ganti 'this.closest(.dropdown-item)' dengan null karena kita tidak ingin menghapus item dropdown

            notificationsHtml += `
                <div class="dropdown-item ${itemClass}" id="dropdown-item-${doc.id}">
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
