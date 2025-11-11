// js/machines.js
import { db, auth, firebase_firestore_FieldValue } from './firebase.js';
import { navigateTo } from './router.js'; // Untuk navigasi ke detail mesin

// Variabel untuk melacak apakah kita sedang dalam mode edit
let editingMachineId = null;

export const renderMachinesPage = async (containerElement) => {
    containerElement.innerHTML = `
        <h1 class="title">Master Mesin</h1>
        <div class="box">
            <h2 class="subtitle">Tambah / Edit Data Mesin</h2>
            <form id="machine-form">
                <input type="hidden" id="machine-id-hidden">

                <div class="field">
                    <label class="label">ID Mesin Unik</label>
                    <div class="control">
                        <input class="input" type="text" id="machine-machine-id" placeholder="Contoh: CT001, CP002" required>
                    </div>
                    <p class="help">ID ini harus unik dan tidak dapat diubah setelah disimpan.</p>
                </div>

                <div class="field">
                    <label class="label">Nama Mesin</label>
                    <div class="control">
                        <input class="input" type="text" id="machine-name" placeholder="Contoh: Cooling Tower A" required>
                    </div>
                </div>

                <div class="field">
                    <label class="label">Kategori Mesin</label>
                    <div class="control">
                        <div class="select is-fullwidth">
                            <select id="machine-category" required>
                                <option value="">Pilih Kategori</option>
<option value="general">Mesin General</option>
                                <option value="cooling_tower">Cooling Tower</option>
                                <option value="kompresor_unit">Kompresor Unit</option>
                                <option value="material_handling">Material Handling</option>
                                <!-- Tambahkan kategori lain jika perlu -->
                            </select>
                        </div>
                    </div>
                </div>

                <div class="field">
                    <label class="label">Lokasi</label>
                    <div class="control">
                        <input class="input" type="text" id="machine-location" placeholder="Contoh: Lantai 1, Area Produksi" required>
                    </div>
                </div>

                <div class="field">
                    <label class="label">Status Operasional Awal</label>
                    <div class="control">
                        <div class="select is-fullwidth">
                            <select id="machine-status" required>
                                <option value="RUN">RUN</option>
                                <option value="IDLE">IDLE</option>
                                <option value="STOP">STOP</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="field">
                    <label class="label">Jam Operasional Saat Ini (Opsional)</label>
                    <div class="control">
                        <input class="input" type="number" id="machine-current-runtime-hours" min="0" value="0">
                    </div>
                    <p class="help">Digunakan untuk notifikasi servis. Isi 0 jika tidak relevan.</p>
                </div>

                <div class="field">
                    <label class="label">Interval Servis (Jam, Opsional)</label>
                    <div class="control">
                        <input class="input" type="number" id="machine-service-interval-hours" min="0" value="0">
                    </div>
                    <p class="help">Interval servis dalam jam operasional. Isi 0 jika tidak relevan.</p>
                </div>

                <div class="field" id="additional-details-field">
                    <!-- Dynamic fields for category-specific details will be inserted here -->
                </div>

                <div class="field">
                    <div class="control">
                        <button class="button is-primary" type="submit" id="submit-machine-button">Simpan Mesin</button>
                        <button class="button is-link is-light" type="button" id="cancel-edit-machine-button" style="display:none;">Batal Edit</button>
                    </div>
                </div>
            </form>
        </div>

        <div class="box mt-4">
            <h2 class="subtitle">Daftar Mesin</h2>
            <div class="table-container">
                <table class="table is-striped is-hoverable is-fullwidth">
                    <thead>
                        <tr>
                            <th>ID Mesin</th>
                            <th>Nama</th>
                            <th>Kategori</th>
                            <th>Lokasi</th>
                            <th>Status</th>
                            <th>Runtime (Jam)</th>
                            <th>Servis (Jam)</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="machines-list">
                        <!-- Data mesin akan dimuat di sini -->
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Inisialisasi event listener dan muat data
    setupMachinesListener();
    addMachinesEventListeners();
};

async function setupMachinesListener() {
    const machinesListBody = document.getElementById('machines-list');
    if (!machinesListBody) {
        console.warn("[Machines] machines-list element not found.");
        return;
    }

    db.collection('machines').orderBy('name', 'asc').onSnapshot(async (snapshot) => {
        machinesListBody.innerHTML = ''; // Bersihkan list sebelumnya
        const currentUser = auth.currentUser;
        let currentUserRole = 'technician'; // Default
        if (currentUser) {
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (userDoc.exists) {
                currentUserRole = userDoc.data().role;
            }
        }

        snapshot.forEach(doc => {
            const machine = doc.data();
            const row = machinesListBody.insertRow();

            row.insertCell(0).textContent = machine.machineId;
            row.insertCell(1).textContent = machine.name;
            row.insertCell(2).textContent = machine.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // Format kategori
            row.insertCell(3).textContent = machine.location;
            row.insertCell(4).textContent = machine.status;
            row.insertCell(5).textContent = machine.currentRuntimeHours || '0';
            row.insertCell(6).textContent = machine.serviceIntervalHours || '0';

            const actionsCell = row.insertCell(7);
            actionsCell.classList.add('has-text-right');

            const viewButton = document.createElement('button');
            viewButton.classList.add('button', 'is-small', 'is-info', 'is-light', 'mr-2');
            viewButton.innerHTML = `<span class="icon is-small"><i class="fas fa-eye"></i></span><span>Lihat</span>`;
            viewButton.onclick = () => navigateTo(`/machines/detail?id=${machine.machineId}`);
            actionsCell.appendChild(viewButton);

            // Hanya admin yang bisa edit/hapus mesin
            if (currentUserRole === 'admin') {
                const editButton = document.createElement('button');
                editButton.classList.add('button', 'is-small', 'is-info', 'mr-2');
                editButton.innerHTML = `<span class="icon is-small"><i class="fas fa-edit"></i></span><span>Edit</span>`;
                editButton.onclick = () => editMachine(doc.id, machine);
                actionsCell.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.classList.add('button', 'is-small', 'is-danger');
                deleteButton.innerHTML = `<span class="icon is-small"><i class="fas fa-trash"></i></span><span>Hapus</span>`;
                deleteButton.onclick = () => deleteMachine(doc.id);
                actionsCell.appendChild(deleteButton);
            }
        });
    }, (error) => {
        console.error("[Machines] Error listening to machines:", error);
        machinesListBody.innerHTML = `<tr><td colspan="8" class="has-text-danger">Gagal memuat data mesin: ${error.message}</td></tr>`;
    });
}

function addMachinesEventListeners() {
    document.getElementById('machine-form').addEventListener('submit', handleMachineSubmission);
    document.getElementById('cancel-edit-machine-button').addEventListener('click', resetForm);
    // Tambahkan event listener untuk perubahan kategori jika ada dynamic fields
    document.getElementById('machine-category').addEventListener('change', renderAdditionalDetailsFields);
}

async function handleMachineSubmission(event) {
    event.preventDefault();

    const machineId = document.getElementById('machine-machine-id').value.trim();
    const name = document.getElementById('machine-name').value.trim();
    const category = document.getElementById('machine-category').value;
    const location = document.getElementById('machine-location').value.trim();
    const status = document.getElementById('machine-status').value;
    const currentRuntimeHours = parseInt(document.getElementById('machine-current-runtime-hours').value) || 0;
    const serviceIntervalHours = parseInt(document.getElementById('machine-service-interval-hours').value) || 0;

    if (!machineId || !name || !category || !location || !status) {
        alert("Semua field wajib diisi kecuali Jam Operasional dan Interval Servis.");
        return;
    }

    const machineData = {
        machineId: machineId,
        name: name,
        category: category,
        location: location,
        status: status,
        currentRuntimeHours: currentRuntimeHours,
        serviceIntervalHours: serviceIntervalHours,
        // Untuk tambahan field spesifik kategori, ambil dari form
        additionalDetails: getAdditionalDetailsFromForm(category)
    };

    try {
        if (editingMachineId) {
            // Mode edit
            // Karena machineId tidak boleh diubah, kita update berdasarkan ID dokumen Firestore
            // dan pastikan tidak mengubah machineId di dokumen
            delete machineData.machineId; // Pastikan machineId tidak diupdate
            await db.collection('machines').doc(editingMachineId).update({
                ...machineData,
                updatedAt: firebase_firestore_FieldValue.serverTimestamp()
            });
            alert("Data mesin berhasil diperbarui!");
        } else {
            // Mode tambah baru
            // Periksa apakah machineId sudah ada
            const existingMachine = await db.collection('machines').where('machineId', '==', machineId).get();
            if (!existingMachine.empty) {
                alert(`ID Mesin "${machineId}" sudah ada. Mohon gunakan ID lain.`);
                return;
            }
            await db.collection('machines').add({
                ...machineData,
                createdAt: firebase_firestore_FieldValue.serverTimestamp()
            });
            alert("Mesin berhasil ditambahkan!");
        }
        resetForm(); // Reset form setelah sukses
    } catch (error) {
        console.error("[Machines] Error saving machine:", error);
        alert(`Gagal menyimpan mesin: ${error.message}. Pastikan Anda memiliki izin yang cukup.`);
    }
}

function editMachine(docId, machine) {
    editingMachineId = docId;
    document.getElementById('machine-id-hidden').value = docId; // Simpan ID dokumen Firestore
    document.getElementById('machine-machine-id').value = machine.machineId;
    document.getElementById('machine-machine-id').readOnly = true; // Nonaktifkan edit ID Mesin Unik
    document.getElementById('machine-name').value = machine.name;
    document.getElementById('machine-category').value = machine.category;
    document.getElementById('machine-location').value = machine.location;
    document.getElementById('machine-status').value = machine.status;
    document.getElementById('machine-current-runtime-hours').value = machine.currentRuntimeHours || 0;
    document.getElementById('machine-service-interval-hours').value = machine.serviceIntervalHours || 0;

    // Render dan isi field tambahan spesifik kategori
    renderAdditionalDetailsFields(null, machine.additionalDetails);

    document.getElementById('submit-machine-button').textContent = 'Update Mesin';
    document.getElementById('cancel-edit-machine-button').style.display = 'inline-block';
    // Scroll ke atas form
    document.getElementById('machine-form').scrollIntoView({ behavior: 'smooth' });
}

async function deleteMachine(docId) {
    if (!confirm("Apakah Anda yakin ingin menghapus mesin ini? Ini akan juga menghapus semua laporan yang terkait dengan ID Mesin ini jika tidak ada validasi. (TIDAK disarankan)")) {
        return;
    }

    try {
        await db.collection('machines').doc(docId).delete();
        alert("Mesin berhasil dihapus!");
    } catch (error) {
        console.error("[Machines] Error deleting machine:", error);
        alert(`Gagal menghapus mesin: ${error.message}. Pastikan Anda memiliki izin yang cukup.`);
    }
}

function resetForm() {
    editingMachineId = null;
    document.getElementById('machine-form').reset();
    document.getElementById('machine-machine-id').readOnly = false; // Aktifkan kembali ID Mesin Unik
    document.getElementById('submit-machine-button').textContent = 'Simpan Mesin';
    document.getElementById('cancel-edit-machine-button').style.display = 'none';
    document.getElementById('machine-current-runtime-hours').value = 0;
    document.getElementById('machine-service-interval-hours').value = 0;
    document.getElementById('additional-details-field').innerHTML = ''; // Bersihkan dynamic fields
}

// --- Fungsi untuk detail spesifik kategori ---
function renderAdditionalDetailsFields(event, existingDetails = {}) {
    const category = event ? event.target.value : document.getElementById('machine-category').value;
    const additionalDetailsField = document.getElementById('additional-details-field');
    additionalDetailsField.innerHTML = ''; // Bersihkan field sebelumnya

    let fieldsHtml = '';
    switch (category) {
        case 'cooling_tower':
            fieldsHtml = `
                <div class="field">
                    <label class="label">Kapasitas Air (Liter)</label>
                    <div class="control">
                        <input class="input" type="number" id="detail-water-capacity" min="0" value="${existingDetails.waterCapacity || ''}">
                    </div>
                </div>
                <div class="field">
                    <label class="label">Tipe Pompa</label>
                    <div class="control">
                        <input class="input" type="text" id="detail-pump-type" value="${existingDetails.pumpType || ''}">
                    </div>
                </div>
            `;
            break;
        case 'kompresor_unit':
            fieldsHtml = `
                <div class="field">
                    <label class="label">Tekanan (Bar)</label>
                    <div class="control">
                        <input class="input" type="number" step="0.1" id="detail-pressure" value="${existingDetails.pressure || ''}">
                    </div>
                </div>
                <div class="field">
                    <label class="label">Temperatur (°C)</label>
                    <div class="control">
                        <input class="input" type="number" step="0.1" id="detail-temperature" value="${existingDetails.temperature || ''}">
                    </div>
                </div>
            `;
            break;
        case 'material_handling':
            fieldsHtml = `
                <div class="field">
                    <label class="label">Tipe Penggerak</label>
                    <div class="control">
                        <input class="input" type="text" id="detail-drive-type" value="${existingDetails.driveType || ''}">
                    </div>
                </div>
            `;
            break;
        default:
            // Tidak ada field tambahan
            break;
    }
    additionalDetailsField.innerHTML = fieldsHtml;
}

function getAdditionalDetailsFromForm(category) {
    const details = {};
    switch (category) {
        case 'cooling_tower':
            details.waterCapacity = parseInt(document.getElementById('detail-water-capacity')?.value) || null;
            details.pumpType = document.getElementById('detail-pump-type')?.value || null;
            break;
        case 'kompresor_unit':
            details.pressure = parseFloat(document.getElementById('detail-pressure')?.value) || null;
            details.temperature = parseFloat(document.getElementById('detail-temperature')?.value) || null;
            break;
        case 'material_handling':
            details.driveType = document.getElementById('detail-drive-type')?.value || null;
            break;
    }
    return details;
}

// --- Fungsi untuk halaman detail mesin ---
export const renderMachineDetailPage = async (containerElement, machineId) => {
    containerElement.innerHTML = `
        <h1 class="title">Detail Mesin: ${machineId}</h1>
        <div class="box" id="machine-detail-content">
            <progress class="progress is-small is-info mt-4" max="100">Memuat detail mesin...</progress>
        </div>
        <div class="box mt-4">
            <h2 class="subtitle">Riwayat Laporan Pekerjaan</h2>
            <div class="table-container">
                <table class="table is-striped is-hoverable is-fullwidth">
                    <thead>
                        <tr>
                            <th>Waktu Lapor</th>
                            <th>Tipe</th>
                            <th>Teknisi</th>
                            <th>Downtime (menit)</th>
                            <th>Deskripsi</th>
                        </tr>
                    </thead>
                    <tbody id="machine-reports-list">
                        <!-- Laporan terkait mesin ini akan dimuat di sini -->
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const detailContentDiv = document.getElementById('machine-detail-content');
    const machineReportsListBody = document.getElementById('machine-reports-list');

    try {
        const snapshot = await db.collection('machines').where('machineId', '==', machineId).limit(1).get();
        if (snapshot.empty) {
            detailContentDiv.innerHTML = `<p class="notification is-danger">Mesin dengan ID ${machineId} tidak ditemukan.</p>`;
            machineReportsListBody.innerHTML = `<tr><td colspan="5">Tidak ada laporan terkait.</td></tr>`;
            return;
        }

        const machineDoc = snapshot.docs[0];
        const machine = machineDoc.data();

        let additionalDetailsHtml = '';
        if (machine.additionalDetails) {
            additionalDetailsHtml = `
                <p><strong>Detail Tambahan:</strong></p>
                <ul>
            `;
            for (const key in machine.additionalDetails) {
                additionalDetailsHtml += `<li><strong>${key.replace(/\b\w/g, l => l.toUpperCase())}:</strong> ${machine.additionalDetails[key]}</li>`;
            }
            additionalDetailsHtml += `</ul>`;
        }


        detailContentDiv.innerHTML = `
            <p><strong>ID Mesin:</strong> ${machine.machineId}</p>
            <p><strong>Nama Mesin:</strong> ${machine.name}</p>
            <p><strong>Kategori:</strong> ${machine.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
            <p><strong>Lokasi:</strong> ${machine.location}</p>
            <p><strong>Status Saat Ini:</strong> ${machine.status}</p>
            <p><strong>Jam Operasional:</strong> ${machine.currentRuntimeHours || 0} jam</p>
            <p><strong>Interval Servis:</strong> ${machine.serviceIntervalHours || 0} jam</p>
            ${additionalDetailsHtml}
            <button class="button is-link mt-4" onclick="window.history.back()">Kembali</button>
        `;

        // Muat riwayat laporan
        const reportsSnapshot = await db.collection('log_laporan')
                                        .where('machineId', '==', machineId)
                                        .orderBy('createdAt', 'desc')
                                        .get();
        if (reportsSnapshot.empty) {
            machineReportsListBody.innerHTML = `<tr><td colspan="5">Tidak ada riwayat laporan untuk mesin ini.</td></tr>`;
        } else {
            machineReportsListBody.innerHTML = '';
            reportsSnapshot.forEach(reportDoc => {
                const report = reportDoc.data();
                const row = machineReportsListBody.insertRow();
                const createdAtDate = report.createdAt && typeof report.createdAt.toDate === 'function' ? report.createdAt.toDate() : (report.createdAt ? new Date(report.createdAt) : null);
                row.insertCell(0).textContent = createdAtDate ? createdAtDate.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
                row.insertCell(1).textContent = report.type;
                row.insertCell(2).textContent = report.technicianName;
                row.insertCell(3).textContent = report.downtimeMinutes;
                row.insertCell(4).textContent = report.description;
            });
        }

    } catch (error) {
        console.error("[Machines] Error rendering machine detail or fetching reports:", error);
        detailContentDiv.innerHTML = `<p class="notification is-danger">Gagal memuat detail mesin: ${error.message}</p>`;
        machineReportsListBody.innerHTML = `<tr><td colspan="5" class="has-text-danger">Gagal memuat riwayat laporan: ${error.message}</td></tr>`;
    }
};
