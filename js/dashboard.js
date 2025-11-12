// js/dashboard.js
import { db, firebase_firestore_FieldValue } from './firebase.js';

let kpiChartInstance;
let currentCategoryFilter = 'all_relevant';
let dashboardUnsubscribe; // Untuk listener real-time dashboard

// Fungsi untuk me-render Pie Chart
const renderChart = (data) => {
    // Memastikan canvas chart ada
    const ctx = document.getElementById('kpi-chart')?.getContext('2d');
    if (!ctx) return;

    // Destroy instance chart yang lama jika ada
    if (kpiChartInstance) {
        kpiChartInstance.destroy();
    }

    const labels = Object.keys(data);
    const values = Object.values(data);
    const total = values.reduce((sum, val) => sum + val, 0);

    const backgroundColors = [
        'rgba(54, 162, 235, 0.8)', // Biru untuk CT
        'rgba(255, 206, 86, 0.8)', // Kuning untuk KU
        'rgba(75, 192, 192, 0.8)', // Hijau untuk General
        'rgba(153, 102, 255, 0.8)', // Ungu untuk MH
    ];
    const borderColors = [
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(75, 192, 192, 1)',
        'rgba(153, 102, 255, 1)',
    ];

    kpiChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah Mesin',
                data: values,
                backgroundColor: backgroundColors.slice(0, labels.length),
                borderColor: borderColors.slice(0, labels.length),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1, // Mempertahankan rasio 1:1 untuk Pie Chart
            plugins: {
                legend: {
                    position: 'bottom',
                },
                title: {
                    display: true,
                    text: `Total Mesin: ${total}`
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                label += `${context.parsed} (${percentage}%)`;
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
    console.log("[Dashboard][renderChart] Chart rendered.");
};

// Fungsi untuk mengambil data dan menginisialisasi KPI Chart dan Ringkasan Bulanan
export const fetchAndRenderKPI = async () => {
    console.log(`[Dashboard][fetchAndRenderKPI] Fetching data for category: ${currentCategoryFilter}`);
    try {
        let query = db.collection('machines');
        
        // Filter berdasarkan kategori yang dipilih
        if (currentCategoryFilter !== 'all_relevant') {
             query = query.where('category', '==', currentCategoryFilter);
        } else {
             // Secara default, hanya mesin non-material handling yang dihitung untuk KPI umum
             // Kecuali user memilih material_handling secara spesifik
             query = query.where('category', 'in', ['general', 'cooling_tower', 'kompresor_unit']);
        }

        const snapshot = await query.get();
        let machineCountByCategory = {};

        // Inisialisasi hitungan, penting untuk pie chart
        if (currentCategoryFilter === 'all_relevant') {
            machineCountByCategory = {
                'Cooling Tower': 0,
                'Kompresor Unit': 0,
                'General': 0,
            };
        } else {
            // Jika filter spesifik, hapus yang lain
            // Logika ini mungkin perlu disesuaikan dengan kebutuhan Anda
        }
        
        // Loop melalui data mesin untuk menghitung per kategori
        snapshot.forEach(doc => {
            const machine = doc.data();
            const category = machine.category;

            if (category === 'cooling_tower' && (currentCategoryFilter === 'all_relevant' || currentCategoryFilter === 'cooling_tower')) {
                machineCountByCategory['Cooling Tower'] = (machineCountByCategory['Cooling Tower'] || 0) + 1;
            } else if (category === 'kompresor_unit' && (currentCategoryFilter === 'all_relevant' || currentCategoryFilter === 'kompresor_unit')) {
                machineCountByCategory['Kompresor Unit'] = (machineCountByCategory['Kompresor Unit'] || 0) + 1;
            } else if (category === 'general' && (currentCategoryFilter === 'all_relevant' || currentCategoryFilter === 'general')) {
                machineCountByCategory['General'] = (machineCountByCategory['General'] || 0) + 1;
            }
        });

        renderChart(machineCountByCategory);
        // Logika untuk fetch dan render ringkasan bulanan (Laporan)
        // ... (Logika yang sudah ada di file Anda) ...

    } catch (error) {
        console.error("[Dashboard][fetchAndRenderKPI] Error fetching machine data for KPI:", error);
    }
}

// Fungsi untuk mengambil dan me-render Ringkasan Laporan Bulanan
// Fungsi ini DIBIARKAN UTUH karena tidak ada hubungannya dengan card status mesin.
export const fetchAndRenderMonthlySummary = async () => {
    // ... (Logika fungsi fetchAndRenderMonthlySummary yang sudah ada) ...
    // ... (Biarkan fungsi ini seperti adanya) ...
    try {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        // Query Laporan dari bulan ini
        const reportsSnapshot = await db.collection('reports')
            .where('createdAt', '>=', firstDayOfMonth)
            .orderBy('createdAt', 'desc')
            .get();

        let totalDowntime = 0;
        let totalReports = 0;

        reportsSnapshot.forEach(doc => {
            const report = doc.data();
            if (report.downtimeMinutes) {
                totalDowntime += report.downtimeMinutes;
            }
            totalReports++;
        });


        // *** KALKULASI METRIK ***
    let mttrHours = 0;
    let mtbfHours = 0;
    
    // 1. MTTR (Mean Time To Repair) = Total Downtime / Total Laporan (Kegagalan)
    if (totalReports > 0) {
        // Total Downtime (Menit) / Total Laporan / 60 Menit
        mttrHours = (totalDowntime / totalReports / 60).toFixed(2); 
    }

    // 2. MTBF (Mean Time Between Failures) = Total Waktu Operasi / Total Laporan (Kegagalan)
    // Anda perlu menghitung Total Waktu Operasi (misalnya, 720 jam/bulan - totalDowntime(jam))
    const totalHoursInMonth = 720; // 30 hari * 24 jam
    const totalDowntimeHours = totalDowntime / 60;
    const uptimeHours = totalHoursInMonth - totalDowntimeHours; 
    
    if (totalReports > 0) {
        mtbfHours = (uptimeHours / totalReports).toFixed(2);
    }
    // *** AKHIR KALKULASI METRIK ***


    // Update UI
    const reportCountEl = document.getElementById('monthly-report-count');
    const downtimeEl = document.getElementById('monthly-downtime');
    const mttrEl = document.getElementById('mttr-value');
    const mtbfEl = document.getElementById('mtbf-value');

    if (reportCountEl) reportCountEl.innerText = totalReports;
    if (downtimeEl) downtimeEl.innerText = `${totalDowntime} Menit`;
    
    // UPDATE MTTR dan MTBF
    if (mttrEl) mttrEl.innerText = `${mttrHours} Jam`;
    if (mtbfEl) mtbfEl.innerText = `${mtbfHours} Jam`;

    console.log("[Dashboard][fetchAndRenderMonthlySummary] Monthly summary & KPI rendered.");

// Fungsi untuk mengambil dan me-render status mesin (Dihapus/Dikosongkan)
// Karena fungsionalitas ini dipindahkan ke halaman Kompresor Unit dan Cooling Tower
// Anda dapat mengosongkan fungsi ini.
export const fetchAndRenderMachineStatus = async () => {
    // Fungsi ini dikosongkan/dihapus isinya. Logika kini berada di cooling_tower.js dan compressor_unit.js.
    console.log("[Dashboard][fetchAndRenderMachineStatus] Status mesin dipindahkan ke halaman khusus. Mengabaikan eksekusi.");
};


// js/dashboard.js: Ganti seluruh isi dari export const renderDashboardPage = async (containerElement) => { ... }

export const renderDashboardPage = async (containerElement) => {
    console.log("[Dashboard][renderDashboardPage] Starting renderDashboardPage.");
    if (!containerElement) {
        console.error("[Dashboard][renderDashboardPage] FATAL: Container element for dashboard not found.");
        return;
    }

    containerElement.innerHTML = `
        <h1 class="title">Dashboard KPI</h1>
        <div class="field is-grouped is-grouped-right">
            <div class="control">
                <div class="select">
                    <select id="kpi-category-filter">
                        <option value="all_relevant">Semua Mesin (Non-Material Handling)</option>
                        <option value="general">General</option>
                        <option value="cooling_tower">Cooling Tower</option>
                        <option value="kompresor_unit">Kompresor Unit</option>
                        <option value="material_handling">Material Handling</option>
                    </select>
                </div>
            </div>
        </div>

        <div id="material-handling-message" class="notification is-info mt-4" style="display:none;">
            <p>Dashboard ini menampilkan KPI untuk kategori selain Material Handling.</p>
            <p>Untuk data Material Handling, silakan gunakan fitur Log Laporan dan filter berdasarkannya.</p>
        </div>

        <div class="columns is-multiline mt-4" id="kpi-charts-container">
            <div class="column is-half">
                <div class="box">
                    <h2 class="subtitle">Distribusi Mesin Berdasarkan Kategori</h2>
                    <div style="max-height: 350px;">
                        <canvas id="kpi-chart"></canvas>
                    </div>
                </div>
            </div>

            <div class="column is-half">
                <div class="box">
                    <h2 class="subtitle">Metrik Kinerja & Ringkasan Bulanan</h2>
                    <div class="columns is-multiline is-mobile has-text-centered">
                        <div class="column is-half">
                            <div class="kpi-card">
                                <p class="title is-4" id="monthly-report-count">0</p>
                                <p class="label">Total Pekerjaan</p>
                            </div>
                        </div>
                        <div class="column is-half">
                            <div class="kpi-card">
                                <p class="title is-4" id="monthly-downtime">0 Menit</p>
                                <p class="label">Total Downtime</p>
                            </div>
                        </div>
                        <div class="column is-half">
                            <div class="kpi-card">
                                <p class="title is-4" id="mttr-value">N/A</p>
                                <p class="label">MTTR (Jam)</p>
                            </div>
                        </div>
                        <div class="column is-half">
                            <div class="kpi-card">
                                <p class="title is-4" id="mtbf-value">N/A</p>
                                <p class="label">MTBF (Jam)</p>
                            </div>
                        </div>
                    </div>
                    <p class="has-text-grey is-size-7 mt-3">Metrik dihitung dari data laporan bulan ini.</p>
                </div>
            </div>
            </div>
        
        <progress class="progress is-small is-primary is-hidden" max="100" id="dashboard-progress"></progress>
    `;
    
    // ... (Logika setup filter, listeners, dan pemanggilan fungsi lainnya sama seperti sebelumnya)

    // 1. Setup Filter
    const filterEl = document.getElementById('kpi-category-filter');
    const mhMessageEl = document.getElementById('material-handling-message');

    if (filterEl) {
        filterEl.value = currentCategoryFilter; // Set nilai awal
        filterEl.addEventListener('change', (e) => {
            currentCategoryFilter = e.target.value;
            if (currentCategoryFilter === 'material_handling') {
                mhMessageEl.style.display = 'block';
                renderChart({}); 
            } else {
                mhMessageEl.style.display = 'none';
                fetchAndRenderKPI();
                fetchAndRenderMonthlySummary();
            }
        });
    }

    // 2. Muat Data Awal
    // fetchAndRenderMachineStatus() sekarang kosong, tapi tetap dipanggil
    fetchAndRenderMachineStatus(); 
    
    if (currentCategoryFilter !== 'material_handling') {
        fetchAndRenderKPI();
        fetchAndRenderMonthlySummary(); // <-- Ini akan mengisi data MTTR/MTBF jika fungsinya lengkap
    }
    
    // ... (Setup listener real-time)

    // Setup listener real-time untuk data laporan (jika ada)
    if (dashboardUnsubscribe) dashboardUnsubscribe();
    dashboardUnsubscribe = db.collection('reports')
        .onSnapshot(() => {
            console.log("[Dashboard] Report data changed. Updating summary.");
            if (currentCategoryFilter !== 'material_handling') {
                fetchAndRenderMonthlySummary();
            }
        });

    // Setup listener real-time untuk data mesin (jika ada)
    db.collection('machines').onSnapshot(() => {
        console.log("[Dashboard] Machine data changed. Updating KPI.");
        if (currentCategoryFilter !== 'material_handling') {
            fetchAndRenderKPI();
        }
    });

    console.log("[Dashboard][renderDashboardPage] Finished renderDashboardPage.");
};

export const cleanupDashboardPage = () => {
    console.log("[Dashboard][cleanupDashboardPage] Cleaning up dashboard resources.");
    if (kpiChartInstance) {
        kpiChartInstance.destroy();
        kpiChartInstance = null;
    }
    if (dashboardUnsubscribe) {
        dashboardUnsubscribe();
        dashboardUnsubscribe = null;
    }
};

// ... (export fungsi lain jika ada, misalnya fetchAndRenderMonthlySummary)
// Pastikan fungsi fetchAndRenderMonthlySummary juga diexport