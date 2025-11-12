// js/material_handling.js
import { db, auth, firebase_firestore_FieldValue } from './firebase.js';

let materialHandlingReportsUnsubscribe = null;

export const renderMaterialHandlingPage = async (containerElement) => {
    containerElement.innerHTML = `
        <h1 class="title">Log Laporan Material Handling</h1>
        <div class="box">
            <h2 class="subtitle">Daftar Mesin Material Handling</h2>
            <div class="table-container">
                <table class="table is-striped is-hoverable is-fullwidth">
                    <thead>
                        <tr>
                            <th>ID Mesin</th>
                            <th>Nama</th>
                            <th>Lokasi</th>
                            <th>Odometer (Km)</th>
                            <th>Servis Interval (Km)</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody id="material-handling-machines-list">
                        <!-- Data mesin material handling akan dimuat di sini -->
                    </tbody>
                </table>
            </div>
        </div>

        <div class="box mt-4">
            <h2 class="subtitle">Riwayat Laporan Pekerjaan Material Handling</h2>
            <div class="table-container">
                <table class="table is-striped is-hoverable is-fullwidth">
                    <thead>
                        <tr>
                            <th>Waktu Lapor</th>
                            <th>Mesin</th>
                            <th>Teknisi</th>
                            <th>Tipe</th>
                            <th>Downtime (menit)</th>
                            <th>Deskripsi</th>
                        </tr>
                    </thead>
                    <tbody id="material-handling-reports-list">
                        <!-- Riwayat laporan material handling akan dimuat di sini -->
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Muat data mesin Material Handling
    await fetchMaterialHandlingMachines();
    // Muat data laporan Material Handling
    setupMaterialHandlingReportsListener();
};

async function fetchMaterialHandlingMachines() {
    const machinesListBody = document.getElementById('material-handling-machines-list');
    if (!machinesListBody) return;

    try {
        const snapshot = await db.collection('machines')
                                 .where('category', '==', 'material_handling')
                                 .orderBy('name', 'asc')
                                 .get();

        if (snapshot.empty) {
            machinesListBody.innerHTML = `<tr><td colspan="6" class="has-text-centered">Tidak ada data mesin Material Handling.</td></tr>`;
            return;
        }

        machinesListBody.innerHTML = '';
        snapshot.forEach(doc => {
            const machine = doc.data();
            const row = machinesListBody.insertRow();
            row.insertCell(0).textContent = machine.machineId;
            row.insertCell(1).textContent = machine.name;
            row.insertCell(2).textContent = machine.location;
            row.insertCell(3).textContent = (machine.additionalDetails?.odometerKm || '0') + ' Km';
            row.insertCell(4).textContent = (machine.additionalDetails?.serviceIntervalKm || '0') + ' Km';
            row.insertCell(5).textContent = machine.status;
        });

    } catch (error) {
        console.error("[MaterialHandling] Error fetching machines:", error);
        machinesListBody.innerHTML = `<tr><td colspan="6" class="has-text-danger">Gagal memuat data mesin: ${error.message}</td></tr>`;
    }
}

function setupMaterialHandlingReportsListener() {
    const reportsListBody = document.getElementById('material-handling-reports-list');
    if (!reportsListBody) return;

    // Hentikan listener sebelumnya jika ada
    if (materialHandlingReportsUnsubscribe) {
        materialHandlingReportsUnsubscribe();
    }

    materialHandlingReportsUnsubscribe = db.collection('log_laporan')
        .where('machineCategory', '==', 'material_handling')
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            if (snapshot.empty) {
                reportsListBody.innerHTML = `<tr><td colspan="6" class="has-text-centered">Tidak ada laporan untuk mesin Material Handling.</td></tr>`;
                return;
            }

            reportsListBody.innerHTML = '';
            snapshot.forEach(doc => {
                const report = doc.data();
                const row = reportsListBody.insertRow();
                const createdAtDate = report.createdAt && typeof report.createdAt.toDate === 'function' ? report.createdAt.toDate() : (report.createdAt ? new Date(report.createdAt) : null);
                row.insertCell(0).textContent = createdAtDate ? createdAtDate.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
                row.insertCell(1).textContent = `${report.machineName} (${report.machineId})`;
                row.insertCell(2).textContent = report.technicianName;
                row.insertCell(3).textContent = report.type;
                row.insertCell(4).textContent = report.downtimeMinutes;
                const descCell = row.insertCell(5);
                descCell.textContent = report.description.substring(0, 50) + (report.description.length > 50 ? '...' : '');
                descCell.title = report.description;
            });
        }, (error) => {
            console.error("[MaterialHandling] Error listening to reports:", error);
            reportsListBody.innerHTML = `<tr><td colspan="6" class="has-text-danger">Gagal memuat laporan: ${error.message}</td></tr>`;
        });
}
