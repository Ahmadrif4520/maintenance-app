// js/compressor_unit.js
import { db } from './firebase.js';
import { showCustomConfirm } from './ui_helpers.js'; // Impor modal konfirmasi kustom

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
                            <th>Mulai RUN</th>
                            <th>Interval Servis (Jam)</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="ku-machines-list">
                        <!-- Data mesin Kompresor Unit akan dimuat di sini -->
                    </tbody>
                </table>
            </div>
        </div>
    `;

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
                    const machine = { docId: doc.id, ...doc.data() };
                    const row = machinesListBody.insertRow();

                    const currentRuntimeHours = machine.currentRuntimeHours || 0;
                    const serviceIntervalHours = machine.serviceIntervalHours || 0;
                    let displayRuntimeHours = currentRuntimeHours;
                    let lastRunStartTimeFormatted = 'N/A';

                    if (machine.status === 'RUN' && machine.lastRunStartTime) {
                        const now = new Date();
                        const lastRunTime = machine.lastRunStartTime.toDate();
                        const runningDurationMs = now.getTime() - lastRunTime.getTime();
                        const runningDurationHours = runningDurationMs / (1000 * 60 * 60);
                        displayRuntimeHours = currentRuntimeHours + runningDurationHours;
                        lastRunStartTimeFormatted = lastRunTime.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
                    }

                    row.insertCell(0).textContent = machine.machineId;
                    row.insertCell(1).textContent = machine.name;
                    row.insertCell(2).textContent = machine.location;

                    const statusCell = row.insertCell(3);
                    const statusSelect = document.createElement('div');
                    statusSelect.className = 'select is-small';
                    statusSelect.innerHTML = `
                        <select data-machine-id="${machine.docId}" class="machine-status-selector">
                            <option value="RUN" ${machine.status === 'RUN' ? 'selected' : ''}>RUN</option>
                            <option value="IDLE" ${machine.status === 'IDLE' ? 'selected' : ''}>IDLE</option>
                            <option value="STOP" ${machine.status === 'STOP' ? 'selected' : ''}>STOP</option>
                        </select>
                    `;
                    statusSelect.querySelector('select').addEventListener('change', (e) => {
                        updateMachineStatus(e.target.dataset.machineId, e.target.value, machine);
                    });
                    statusCell.appendChild(statusSelect);
                    
                    row.insertCell(4).textContent = displayRuntimeHours.toFixed(2) + ' Jam';
                    row.insertCell(5).textContent = lastRunStartTimeFormatted;
                    row.insertCell(6).textContent = serviceIntervalHours + ' Jam';

                    const actionsCell = row.insertCell(7);
                    const resetButton = document.createElement('button');
                    resetButton.className = 'button is-small is-warning is-light mr-2';
                    resetButton.innerHTML = `<span class="icon is-small"><i class="fas fa-redo"></i></span><span>Reset Jam</span>`;
                    
                    resetButton.addEventListener('click', () => {
                        showCustomConfirm(`Apakah Anda yakin ingin mereset jam operasional mesin ${machine.name}? Aksi ini tidak dapat dibatalkan.`, () => {
                            resetMachineRuntimeConfirmed(machine.docId, machine.name);
                        });
                    });

                    actionsCell.appendChild(resetButton);

                    if (machineStatusCounts[machine.status]) {
                        machineStatusCounts[machine.status]++;
                    }
                });
            }

            document.getElementById('ku-run-count').innerText = machineStatusCounts.RUN;
            document.getElementById('ku-idle-count').innerText = machineStatusCounts.IDLE;
            document.getElementById('ku-stop-count').innerText = machineStatusCounts.STOP;

        }, (error) => {
            console.error("[CompressorUnit] Error listening to machines:", error);
            machinesListBody.innerHTML = `<tr><td colspan="8" class="has-text-danger">Gagal memuat data mesin Kompresor Unit: ${error.message}</td></tr>`;
        });
}

async function updateMachineStatus(docId, newStatus, currentMachineData) {
    try {
        let updateData = {
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (newStatus === 'RUN') {
            if (currentMachineData.status !== 'RUN') {
                updateData.lastRunStartTime = firebase.firestore.FieldValue.serverTimestamp();
            }
        } 
        else if (currentMachineData.status === 'RUN' && currentMachineData.lastRunStartTime) {
            const now = new Date();
            const lastRunTime = currentMachineData.lastRunStartTime.toDate();
            const runningDurationMs = now.getTime() - lastRunTime.getTime();
            const runningDurationHours = runningDurationMs / (1000 * 60 * 60);

            updateData.currentRuntimeHours = (currentMachineData.currentRuntimeHours || 0) + runningDurationHours;
            updateData.lastRunStartTime = null;
        } else {
             updateData.lastRunStartTime = null;
        }

        await db.collection('machines').doc(docId).update(updateData);
        console.log(`[CompressorUnit] Machine ${docId} status updated to ${newStatus}.`);
    } catch (error) {
        console.error("[CompressorUnit] Error updating machine status:", error);
        alert(`Gagal memperbarui status mesin: ${error.message}`);
    }
}

async function resetMachineRuntimeConfirmed(docId, machineName) {
    try {
        await db.collection('machines').doc(docId).update({
            currentRuntimeHours: 0,
            lastRunStartTime: null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert(`Jam operasional mesin ${machineName} berhasil direset.`);
    } catch (error) {
        console.error("[CompressorUnit] Error resetting machine runtime:", error);
        alert(`Gagal mereset jam operasional mesin: ${error.message}`);
    }
}

export const cleanupCompressorUnitListeners = () => {
    if (machinesUnsubscribe) {
        machinesUnsubscribe();
        machinesUnsubscribe = null;
    }
};
