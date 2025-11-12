// js/dashboard.js
import { db, firebase_firestore_FieldValue } from './firebase.js';

let kpiChartInstance;
let currentCategoryFilter = 'all_relevant';
let dashboardUnsubscribe; // Untuk listener real-time dashboard

// Fungsi untuk me-render Pie Chart (Preventive vs Corrective) - LOGIKA AMAN
const renderChart = (data) => {
    const ctx = document.getElementById('kpi-chart')?.getContext('2d');
    if (!ctx) return;

    if (kpiChartInstance) {
        kpiChartInstance.destroy();
    }

    const labels = Object.keys(data); // Harus berisi: ['Preventive', 'Corrective']
    const values = Object.values(data);
    const total = values.reduce((sum, val) => sum + val, 0);

    const backgroundColors = [
        'rgba(75, 192, 192, 0.8)', // Hijau/Teal untuk Preventive
        'rgba(255, 99, 132, 0.8)', // Merah untuk Corrective
    ];
    const borderColors = [
        'rgba(75, 192, 192, 1)',
        'rgba(255, 99, 132, 1)',
    ];

    kpiChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah Pekerjaan',
                data: values,
                backgroundColor: backgroundColors.slice(0, labels.length),
                borderColor: borderColors.slice(0, labels.length),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1, 
            plugins: {
                legend: {
                    position: 'bottom',
                },
                title: {
                    display: true,
                    text: `Total Pekerjaan: ${total}`
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
    console.log("[Dashboard][renderChart] Pie Chart (Preventive vs Corrective) rendered.");
};

// Fungsi untuk mengambil data Pie Chart (Preventive vs Corrective) - LOGIKA AMAN
export const fetchAndRenderKPI = async () => {
    console.log(`[Dashboard][fetchAndRenderKPI] Fetching report data for Preventive vs Corrective Pie Chart.`);
    try {
        const reportsSnapshot = await db.collection('reports').get();

        let reportCountByType = {
            'Preventive': 0, 
            'Corrective': 0, 
        };
        
        reportsSnapshot.forEach(doc => {
            const report = doc.data();
            const type = report.type;

            if (type === 'Maintenance' || type === 'Preventive') { 
                reportCountByType['Preventive']++;
            } else if (type === 'Kerusakan' || type === 'Corrective') { 
                reportCountByType['Corrective']++;
            }
        });

        renderChart(reportCountByType);

    } catch (error) {
        console.error("[Dashboard][fetchAndRenderKPI] Error fetching report data for Pie Chart:", error);
    }
}


// Fungsi untuk mengambil dan me-render Metrik (MTTR, MTBF, Downtime, Total Pekerjaan) - LOGIKA AMAN
export const fetchAndRenderMonthlySummary = async () => {
    try {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        const reportsSnapshot = await db.collection('reports')
            .where('createdAt', '>=', firstDayOfMonth)
            .orderBy('createdAt', 'desc')
            .get();

        let totalDowntimeMinutes = 0;
        let totalReports = 0; 
        let totalHoursInMonth = 720; 

        reportsSnapshot.forEach(doc => {
            const report = doc.data();
            if (report.downtimeMinutes) {
                totalDowntimeMinutes += report.downtimeMinutes;
            }
            if (report.type === 'Kerusakan' || report.type === 'Maintenance') {
                 totalReports++;
            }
        });

        // *** KALKULASI METRIK ***
        const totalDowntimeHours = totalDowntimeMinutes / 60;
        let mttrHours = 'N/A';
        let mtbfHours = 'N/A';
        
        if (totalReports > 0) {
            mttrHours = (totalDowntimeHours / totalReports).toFixed(2); 
        }

        const uptimeHours = totalHoursInMonth - totalDowntimeHours; 
        if (totalReports > 0) {
            mtbfHours = (uptimeHours / totalReports).toFixed(2);
        }
        // *** AKHIR KALKULASI METRIK ***

        // Update UI (Memastikan ID yang digunakan sesuai dengan HTML di bawah)
        const reportCountEl = document.getElementById('monthly-report-count');
        const downtimeEl = document.getElementById('monthly-downtime');
        const mttrEl = document.getElementById('mttr-value');
        const mtbfEl = document.getElementById('mtbf-value');

        if (reportCountEl) reportCountEl.innerText = totalReports;
        if (downtimeEl) downtimeEl.innerText = `${totalDowntimeMinutes} Menit`;
        if (mttrEl) mttrEl.innerText = `${mttrHours} Jam`;
        if (mtbfEl) mtbfEl.innerText = `${mtbfHours} Jam`;

        console.log("[Dashboard][fetchAndRenderMonthlySummary] Monthly summary & KPI rendered.");

    } catch (error) {
        console.error("[Dashboard][fetchAndRenderMonthlySummary] Error fetching monthly summary:", error);
        // Jika error, atur semua ke N/A
        ['monthly-report-count', 'monthly-downtime', 'mttr-value', 'mtbf-value'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.innerText = 'N/A';
        });
    }
}


// FUNGSI INI DIKOSONGKAN (SESUAI PERMINTAAN)
export const fetchAndRenderMachineStatus = async () => {
    console.log("[Dashboard][fetchAndRenderMachineStatus] Logic disabled. Machine status cards removed from dashboard.");
};


export const renderDashboardPage = async (containerElement) => {
    console.log("[Dashboard][renderDashboardPage] Starting renderDashboardPage.");
    if (!containerElement) {
        console.error("[Dashboard][renderDashboardPage] FATAL: Container element for dashboard not found.");
        return;
    }

    // --- TEMPLATE DASHBOARD (KARTU STATUS MESIN DIHAPUS, KPI DIJAGA UTUH DALAM KOTAK INDIVIDUAL) ---
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
            
            <div class="column is-half-desktop is-full-tablet">
                <div class="box">
                    <h2 class="subtitle">Perbandingan Pekerjaan: Preventive vs Corrective</h2>
                    <div style="max-height: 350px;">
                        <canvas id="kpi-chart"></canvas>
                    </div>
                </div>
            </div>

            <div class="column is-half-desktop is-full-tablet">
                <h2 class="subtitle">Metrik Kinerja & Ringkasan Bulanan</h2>
                <div class="columns is-multiline is-mobile">
                    
                    <div class="column is-half">
                        <div class="box has-text-centered p-4">
                            <p class="title is-4 has-text-primary" id="mttr-value">N/A</p>
                            <p class="label">MTTR (Jam)</p>
                        </div>
                    </div>
                    
                    <div class="column is-half">
                        <div class="box has-text-centered p-4">
                            <p class="title is-4 has-text-primary" id="mtbf-value">N/A</p>
                            <p class="label">MTBF (Jam)</p>
                        </div>
                    </div>
                    
                    <div class="column is-half">
                        <div class="box has-text-centered p-4">
                            <p class="title is-4 has-text-info" id="monthly-report-count">0</p>
                            <p class="label">Total Pekerjaan</p>
                        </div>
                    </div>
                    
                    <div class="column is-half">
                        <div class="box has-text-centered p-4">
                            <p class="title is-4 has-text-danger" id="monthly-downtime">0 Menit</p>
                            <p class="label">Total Downtime</p>
                        </div>
                    </div>
                    
                </div>
                <p class="has-text-grey is-size-7 mt-1">Metrik dihitung dari data laporan bulan ini.</p>
            </div>
            </div>
        
        <progress class="progress is-small is-primary is-hidden" max="100" id="dashboard-progress"></progress>
    `;
    // --- AKHIR TEMPLATE DASHBOARD ---

    // 1. Setup Filter
    const filterEl = document.getElementById('kpi-category-filter');
    const mhMessageEl = document.getElementById('material-handling-message');

    if (filterEl) {
        filterEl.value = currentCategoryFilter;
        filterEl.addEventListener('change', (e) => {
            currentCategoryFilter = e.target.value;
            if (currentCategoryFilter === 'material_handling') {
                mhMessageEl.style.display = 'block';
            } else {
                mhMessageEl.style.display = 'none';
            }
        });
    }

    // 2. Muat Data Awal
    fetchAndRenderMachineStatus(); // Memanggil fungsi KOSONG
    
    fetchAndRenderKPI(); 
    fetchAndRenderMonthlySummary(); // Ini akan menjalankan perhitungan KPI
    
    // 3. Setup listener real-time
    if (dashboardUnsubscribe) dashboardUnsubscribe();
    dashboardUnsubscribe = db.collection('reports')
        .onSnapshot(() => {
            console.log("[Dashboard] Report data changed. Updating summary & KPI.");
            fetchAndRenderMonthlySummary();
            fetchAndRenderKPI();
        });

    db.collection('machines').onSnapshot(() => {
        console.log("[Dashboard] Machine data changed.");
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