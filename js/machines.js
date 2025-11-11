// js/machines.js
import { db, auth, firebase_firestore_FieldValue } from './firebase.js';
import { navigateTo } from './router.js'; // Untuk navigasi ke detail mesin

// Variabel untuk melacak apakah kita sedang dalam mode edit
let editingMachineDocId = null; // Ini adalah ID dokumen Firestore, bukan machineId

export const renderMachinesPage = async (containerElement) => {
    containerElement.innerHTML = `
        <h1 class="title">Master Mesin</h1>
        <div class="box">
            <h2 class="subtitle">Tambah / Edit Data Mesin</h2>
            <form id="machine-form">
                <input type="hidden" id="machine-doc-id-hidden">

                <div class="field">
                    <label class="label">ID Mesin Unik</label>
                    <div class="control">
                        <input class="input" type="text" id="machine-machine-id" placeholder="Contoh: CT001, CP002, GEN001" required>
                    </div>
                    <p class="help">ID ini harus unik dan tidak dapat diubah setelah disimpan.</p>
                </div>

                <div class="field">
                    <label class="label">Nama Mesin</label>
                    <div class="control">
                        <input class="input" type="text" id="machine-name" placeholder="Contoh: Cooling Tower A, Mesin Press, Genset Utama" required>
                    </div>
                </div>

                <div class="field">
                    <label class="label">Kategori Mesin</label>
                    <div class="control">
                        <div class="select is-fullwidth">
                            <select id="machine-category" required>
                                <option value="">Pilih Kategori</option>
                                <option value="general">General</option>
                                <option value="cooling_tower">Cooling Tower</option>
                                <option value="kompresor_unit">Kompresor Unit</option>
                                <option value="material_handling">Material Handling</option>
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

                <div class="field" id="runtime-hours-field">
                    <label class="label">Jam Operasional Saat Ini (Jam)</label>
                    <div class="control">
                        <input class="input" type="number" id="machine-current-runtime-hours" min="0" value="0">
                    </div>
                    <p class="help">Untuk kategori selain Material Handling.</p>
                </div>

                <div class="field" id="service-interval-hours-field">
                    <label class="label">Interval Servis (Jam)</label>
                    <div class="control">
                        <input class="input" type="number" id="machine-service-interval-hours" min="0" value="0">
                    </div>
                    <p class="help">Untuk kategori selain Material Handling.</p>
                </div>

                <div class="field" id="additional-details-container">
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
                            <th>Odometer / Runtime</th>
                            <th>Servis Interval</th>
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
    addMachinesEventListeners(); // Pasang event listeners untuk form
    setupMachinesListener(); // Mulai mendengarkan perubahan data mesin

    // Panggil ini untuk inisialisasi tampilan field tambahan saat halaman dimuat
    const initialCategory = document.getElementById('machine-category').value;
    renderDynamicFields(initialCategory, {}); // Kosongkan existingDetails untuk init
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
            try {
                const userDoc = await db.collection('users').doc(currentUser.uid).get();
                if (userDoc.exists) {
                    currentUserRole = userDoc.data().role;
                }
            } catch (error) {
                console.error("[Machines] Error fetching current user role:", error);
            }
        }

        if (snapshot.empty) {
            machinesListBody.innerHTML = `<tr><td colspan="8" class="has-text-centered">Tidak ada data mesin.</td></tr>`;
            return;
        }

        snapshot.forEach(doc => {
            const machine = doc.data();
            const row = machinesListBody.insertRow();

            row.insertCell(0).textContent = machine.machineId;
            row.insertCell(1).textContent = machine.name;
            row.insertCell(2).textContent = machine.category ? machine.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A';
            row.insertCell(3).textContent = machine.location;
            row.insertCell(4).textContent = machine.status;

            // Odometer / Runtime display
            if (machine.category === 'material_handling' && machine.additionalDetails && typeof machine.additionalDetails.odometerKm === 'number') {
                row.insertCell(5).textContent = `${machine.additionalDetails.odometerKm} Km`;
            } else if (typeof machine.currentRuntimeHours === 'number') {
                row.insertCell(5).textContent = `${machine.currentRuntimeHours} Jam`;
            } else {
                row.insertCell(5).textContent = '0 Jam/Km';
            }

            // Service Interval display
            if (machine.category === 'material_handling' && machine.additionalDetails && typeof machine.additionalDetails.serviceIntervalKm === 'number') {
                row.insertCell(6).textContent = `${machine.additionalDetails.serviceIntervalKm} Km`;
            } else if (typeof machine.serviceIntervalHours === 'number') {
                row.insertCell(6).textContent = `${machine.serviceIntervalHours} Jam`;
            } else {
                row.insertCell(6).textContent = '0 Jam/Km';
            }


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
                editButton.onclick = () => editMachine(doc.id, machine); // Gunakan doc.id
                actionsCell.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.classList.add('button', 'is-small', 'is-danger');
                deleteButton.innerHTML = `<span class="icon is-small"><i class="fas fa-trash"></i></span><span>Hapus</span>`;
                deleteButton.onclick = () => deleteMachine(doc.id); // Gunakan doc.id
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
    
    // Event listener untuk perubahan kategori: panggil renderDynamicFields
    document.getElementById('machine-category').addEventListener('change', (event) => {
        renderDynamicFields(event.target.value, {}); // existingDetails kosong saat perubahan manual
    });
}

async function handleMachineSubmission(event) {
    event.preventDefault();

    const machineId = document.getElementById('machine-machine-id').value.trim();
    const name = document.getElementById('machine-name').value.trim();
    const category = document.getElementById('machine-category').value;
    const location = document.getElementById('machine-location').value.trim();
    const status = document.getElementById('machine-status').value;

    if (!machineId || !name || !category || !location || !status) {
        alert("Semua field wajib diisi (kecuali Jam Operasional/Interval Servis untuk Material Handling).");
        return;
    }

    let currentRuntimeHours = 0;
    let serviceIntervalHours = 0;
    if (category !== 'material_handling') { // Hanya ambil dari input jika bukan material_handling
        currentRuntimeHours = parseInt(document.getElementById('machine-current-runtime-hours').value) || 0;
        serviceIntervalHours = parseInt(document.getElementById('machine-service-interval-hours').value) || 0;
    }

    const machineData = {
        machineId: machineId,
        name: name,
        category: category,
        location: location,
        status: status,
        // currentRuntimeHours & serviceIntervalHours hanya disimpan jika bukan material_handling
        ...(category !== 'material_handling' && {currentRuntimeHours: currentRuntimeHours}),
        ...(category !== 'material_handling' && {serviceIntervalHours: serviceIntervalHours}),
        additionalDetails: getAdditionalDetailsFromForm(category) // Ambil detail tambahan
    };

    try {
        if (editingMachineDocId) {
            // Mode edit
            // Hapus machineId dari data update karena tidak boleh diubah
            const dataToUpdate = { ...machineData };
            delete dataToUpdate.machineId; // Pastikan machineId di dokumen tidak diupdate

            await db.collection('machines').doc(editingMachineDocId).update({
                ...dataToUpdate,
                updatedAt: firebase_firestore_FieldValue.serverTimestamp()
            });
            alert("Data mesin berhasil diperbarui!");
        } else {
            // Mode tambah baru
            // Periksa apakah machineId sudah ada
            const existingMachine = await db.collection('machines').where('machineId', '==', machineId).limit(1).get();
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
    editingMachineDocId = docId; // Simpan ID dokumen Firestore
    document.getElementById('machine-doc-id-hidden').value = docId;
    document.getElementById('machine-machine-id').value = machine.machineId;
    document.getElementById('machine-machine-id').readOnly = true; // Nonaktifkan edit ID Mesin Unik
    document.getElementById('machine-name').value = machine.name;
    document.getElementById('machine-category').value = machine.category;
    document.getElementById('machine-location').value = machine.location;
    document.getElementById('machine-status').value = machine.status;

    // Panggil renderDynamicFields untuk mengisi form dengan detail tambahan dan mengatur visibilitas field runtime/interval
    renderDynamicFields(machine.category, machine.additionalDetails || {});

    // Isi currentRuntimeHours dan serviceIntervalHours jika bukan material_handling
    if (machine.category !== 'material_handling') {
        document.getElementById('machine-current-runtime-hours').value = machine.currentRuntimeHours || 0;
        document.getElementById('machine-service-interval-hours').value = machine.serviceIntervalHours || 0;
    }

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
    editingMachineDocId = null;
    document.getElementById('machine-form').reset();
    document.getElementById('machine-machine-id').readOnly = false; // Aktifkan kembali ID Mesin Unik
    document.getElementById('submit-machine-button').textContent = 'Simpan Mesin';
    document.getElementById('cancel-edit-machine-button').style.display = 'none';

    // Reset nilai runtime/service interval ke 0 dan tampilkan kembali
    document.getElementById('machine-current-runtime-hours').value = 0;
    document.getElementById('machine-service-interval-hours').value = 0;
    // Panggil renderDynamicFields dengan kategori kosong untuk membersihkan dan menampilkan field default
    renderDynamicFields('', {});
}

// --- Fungsi untuk mengelola field dinamis berdasarkan kategori ---
function renderDynamicFields(category, existingDetails = {}) {
    const additionalDetailsContainer = document.getElementById('additional-details-container');
    additionalDetailsContainer.innerHTML = ''; // Bersihkan field sebelumnya

    const runtimeHoursField = document.getElementById('runtime-hours-field');
    const serviceIntervalHoursField = document.getElementById('service-interval-hours-field');

    let fieldsHtml = '';
    if (category === 'material_handling') {
        // Sembunyikan field jam operasional dan interval servis
        if (runtimeHoursField) runtimeHoursField.style.display = 'none';
        if (serviceIntervalHoursField) serviceIntervalHoursField.style.display = 'none';

        fieldsHtml = `
            <div class="field">
                <label class="label">Tipe Penggerak</label>
                <div class="control">
                    <input class="input" type="text" id="detail-drive-type" value="${existingDetails.driveType || ''}">
                </div>
            </div>
            <div class="field">
                <label class="label">Odometer (Km)</label>
                <div class="control">
                    <input class="input" type="number" step="0.1" id="detail-odometer-km" value="${existingDetails.odometerKm || ''}">
                </div>
                <p class="help">Jarak tempuh total mesin.</p>
            </div>
            <div class="field">
                <label class="label">Interval Servis (Km)</label>
                <div class="control">
                    <input class="input" type="number" step="0.1" id="detail-service-interval-km" value="${existingDetails.serviceIntervalKm || ''}">
                </div>
                <p class="help">Interval servis berdasarkan jarak tempuh.</p>
            </div>
        `;
    } else {
        // Tampilkan kembali field jam operasional dan interval servis
        if (runtimeHoursField) runtimeHoursField.style.display = 'block';
        if (serviceIntervalHoursField) serviceIntervalHoursField.style.display = 'block';

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
            case 'general': // Kategori general tidak memiliki additionalDetails
            default:
                // Tidak ada field tambahan untuk kategori default/general
                break;
        }
    }
    additionalDetailsContainer.innerHTML = fieldsHtml;
}

// Fungsi untuk mengambil nilai dari field tambahan dinamis
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
            details.odometerKm = parseFloat(document.getElementById('detail-odometer-km')?.value) || null;
            details.serviceIntervalKm = parseFloat(document.getElementById('detail-service-interval-km')?.value) || null;
            break;
        case 'general': // General tidak memiliki additionalDetails
        default:
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
        if (machine.additionalDetails && Object.keys(machine.additionalDetails).length > 0) {
            additionalDetailsHtml = `
                <p class="pt-2"><strong>Detail Tambahan:</strong></p>
                <ul>
            `;
            for (const key in machine.additionalDetails) {
                // Format key agar lebih mudah dibaca (misal: odometerKm -> Odometer Km)
                const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                additionalDetailsHtml += `<li><strong>${formattedKey}:</strong> ${machine.additionalDetails[key]}</li>`;
            }
            additionalDetailsHtml += `</ul>`;
        }

        detailContentDiv.innerHTML = `
            <p><strong>ID Mesin:</strong> ${machine.machineId}</p>
            <p><strong>Nama Mesin:</strong> ${machine.name}</p>
            <p><strong>Kategori:</strong> ${machine.category ? machine.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A'}</p>
            <p><strong>Lokasi:</strong> ${machine.location}</p>
            <p><strong>Status Saat Ini:</strong> ${machine.status}</p>
            ${machine.category === 'material_handling' ? `
                <p><strong>Odometer:</strong> ${machine.additionalDetails?.odometerKm || 0} Km</p>
                <p><strong>Interval Servis (Km):</strong> ${machine.additionalDetails?.serviceIntervalKm || 0} Km</p>
            ` : `
                <p><strong>Jam Operasional:</strong> ${machine.currentRuntimeHours || 0} jam</p>
                <p><strong>Interval Servis (Jam):</strong> ${machine.serviceIntervalHours || 0} jam</p>
            `}
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
