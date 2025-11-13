// js/compressor_unit.js
import { db } from './firebase.js';

let machinesUnsubscribe = null; // Untuk listener mesin Kompresor Unit

export const renderCompressorUnitPage = async (containerElement) => {
    containerElement.innerHTML = `
        <h1 class="title">Status & Mesin Kompresor Unit</h1>
        
        <div class="columns is-multiline mb-4">
            <div class="column is-one-quarter">
                <div class="box">
                    <p class="title is-5">Kompresor Unit</p>
                    <p class="subtitle is-7 has-text-grey">Status Mesin</p>
                    <div class="level is-mobile mt-3">
                        <div class="level-item has-text-centered">
                            <div>
                                <span class="status-indicator is-success"></span>
                                <p class="heading">RUN</p>
                                <p class="title is-6" id="ku-run-count">0</p>
                            </div>
                        </div>
                        <div class="level-item has-text-centered">
                            <div>
                                <span class="status-indicator is-warning"></span>
                                <p class="heading">IDLE</p>
                                <p class="title is-6" id="ku-idle-count">0</p>
                            </div>
                        </div>
                        <div class="level-item has-text-centered">
                            <div>
                                <span class="status-indicator is-danger"></span>
                                <p class="heading">STOP</p>
                                <p class="title is-6" id="ku-stop-count">0</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Anda bisa tambahkan card lain di sini jika ingin ringkasan KPI khusus KU -->
        </div>

        <div class="box mt-4">
            <h2 class="subtitle">Daftar Mesin Kompresor Unit</h2>
            <div class="table-container">
                <table class="table is-striped is-hoverable is-fullwidth">
                    <thead>
                        <tr>
                            <th>ID Mesin</th>
                            <th>Nama</th>
                            <th>Lokasi</th>
                            <th>Status</th>
                            <th>Jam Operasional</th>
                            <th>Interval Servis (Jam)</th>
                            <th>Tekanan (Bar)</th>
                            <th>Temperatur (°C)</th>
                        </tr>
                    </thead>
                    <tbody id="ku-machines-list">
                        <!-- Data mesin Kompresor Unit akan dimuat di sini -->
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Ambil dan tampilkan status mesin dan daftar mesin Kompresor Unit
    setupCompressorUnitMachinesListener();
};

function setupCompressorUnitMachinesListener() {
    const machinesListBody = document.getElementById('ku-machines-list');
    if (!machinesListBody) return;

    if (machinesUnsubscribe) {
        machinesUnsubscribe();
    }

    const machineStatusCounts = { RUN: 0, IDLE: 0, STOP: 0 };

    machinesUnsubscribe = db.collection('machines')
        .where('category', '==', 'kompresor_unit')
        .orderBy('name', 'asc')
        .onSnapshot((snapshot) => {
            machinesListBody.innerHTML = '';
            machineStatusCounts.RUN = 0;
            machineStatusCounts.IDLE = 0;
            machineStatusCounts.STOP = 0;

            if (snapshot.empty) {
                machinesListBody.innerHTML = `<tr><td colspan="8" class="has-text-centered">Tidak ada data mesin Kompresor Unit.</td></tr>`;
            } else {
                snapshot.forEach(doc => {
                    const machine = doc.data();
                    const row = machinesListBody.insertRow();
                    row.insertCell(0).textContent = machine.machineId;
                    row.insertCell(1).textContent = machine.name;
                    row.insertCell(2).textContent = machine.location;
                    row.insertCell(3).textContent = machine.status;
                    row.insertCell(4).textContent = (machine.currentRuntimeHours || 0) + ' Jam';
                    row.insertCell(5).textContent = (machine.serviceIntervalHours || 0) + ' Jam';
                    row.insertCell(6).textContent = (machine.additionalDetails?.pressure || '-') + ' Bar';
                    row.insertCell(7).textContent = (machine.additionalDetails?.temperature || '-') + ' °C';

                    if (machineStatusCounts[machine.status]) {
                        machineStatusCounts[machine.status]++;
                    }
                });
            }

            // Update status counts in the cards
            document.getElementById('ku-run-count').innerText = machineStatusCounts.RUN;
            document.getElementById('ku-idle-count').innerText = machineStatusCounts.IDLE;
            document.getElementById('ku-stop-count').innerText = machineStatusCounts.STOP;

        }, (error) => {
            console.error("[CompressorUnit] Error listening to machines:", error);
            machinesListBody.innerHTML = `<tr><td colspan="8" class="has-text-danger">Gagal memuat data mesin Kompresor Unit: ${error.message}</td></tr>`;
        });
}

// Tambahkan fungsi cleanup jika diperlukan oleh router (saat logout, dll.)
export const cleanupCompressorUnitListeners = () => {
    if (machinesUnsubscribe) {
        machinesUnsubscribe();
        machinesUnsubscribe = null;
    }
};
