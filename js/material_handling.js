// js/material_handling.js
import { db, auth, firebase_firestore_FieldValue } from './firebase.js';

let materialHandlingReportsUnsubscribe = null;

export const renderMaterialHandlingPage = async (containerElement) => {
    containerElement.innerHTML = `
        <h1 class="title">Log Laporan Material Handling</h1>
        <div class="box">
            <h2 class="subtitle">Daftar Mesin Material Handling</h2>
            <div class="buttons mb-3">
                <button class="button is-success" id="export-mh-machines-xlsx">Export Mesin ke XLSX</button>
            </div>
            <div class="table-container">
                <table class="table is-striped is-hoverable is-fullwidth">
                    <thead>
                        <tr>
                            <th>ID Mesin</th>
                            <th>Nama</th>
                            <th>Lokasi</th>
                            <th>Tipe Penggerak</th>
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
            <div class="buttons mb-3">
                <button class="button is-success" id="export-mh-reports-xlsx">Export Laporan ke XLSX</button>
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
    // Tambahkan event listener untuk tombol export
    addMaterialHandlingEventListeners();
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
            machinesListBody.innerHTML = `<tr><td colspan="7" class="has-text-centered">Tidak ada data mesin Material Handling.</td></tr>`;
            return;
        }

        machinesListBody.innerHTML = '';
        snapshot.forEach(doc => {
            const machine = doc.data();
            const row = machinesListBody.insertRow();
            row.insertCell(0).textContent = machine.machineId;
            row.insertCell(1).textContent = machine.name;
            row.insertCell(2).textContent = machine.location;
            row.insertCell(3).textContent = machine.additionalDetails?.driveType || '-';
            row.insertCell(4).textContent = (machine.additionalDetails?.odometerKm || '0') + ' Km';
            row.insertCell(5).textContent = (machine.additionalDetails?.serviceIntervalKm || '0') + ' Km';
            row.insertCell(6).textContent = machine.status;
        });

    } catch (error) {
        console.error("[MaterialHandling] Error fetching machines:", error);
        machinesListBody.innerHTML = `<tr><td colspan="7" class="has-text-danger">Gagal memuat data mesin: ${error.message}</td></tr>`;
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

function addMaterialHandlingEventListeners() {
    document.getElementById('export-mh-machines-xlsx')?.addEventListener('click', exportMaterialHandlingMachinesToXLSX);
    document.getElementById('export-mh-reports-xlsx')?.addEventListener('click', exportMaterialHandlingReportsToXLSX);
}


async function exportMaterialHandlingMachinesToXLSX() {
    try {
        const snapshot = await db.collection('machines')
                                 .where('category', '==', 'material_handling')
                                 .orderBy('name', 'asc')
                                 .get();
        const machines = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                'ID Mesin': data.machineId,
                'Nama Mesin': data.name,
                'Kategori': data.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                'Lokasi': data.location,
                'Status': data.status,
                'Tipe Penggerak': data.additionalDetails?.driveType || '-',
                'Odometer (Km)': data.additionalDetails?.odometerKm || 0,
                'Interval Servis (Km)': data.additionalDetails?.serviceIntervalKm || 0,
                'Dibuat Pada': data.createdAt && typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate().toLocaleString('id-ID') : 'N/A',
                'Diperbarui Pada': data.updatedAt && typeof data.updatedAt.toDate === 'function' ? data.updatedAt.toDate().toLocaleString('id-ID') : 'N/A',
            };
        });

        if (machines.length === 0) {
            alert("Tidak ada data mesin Material Handling untuk diekspor.");
            return;
        }

        if (typeof XLSX === 'undefined') {
            alert("Pustaka XLSX tidak dimuat. Mohon refresh halaman.");
            console.error("XLSX library not found.");
            return;
        }

        const ws = XLSX.utils.json_to_sheet(machines);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Mesin Material Handling");
        XLSX.writeFile(wb, "mesin_material_handling.xlsx");

        alert("Data mesin Material Handling berhasil diekspor!");

    } catch (error) {
        console.error("[MaterialHandling] Error exporting machines:", error);
        alert(`Gagal mengekspor data mesin: ${error.message}.`);
    }
}


async function exportMaterialHandlingReportsToXLSX() {
    try {
        const snapshot = await db.collection('log_laporan')
                                 .where('machineCategory', '==', 'material_handling')
                                 .orderBy('createdAt', 'desc')
                                 .get();
        const reports = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                'ID Laporan': doc.id,
                'Waktu Lapor': data.createdAt && typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate().toLocaleString('id-ID') : 'N/A',
                'ID Mesin': data.machineId,
                'Nama Mesin': data.machineName,
                'Kategori Mesin': data.machineCategory ? data.machineCategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A',
                'ID Teknisi': data.technicianId,
                'Nama Teknisi': data.technicianName,
                'Waktu Mulai': data.startTime && typeof data.startTime.toDate === 'function' ? data.startTime.toDate().toLocaleString('id-ID') : 'N/A',
                'Waktu Selesai': data.endTime && typeof data.endTime.toDate === 'function' ? data.endTime.toDate().toLocaleString('id-ID') : 'N/A',
                'Downtime (menit)': data.downtimeMinutes,
                'Tipe Pekerjaan': data.type,
                'Deskripsi Pekerjaan': data.description,
                'Status Setelah Pengerjaan': data.statusAfterCompletion,
            };
        });

        if (reports.length === 0) {
            alert("Tidak ada data laporan Material Handling untuk diekspor.");
            return;
        }

        if (typeof XLSX === 'undefined') {
            alert("Pustaka XLSX tidak dimuat. Mohon refresh halaman.");
            console.error("XLSX library not found.");
            return;
        }

        const ws = XLSX.utils.json_to_sheet(reports);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Laporan Material Handling");
        XLSX.writeFile(wb, "laporan_material_handling.xlsx");

        alert("Data laporan Material Handling berhasil diekspor!");

    } catch (error) {
        console.error("[MaterialHandling] Error exporting reports:", error);
        alert(`Gagal mengekspor data laporan: ${error.message}.`);
    }
}
