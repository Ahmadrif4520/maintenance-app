// js/reports.js
import { db, auth, firebase_firestore_FieldValue } from './firebase.js';

// Variabel global untuk menyimpan daftar mesin yang akan digunakan di dropdown
let machinesData = [];
// Variabel untuk melacak apakah kita sedang dalam mode edit
let editingReportId = null;

export const renderReportsPage = async (containerElement) => {
    containerElement.innerHTML = `
        <h1 class="title">Log Laporan Pekerjaan</h1>
        <div class="box">
            <h2 class="subtitle">Tambah / Edit Laporan</h2>
            <form id="report-form">
                <input type="hidden" id="report-id-hidden">

                <div class="field">
                    <label class="label">ID Mesin</label>
                    <div class="control">
                        <div class="select is-fullwidth">
                            <select id="report-machine-id" required>
                                <option value="">Pilih Mesin</option>
                                <!-- Opsi mesin akan dimuat di sini -->
                            </select>
                        </div>
                    </div>
                </div>

                <div class="field">
                    <label class="label">Nama Teknisi</label>
                    <div class="control">
                        <input class="input" type="text" id="report-technician-name" readonly required>
                    </div>
                </div>

                <div class="field">
                    <label class="label">Waktu Mulai</label>
                    <div class="control">
                        <input class="input" type="datetime-local" id="report-start-time" required>
                    </div>
                </div>

                <div class="field">
                    <label class="label">Waktu Selesai</label>
                    <div class="control">
                        <input class="input" type="datetime-local" id="report-end-time" required>
                    </div>
                </div>

                <div class="field">
                    <label class="label">Downtime (menit)</label>
                    <div class="control">
                        <input class="input" type="number" id="report-downtime-minutes" min="0" required>
                    </div>
                </div>

                <div class="field">
                    <label class="label">Tipe Pekerjaan</label>
                    <div class="control">
                        <div class="select is-fullwidth">
                            <select id="report-type" required>
                                <option value="">Pilih Tipe</option>
                                <option value="Preventive">Preventive</option>
                                <option value="Corrective">Corrective</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="field">
                    <label class="label">Deskripsi Pekerjaan</label>
                    <div class="control">
                        <textarea class="textarea" id="report-description" placeholder="Deskripsi detail pekerjaan..." required></textarea>
                    </div>
                </div>

                <div class="field">
                    <label class="label">Status Setelah Selesai</label>
                    <div class="control">
                        <div class="select is-fullwidth">
                            <select id="report-status-after-completion" required>
                                <option value="">Pilih Status</option>
                                <option value="RUN">RUN</option>
                                <option value="IDLE">IDLE</option>
                                <option value="STOP">STOP</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="field">
                    <div class="control">
                        <button class="button is-primary" type="submit" id="submit-report-button">Simpan Laporan</button>
                        <button class="button is-link is-light" type="button" id="cancel-edit-button" style="display:none;">Batal Edit</button>
                    </div>
                </div>
            </form>
        </div>

        <div class="box mt-4">
            <h2 class="subtitle">Daftar Laporan</h2>
            <div class="buttons mb-3">
                <button class="button is-success" id="export-reports-xlsx">Export ke XLSX</button>
            </div>
            <div class="table-container">
                <table class="table is-striped is-hoverable is-fullwidth">
                    <thead>
                        <tr>
                            <th>Waktu Lapor</th>
                            <th>Mesin</th>
                            <th>Teknisi</th>
                            <th>Tipe</th>
                            <th>Downtime (menit)</th>
                            <th>Status Setelah</th>
                            <th>Deskripsi</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="reports-list">
                        <!-- Data laporan akan dimuat di sini -->
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Inisialisasi event listener dan muat data
    await populateMachineDropdown();
    setupReportsListener();
    addReportsEventListeners();

    // Set nama teknisi otomatis
    if (auth.currentUser) {
        document.getElementById('report-technician-name').value = auth.currentUser.displayName || auth.currentUser.email;
    }
};

async function populateMachineDropdown() {
    const machineSelect = document.getElementById('report-machine-id');
    try {
        const snapshot = await db.collection('machines').get();
        machinesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        machineSelect.innerHTML = '<option value="">Pilih Mesin</option>'; // Reset
        machinesData.forEach(machine => {
            const option = document.createElement('option');
            option.value = machine.machineId; // Pastikan ini unique
            option.textContent = `${machine.name} (${machine.machineId})`;
            machineSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error populating machine dropdown:", error);
        alert("Gagal memuat daftar mesin.");
    }
}

function setupReportsListener() {
    const reportsListBody = document.getElementById('reports-list');
    if (!reportsListBody) return;

    db.collection('log_laporan').orderBy('createdAt', 'desc').onSnapshot(async (snapshot) => {
        reportsListBody.innerHTML = ''; // Bersihkan list sebelumnya
        const currentUser = auth.currentUser;
        let currentUserRole = 'technician'; // Default
        if (currentUser) {
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (userDoc.exists) {
                currentUserRole = userDoc.data().role;
            }
        }

        snapshot.forEach(doc => {
            const report = doc.data();
            const row = reportsListBody.insertRow();

            // Format tanggal dan waktu
            const createdAtDate = report.createdAt && typeof report.createdAt.toDate === 'function' ? report.createdAt.toDate() : (report.createdAt ? new Date(report.createdAt) : null);
            const formattedTime = createdAtDate ? createdAtDate.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';

            row.insertCell(0).textContent = formattedTime;
            row.insertCell(1).textContent = `${report.machineName} (${report.machineId})`;
            row.insertCell(2).textContent = report.technicianName;
            row.insertCell(3).textContent = report.type;
            row.insertCell(4).textContent = report.downtimeMinutes;
            row.insertCell(5).textContent = report.statusAfterCompletion;
            row.insertCell(6).textContent = report.description.substring(0, 50) + (report.description.length > 50 ? '...' : ''); // Pratinjau deskripsi

            const actionsCell = row.insertCell(7);
            actionsCell.classList.add('has-text-right');

            // Tombol Edit dan Delete (Owner/Admin bisa semua, Teknisi hanya miliknya sendiri)
            const isOwner = currentUserRole === 'admin';
            const isMyReport = currentUser && report.submittedBy === currentUser.uid;

            if (isOwner || isMyReport) {
                const editButton = document.createElement('button');
                editButton.classList.add('button', 'is-small', 'is-info', 'mr-2');
                editButton.innerHTML = `<span class="icon is-small"><i class="fas fa-edit"></i></span><span>Edit</span>`;
                editButton.onclick = () => editReport(doc.id, report);
                actionsCell.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.classList.add('button', 'is-small', 'is-danger');
                deleteButton.innerHTML = `<span class="icon is-small"><i class="fas fa-trash"></i></span><span>Hapus</span>`;
                deleteButton.onclick = () => deleteReport(doc.id);
                actionsCell.appendChild(deleteButton);
            }
        });
    }, (error) => {
        console.error("Error listening to reports:", error);
        reportsListBody.innerHTML = `<tr><td colspan="8" class="has-text-danger">Gagal memuat laporan: ${error.message}</td></tr>`;
    });
}

function addReportsEventListeners() {
    document.getElementById('report-form').addEventListener('submit', handleReportSubmission);
    document.getElementById('export-reports-xlsx').addEventListener('click', exportReportsToXLSX);
    document.getElementById('cancel-edit-button').addEventListener('click', resetForm);
}

async function handleReportSubmission(event) {
    event.preventDefault();

    const machineId = document.getElementById('report-machine-id').value;
    const technicianName = document.getElementById('report-technician-name').value;
    const startTimeStr = document.getElementById('report-start-time').value;
    const endTimeStr = document.getElementById('report-end-time').value;
    const downtimeMinutes = parseInt(document.getElementById('report-downtime-minutes').value);
    const type = document.getElementById('report-type').value;
    const description = document.getElementById('report-description').value;
    const statusAfterCompletion = document.getElementById('report-status-after-completion').value;

    const currentUser = auth.currentUser;
    if (!currentUser) {
        alert("Anda harus login untuk menyimpan laporan.");
        return;
    }

    const selectedMachine = machinesData.find(m => m.machineId === machineId);
    if (!selectedMachine) {
        alert("Mesin tidak ditemukan dalam daftar.");
        return;
    }

    // Konversi string datetime-local ke Firestore Timestamp
    const startTime = new Date(startTimeStr);
    const endTime = new Date(endTimeStr);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        alert("Format waktu mulai atau selesai tidak valid.");
        return;
    }
    if (endTime < startTime) {
        alert("Waktu selesai tidak boleh lebih awal dari waktu mulai.");
        return;
    }

    const reportData = {
        machineId: selectedMachine.machineId,
        machineName: selectedMachine.name,
        technicianId: currentUser.uid,
        technicianName: technicianName,
        startTime: firebase.firestore.Timestamp.fromDate(startTime),
        endTime: firebase.firestore.Timestamp.fromDate(endTime),
        downtimeMinutes: downtimeMinutes,
        type: type,
        description: description,
        statusAfterCompletion: statusAfterCompletion,
        submittedBy: currentUser.uid, // Untuk kontrol izin di Security Rules
    };

    try {
        if (editingReportId) {
            // Mode edit
            await db.collection('log_laporan').doc(editingReportId).update(reportData);
            alert("Laporan berhasil diperbarui!");
        } else {
            // Mode tambah baru
            reportData.createdAt = firebase_firestore_FieldValue.serverTimestamp();
            await db.collection('log_laporan').add(reportData);
            alert("Laporan berhasil ditambahkan!");
        }
        resetForm(); // Reset form setelah sukses
    } catch (error) {
        console.error("Error saving report:", error);
        alert(`Gagal menyimpan laporan: ${error.message}. Pastikan Anda memiliki izin yang cukup.`);
    }
}

function editReport(id, report) {
    editingReportId = id;
    document.getElementById('report-machine-id').value = report.machineId;
    document.getElementById('report-technician-name').value = report.technicianName;
    // Format tanggal untuk input datetime-local
    document.getElementById('report-start-time').value = report.startTime.toDate().toISOString().slice(0, 16);
    document.getElementById('report-end-time').value = report.endTime.toDate().toISOString().slice(0, 16);
    document.getElementById('report-downtime-minutes').value = report.downtimeMinutes;
    document.getElementById('report-type').value = report.type;
    document.getElementById('report-description').value = report.description;
    document.getElementById('report-status-after-completion').value = report.statusAfterCompletion;

    document.getElementById('submit-report-button').textContent = 'Update Laporan';
    document.getElementById('cancel-edit-button').style.display = 'inline-block';
    // Scroll ke atas form
    document.getElementById('report-form').scrollIntoView({ behavior: 'smooth' });
}

async function deleteReport(id) {
    if (!confirm("Apakah Anda yakin ingin menghapus laporan ini?")) {
        return;
    }

    try {
        await db.collection('log_laporan').doc(id).delete();
        alert("Laporan berhasil dihapus!");
    } catch (error) {
        console.error("Error deleting report:", error);
        alert(`Gagal menghapus laporan: ${error.message}. Pastikan Anda memiliki izin yang cukup.`);
    }
}

function resetForm() {
    editingReportId = null;
    document.getElementById('report-form').reset();
    // Set technician name back
    if (auth.currentUser) {
        document.getElementById('report-technician-name').value = auth.currentUser.displayName || auth.currentUser.email;
    }
    document.getElementById('submit-report-button').textContent = 'Simpan Laporan';
    document.getElementById('cancel-edit-button').style.display = 'none';
}

async function exportReportsToXLSX() {
    try {
        const snapshot = await db.collection('log_laporan').orderBy('createdAt', 'desc').get();
        const reports = snapshot.docs.map(doc => {
            const data = doc.data();
            // Konversi Timestamp Firestore ke format string yang mudah dibaca Excel
            const formattedData = {
                'ID Laporan': doc.id,
                'Waktu Lapor': data.createdAt && typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate().toLocaleString('id-ID') : 'N/A',
                'ID Mesin': data.machineId,
                'Nama Mesin': data.machineName,
                'ID Teknisi': data.technicianId,
                'Nama Teknisi': data.technicianName,
                'Waktu Mulai': data.startTime && typeof data.startTime.toDate === 'function' ? data.startTime.toDate().toLocaleString('id-ID') : 'N/A',
                'Waktu Selesai': data.endTime && typeof data.endTime.toDate === 'function' ? data.endTime.toDate().toLocaleString('id-ID') : 'N/A',
                'Downtime (menit)': data.downtimeMinutes,
                'Tipe Pekerjaan': data.type,
                'Deskripsi Pekerjaan': data.description,
                'Status Setelah Pengerjaan': data.statusAfterCompletion,
            };
            return formattedData;
        });

        if (reports.length === 0) {
            alert("Tidak ada data laporan untuk diekspor.");
            return;
        }

        const ws = XLSX.utils.json_to_sheet(reports);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Laporan Maintenance");
        XLSX.writeFile(wb, "laporan_maintenance.xlsx");

        alert("Data laporan berhasil diekspor ke laporan_maintenance.xlsx!");

    } catch (error) {
        console.error("Error exporting reports:", error);
        alert(`Gagal mengekspor laporan: ${error.message}.`);
    }
}
