// js/cooling_tower.js
import { db } from './firebase.js';

let ctUnsubscribe = null;

// Fungsi pembantu untuk membuat card status mesin
const createMachineStatusCard = (machine) => {
    const statusClass = machine.status === 'RUN' ? 'is-success' : 
                        machine.status === 'IDLE' ? 'is-warning' : 
                        'is-danger';
    const statusIcon = machine.status === 'RUN' ? 'fa-running' : 
                       machine.status === 'IDLE' ? 'fa-clock' : 
                       'fa-stop-circle';
    
    // Anda bisa menambahkan link navigasi ke detail mesin jika diperlukan
    const detailLink = `/machines/${machine.docId}`;

    return `
        <div class="column is-one-quarter">
            <div class="box notification ${statusClass} is-light">
                <p class="title is-5">${machine.machineId}</p>
                <p class="subtitle is-6">${machine.name}</p>
                <hr class="dropdown-divider">
                <div class="content">
                    <p>
                        <span class="icon-text">
                            <span class="icon">
                                <i class="fas ${statusIcon}"></i>
                            </span>
                            <span class="has-text-weight-bold">${machine.status}</span>
                        </span>
                    </p>
                    <p class="is-size-7">Lokasi: ${machine.location || 'N/A'}</p>
                    <a class="button is-small is-info is-outlined mt-2" onclick="window.navigateTo('${detailLink}')">Lihat Detail</a>
                </div>
            </div>
        </div>
    `;
};

// Fungsi untuk me-render daftar mesin Cooling Tower
const renderMachineList = (container, machines) => {
    if (machines.length === 0) {
        container.innerHTML = `<p class="column is-full notification is-warning">Tidak ada data mesin Cooling Tower.</p>`;
        return;
    }

    // Sort mesin berdasarkan Machine ID
    machines.sort((a, b) => a.machineId.localeCompare(b.machineId));
    
    let html = '';
    machines.forEach(machine => {
        html += createMachineStatusCard(machine);
    });
    
    container.innerHTML = html;
};

// Fungsi utama untuk me-render halaman Cooling Tower
export const renderCoolingTowerPage = (containerElement) => {
    containerElement.innerHTML = `
        <h1 class="title">Status Mesin Cooling Tower</h1>
        <div class="columns is-multiline" id="ct-status-list">
            <div class="column is-full"><progress class="progress is-small is-info" max="100">Memuat...</progress></div>
        </div>
    `;

    // Pasang listener real-time
    const ctListContainer = document.getElementById('ct-status-list');
    if (ctUnsubscribe) ctUnsubscribe(); // Hapus listener lama jika ada
    
    // Listener untuk koleksi 'machines' dengan filter kategori
    ctUnsubscribe = db.collection('machines')
        .where('category', '==', 'cooling_tower')
        .onSnapshot(snapshot => {
            const machines = [];
            snapshot.forEach(doc => machines.push({ docId: doc.id, ...doc.data() }));
            renderMachineList(ctListContainer, machines);
        }, error => {
            console.error("[CoolingTower] Error fetching data:", error);
            ctListContainer.innerHTML = `<p class="column is-full notification is-danger">Gagal memuat data Cooling Tower: ${error.message}</p>`;
        });
};

// Fungsi cleanup untuk menghapus listener saat meninggalkan halaman
export const cleanupCoolingTowerPage = () => {
    if (ctUnsubscribe) {
        ctUnsubscribe();
        ctUnsubscribe = null;
        console.log("[CoolingTower] Cleanup complete.");
    }
};