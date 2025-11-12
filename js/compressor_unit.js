// js/compressor_unit.js
import { db } from './firebase.js';

let kuUnsubscribe = null;

// Fungsi pembantu untuk membuat card status mesin (Sama dengan cooling_tower.js)
const createMachineStatusCard = (machine) => {
    const statusClass = machine.status === 'RUN' ? 'is-success' : 
                        machine.status === 'IDLE' ? 'is-warning' : 
                        'is-danger';
    const statusIcon = machine.status === 'RUN' ? 'fa-running' : 
                       machine.status === 'IDLE' ? 'fa-clock' : 
                       'fa-stop-circle';
    
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

// Fungsi untuk me-render daftar mesin Kompresor Unit
const renderMachineList = (container, machines) => {
    if (machines.length === 0) {
        container.innerHTML = `<p class="column is-full notification is-warning">Tidak ada data mesin Kompresor Unit.</p>`;
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

// Fungsi utama untuk me-render halaman Kompresor Unit
export const renderCompressorUnitPage = (containerElement) => {
    containerElement.innerHTML = `
        <h1 class="title">Status Mesin Kompresor Unit</h1>
        <div class="columns is-multiline" id="ku-status-list">
            <div class="column is-full"><progress class="progress is-small is-info" max="100">Memuat...</progress></div>
        </div>
    `;

    // Pasang listener real-time
    const kuListContainer = document.getElementById('ku-status-list');
    if (kuUnsubscribe) kuUnsubscribe(); // Hapus listener lama jika ada
    
    // Listener untuk koleksi 'machines' dengan filter kategori
    kuUnsubscribe = db.collection('machines')
        .where('category', '==', 'kompresor_unit')
        .onSnapshot(snapshot => {
            const machines = [];
            snapshot.forEach(doc => machines.push({ docId: doc.id, ...doc.data() }));
            renderMachineList(kuListContainer, machines);
        }, error => {
            console.error("[KompresorUnit] Error fetching data:", error);
            kuListContainer.innerHTML = `<p class="column is-full notification is-danger">Gagal memuat data Kompresor Unit: ${error.message}</p>`;
        });
};

// Fungsi cleanup untuk menghapus listener saat meninggalkan halaman
export const cleanupCompressorUnitPage = () => {
    if (kuUnsubscribe) {
        kuUnsubscribe();
        kuUnsubscribe = null;
        console.log("[KompresorUnit] Cleanup complete.");
    }
};