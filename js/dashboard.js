// js/dashboard.js
import { db, firebase_firestore_FieldValue } from './firebase.js';

// Variabel global untuk instance Chart.js
let kpiChartInstance;
let currentCategoryFilter = 'all_relevant'; // Default filter untuk dashboard

export const renderDashboardPage = async (containerElement) => {
    if (!containerElement) {
        console.error("[Dashboard] Container element for dashboard not found.");
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

        <!-- Pesan khusus untuk Material Handling, akan disembunyikan/ditampilkan via JS -->
        <div id="material-handling-message" class="notification is-info mt-4" style="display:none;">
            <p>Dashboard ini menampilkan KPI untuk kategori selain Material Handling.</p>
            <p>Untuk data Material Handling, silakan gunakan fitur Log Laporan dan filter berdasarkan kategori tersebut, atau di halaman laporan servis terpisah.</p>
            <button class="button is-light mt-3" onclick="window.location.reload()">Refresh Dashboard</button>
        </div>

        <!-- Bagian baru untuk status mesin -->
        <div class="columns is-multiline mt-4" id="machine-status-cards-container">
            <!-- Cooling Tower Status Card -->
            <div class="column is-one-quarter">
                <div class="box">
                    <p class="title is-5">Cooling Tower</p>
                    <p class="subtitle is-7 has-text-grey">Status Mesin</p>
                    <div class="level is-mobile mt-3">
                        <div class="level-item has-text-centered">
                            <div>
                                <span class="status-indicator is-success"></span>
                                <p class="heading">RUN</p>
                                <p class="title is-6" id="ct-run-count">0</p>
                            </div>
                        </div>
                        <div class="level-item has-text-centered">
                            <div>
                                <span class="status-indicator is-warning"></span>
                                <p class="heading">IDLE</p>
                                <p class="title is-6" id="ct-idle-count">0</p>
                            </div>
                        </div>
                        <div class="level-item has-text-centered">
                            <div>
                                <span class="status-indicator is-danger"></span>
                                <p class="heading">STOP</p>
                                <p class="title is-6" id="ct-stop-count">0</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Kompresor Unit Status Card -->
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

        <div class="columns is-multiline" id="kpi-cards-container">
            <div class="column is-one-quarter">
                <div class="box kpi-card">
                    <p class="title is-4 has-text-centered" id="mttr-value">0.00</p>
                    <p class="subtitle is-6 has-text-centered">MTTR (menit)</p>
                </div>
            </div>
            <div class="column is-one-quarter">
                <div class="box kpi-card">
                    <p class="title is-4 has-text-centered" id="mtbf-value">0.00</p>
                    <p class="subtitle is-6 has-text-centered">MTBF (jam)</p>
                </div>
            </div>
            <div class="column is-one-quarter">
                <div class="box kpi-card">
                    <p class="title is-4 has-text-centered" id="total-downtime-value">0.00</p>
                    <p class="subtitle is-6 has-text-centered">Total Downtime (jam)</p>
                </div>
            </div>
            <div class="column is-one-quarter">
                <div class="box kpi-card">
                    <p class="title is-4 has-text-centered" id="total-jobs-value">0</p>
                    <p class="subtitle is-6 has-text-centered">Total Pekerjaan</p>
                </div>
            </div>
        </div>

        <div class="columns is-multiline" id="kpi-charts-container">
            <div class="column is-half">
                <div class="box">
                    <h2 class="subtitle">Rasio Preventive vs Corrective</h2>
                    <canvas id="kpi-chart"></canvas>
                </div>
            </div>
            <div class="column is-half">
                <div class="box">
                    <h2 class="subtitle">Ringkasan Bulanan</h2>
                    <div id="monthly-summary-data">
                        <progress class="progress is-small is-info mt-6" max="100">Loading...</progress>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Set nilai filter sebelumnya jika ada
    const categoryFilterElement = document.getElementById('kpi-category-filter');
    if (categoryFilterElement) {
        categoryFilterElement.value = currentCategoryFilter;

        categoryFilterElement.addEventListener('change', (event) => {
            currentCategoryFilter = event.target.value;
            fetchAndCalculateKPIs();
        });
    }

    await fetchAndCalculateKPIs();
    await fetchAndRenderMachineStatus(); // Panggil fungsi baru ini saat dashboard dimuat
};

async function fetchAndCalculateKPIs() {
    try {
        const materialHandlingMessage = document.getElementById('material-handling-message');
        const kpiCardsContainer = document.getElementById('kpi-cards-container');
        const kpiChartsContainer = document.getElementById('kpi-charts-container');
        const machineStatusCardsContainer = document.getElementById('machine-status-cards-container'); // Ambil container status mesin

        if (currentCategoryFilter === 'material_handling') {
            if (materialHandlingMessage) materialHandlingMessage.style.display = 'block';
            if (kpiCardsContainer) kpiCardsContainer.style.display = 'none';
            if (kpiChartsContainer) kpiChartsContainer.style.display = 'none';
            if (machineStatusCardsContainer) machineStatusCardsContainer.style.display = 'none'; // Sembunyikan juga status mesin
            
            document.getElementById('mttr-value').innerText = 'N/A';
            document.getElementById('mtbf-value').innerText = 'N/A';
            document.getElementById('total-downtime-value').innerText = 'N/A';
            document.getElementById('total-jobs-value').innerText = 'N/A';
            if (kpiChartInstance) kpiChartInstance.destroy();
            const monthlySummaryDiv = document.getElementById('monthly-summary-data');
            if(monthlySummaryDiv) monthlySummaryDiv.innerHTML = '<p class="has-text-centered">Tidak ada data untuk kategori ini di dashboard ini.</p>';

            return;
        } else {
            if (materialHandlingMessage) materialHandlingMessage.style.display = 'none';
            if (kpiCardsContainer) kpiCardsContainer.style.display = 'flex';
            if (kpiChartsContainer) kpiChartsContainer.style.display = 'flex';
            if (machineStatusCardsContainer) machineStatusCardsContainer.style.display = 'flex'; // Tampilkan kembali status mesin

            document.getElementById('mttr-value').innerText = '0.00';
            document.getElementById('mtbf-value').innerText = '0.00';
            document.getElementById('total-downtime-value').innerText = '0.00';
            document.getElementById('total-jobs-value').innerText = '0';
            const monthlySummaryDiv = document.getElementById('monthly-summary-data');
            if(monthlySummaryDiv) monthlySummaryDiv.innerHTML = '<progress class="progress is-small is-info mt-6" max="100">Loading...</progress>';
        }

        let reports = [];

        let queryRef = db.collection('log_laporan');
        if (currentCategoryFilter === 'all_relevant') {
            queryRef = queryRef.where('machineCategory', 'in', ['general', 'cooling_tower', 'kompresor_unit']);
        } else {
            queryRef = queryRef.where('machineCategory', '==', currentCategoryFilter);
        }
        
        const reportsSnapshot = await queryRef.get();
        reports = reportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));


        let totalCorrectiveDowntime = 0;
        let correctiveCount = 0;
        let preventiveCount = 0;
        const machineFailureTimestamps = {};
        const monthlySummary = {};

        reports.forEach(report => {
            const reportEndTime = report.endTime && typeof report.endTime.toDate === 'function' ? report.endTime.toDate() : (report.endTime ? new Date(report.endTime) : null);
            const reportCreatedAt = report.createdAt && typeof report.createdAt.toDate === 'function' ? report.createdAt.toDate() : (report.createdAt ? new Date(report.createdAt) : null);
            const downtimeMinutes = typeof report.downtimeMinutes === 'number' ? report.downtimeMinutes : 0;
            const reportType = typeof report.type === 'string' ? report.type : '';
            const machineId = typeof report.machineId === 'string' ? report.machineId : '';

            if (reportType === 'Corrective') {
                correctiveCount++;
                totalCorrectiveDowntime += downtimeMinutes;
                
                if (machineId && reportEndTime) {
                    if (!machineFailureTimestamps[machineId]) {
                        machineFailureTimestamps[machineId] = [];
                    }
                    machineFailureTimestamps[machineId].push(reportEndTime.getTime());
                }
            } else if (reportType === 'Preventive') {
                preventiveCount++;
            }

            if (reportCreatedAt) {
                const monthYear = `${reportCreatedAt.getFullYear()}-${(reportCreatedAt.getMonth() + 1).toString().padStart(2, '0')}`;
                if (!monthlySummary[monthYear]) {
                    monthlySummary[monthYear] = { preventive: 0, corrective: 0, downtimeMinutes: 0 };
                }
                if (reportType === 'Preventive') monthlySummary[monthYear].preventive++;
                if (reportType === 'Corrective') {
                    monthlySummary[monthYear].corrective++;
                    monthlySummary[monthYear].downtimeMinutes += downtimeMinutes;
                }
            }
        });

        const totalJobs = preventiveCount + correctiveCount;
        const mttr = correctiveCount > 0 ? totalCorrectiveDowntime / correctiveCount : 0;
        const totalDowntimeHours = totalCorrectiveDowntime / 60;

        let totalMTBFDurationMs = 0;
        let mtbfMachineCount = 0;
        for (const machineId in machineFailureTimestamps) {
            const timestamps = machineFailureTimestamps[machineId].sort((a, b) => a - b);
            if (timestamps.length > 1) {
                mtbfMachineCount++;
                let machineTotalDurationBetweenFailures = 0;
                for (let i = 1; i < timestamps.length; i++) {
                    machineTotalDurationBetweenFailures += (timestamps[i] - timestamps[i - 1]);
                }
                totalMTBFDurationMs += (machineTotalDurationBetweenFailures / (timestamps.length - 1));
            }
        }
        const overallMTBFHours = mtbfMachineCount > 0 ? (totalMTBFDurationMs / mtbfMachineCount) / (1000 * 60 * 60) : 0;

        document.getElementById('mttr-value').innerText = mttr.toFixed(2);
        document.getElementById('mtbf-value').innerText = overallMTBFHours.toFixed(2);
        document.getElementById('total-downtime-value').innerText = totalDowntimeHours.toFixed(2);
        document.getElementById('total-jobs-value').innerText = totalJobs;

        renderChart(preventiveCount, correctiveCount);

        const monthlySummaryDiv = document.getElementById('monthly-summary-data');
        if (monthlySummaryDiv) {
            if (Object.keys(monthlySummary).length > 0) {
                const sortedMonths = Object.keys(monthlySummary).sort();
                let summaryHtml = '<table class="table is-striped is-hoverable is-fullwidth"><thead><tr><th>Bulan</th><th>Preventive</th><th>Corrective</th><th>Downtime (jam)</th></tr></thead><tbody>';
                sortedMonths.forEach(monthYear => {
                    const data = monthlySummary[monthYear];
                    summaryHtml += `
                        <tr>
                            <td>${monthYear}</td>
                            <td>${data.preventive}</td>
                            <td>${data.corrective}</td>
                            <td>${(data.downtimeMinutes / 60).toFixed(2)}</td>
                        </tr>
                    `;
                });
                summaryHtml += '</tbody></table>';
                monthlySummaryDiv.innerHTML = summaryHtml;
            } else {
                monthlySummaryDiv.innerHTML = '<p class="has-text-centered">Tidak ada data ringkasan bulanan untuk ditampilkan.</p>';
            }
        }

    } catch (error) {
        console.error("Error fetching or calculating KPIs:", error);
        const mttrValue = document.getElementById('mttr-value');
        if (mttrValue) mttrValue.innerText = 'Error';
        const mtbfValue = document.getElementById('mtbf-value');
        if (mtbfValue) mtbfValue.innerText = 'Error';
        const totalDowntimeValue = document.getElementById('total-downtime-value');
        if (totalDowntimeValue) totalDowntimeValue.innerText = 'Error';
        const totalJobsValue = document.getElementById('total-jobs-value');
        if (totalJobsValue) totalJobsValue.innerText = 'Error';

        const monthlySummaryDiv = document.getElementById('monthly-summary-data');
        if (monthlySummaryDiv) monthlySummaryDiv.innerHTML = `<p class="has-text-danger">Gagal memuat data: ${error.message}</p>`;

        if (kpiChartInstance) kpiChartInstance.destroy();
        const ctx = document.getElementById('kpi-chart');
        if (ctx) ctx.innerHTML = `<p class="has-text-danger">Gagal memuat grafik: ${error.message}</p>`;
    }
}

function renderChart(preventiveCount, correctiveCount) {
    const ctx = document.getElementById('kpi-chart');
    if (!ctx) {
        console.warn("[Dashboard] KPI Chart canvas element not found.");
        return;
    }

    if (kpiChartInstance) {
        kpiChartInstance.destroy();
    }

    kpiChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Preventive', 'Corrective'],
            datasets: [{
                label: 'Jumlah Pekerjaan',
                data: [preventiveCount, correctiveCount],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(255, 99, 132, 0.8)'
                ],
                borderColor: [
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 99, 132, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Rasio Pekerjaan Maintenance',
                    font: {
                        size: 16
                    }
                }
            }
        }
    });
}

// Fungsi baru untuk mengambil dan menampilkan status mesin
async function fetchAndRenderMachineStatus() {
    const categoriesToMonitor = ['cooling_tower', 'kompresor_unit', 'general']; // Tambahkan 'general'
    const machineStatusCounts = {
        cooling_tower: { RUN: 0, IDLE: 0, STOP: 0 },
        kompresor_unit: { RUN: 0, IDLE: 0, STOP: 0 },
        general: { RUN: 0, IDLE: 0, STOP: 0 } // Inisialisasi untuk 'general'
    };

    try {
        const snapshot = await db.collection('machines')
                                 .where('category', 'in', categoriesToMonitor)
                                 .get();
        
        snapshot.forEach(doc => {
            const machine = doc.data();
            const category = machine.category;
            const status = machine.status;

            if (machineStatusCounts[category] && machineStatusCounts[category][status]) {
                machineStatusCounts[category][status]++;
            } else if (machineStatusCounts[category] && !machineStatusCounts[category][status]) {
                // Handle status other than RUN, IDLE, STOP, default to STOP count for simplicity or new status field
                // For now, let's just make sure new statuses don't cause error, ignore if not one of the 3
            }
        });

        // Update UI for Cooling Tower
        document.getElementById('ct-run-count').innerText = machineStatusCounts.cooling_tower.RUN;
        document.getElementById('ct-idle-count').innerText = machineStatusCounts.cooling_tower.IDLE;
        document.getElementById('ct-stop-count').innerText = machineStatusCounts.cooling_tower.STOP;

        // Update UI for Kompresor Unit
        document.getElementById('ku-run-count').innerText = machineStatusCounts.kompresor_unit.RUN;
        document.getElementById('ku-idle-count').innerText = machineStatusCounts.kompresor_unit.IDLE;
        document.getElementById('ku-stop-count').innerText = machineStatusCounts.kompresor_unit.STOP;

        // Jika Anda ingin menampilkan General juga, tambahkan card baru di HTML
        // Untuk saat ini, kita hanya menghitungnya di backend

    } catch (error) {
        console.error("[Dashboard] Error fetching machine status:", error);
        // Display error or 'N/A' on UI for status counts
        ['ct-run-count', 'ct-idle-count', 'ct-stop-count', 'ku-run-count', 'ku-idle-count', 'ku-stop-count'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = 'N/A';
        });
    }
}


