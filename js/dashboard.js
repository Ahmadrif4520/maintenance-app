// js/dashboard.js
import { db, firebase_firestore_FieldValue } from './firebase.js';

let kpiChartInstance;
let currentCategoryFilter = 'all_relevant';

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
            <p>Untuk data Material Handling, silakan gunakan fitur Log Laporan dan filter berdasarkan kategori tersebut, atau di halaman laporan servis terpisah.</p>
            <button class="button is-light mt-3" onclick="window.location.reload()">Refresh Dashboard</button>
        </div>

        <!-- Cards Status Mesin Dihapus Dari Sini -->

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

    const categoryFilterElement = document.getElementById('kpi-category-filter');
    if (categoryFilterElement) {
        categoryFilterElement.value = currentCategoryFilter;

        categoryFilterElement.addEventListener('change', (event) => {
            currentCategoryFilter = event.target.value;
            fetchAndCalculateKPIs();
            // fetchAndRenderMachineStatus(); // Dihapus
        });
    }

    await fetchAndCalculateKPIs();
    // await fetchAndRenderMachineStatus(); // Dihapus
    console.log("[Dashboard][renderDashboardPage] Finished renderDashboardPage.");
};

async function fetchAndCalculateKPIs() {
    console.log("[Dashboard][fetchAndCalculateKPIs] Starting fetchAndCalculateKPIs.");
    try {
        const materialHandlingMessage = document.getElementById('material-handling-message');
        const kpiCardsContainer = document.getElementById('kpi-cards-container');
        const kpiChartsContainer = document.getElementById('kpi-charts-container');
        // const machineStatusCardsContainer = document.getElementById('machine-status-cards-container'); // Dihapus

        if (currentCategoryFilter === 'material_handling') {
            console.log("[Dashboard][fetchAndCalculateKPIs] Filter is material_handling. Hiding KPI sections.");
            if (materialHandlingMessage) materialHandlingMessage.style.display = 'block';
            if (kpiCardsContainer) kpiCardsContainer.style.display = 'none';
            if (kpiChartsContainer) kpiChartsContainer.style.display = 'none';
            // if (machineStatusCardsContainer) machineStatusCardsContainer.style.display = 'none'; // Dihapus
            
            if (document.getElementById('mttr-value')) document.getElementById('mttr-value').innerText = 'N/A';
            if (document.getElementById('mtbf-value')) document.getElementById('mtbf-value').innerText = 'N/A';
            if (document.getElementById('total-downtime-value')) document.getElementById('total-downtime-value').innerText = 'N/A';
            if (document.getElementById('total-jobs-value')) document.getElementById('total-jobs-value').innerText = 'N/A';
            if (kpiChartInstance) {
                 kpiChartInstance.destroy();
                 kpiChartInstance = null;
            }
            const monthlySummaryDiv = document.getElementById('monthly-summary-data');
            if(monthlySummaryDiv) monthlySummaryDiv.innerHTML = '<p class="has-text-centered">Tidak ada data untuk kategori ini di dashboard ini.</p>';

            return;
        } else {
            console.log("[Dashboard][fetchAndCalculateKPIs] Filter is NOT material_handling. Showing KPI sections.");
            if (materialHandlingMessage) materialHandlingMessage.style.display = 'none';
            if (kpiCardsContainer) kpiCardsContainer.style.display = 'flex';
            if (kpiChartsContainer) kpiChartsContainer.style.display = 'flex';
            // if (machineStatusCardsContainer) machineStatusCardsContainer.style.display = 'flex'; // Dihapus

            if (document.getElementById('mttr-value')) document.getElementById('mttr-value').innerText = '0.00';
            if (document.getElementById('mtbf-value')) document.getElementById('mtbf-value').innerText = '0.00';
            if (document.getElementById('total-downtime-value')) document.getElementById('total-downtime-value').innerText = '0.00';
            if (document.getElementById('total-jobs-value')) document.getElementById('total-jobs-value').innerText = '0';
            const monthlySummaryDiv = document.getElementById('monthly-summary-data');
            if(monthlySummaryDiv) monthlySummaryDiv.innerHTML = '<progress class="progress is-small is-info mt-6" max="100">Loading...</progress>';
        }

        let reports = [];

        let queryRef = db.collection('log_laporan');
        if (currentCategoryFilter === 'all_relevant') {
            queryRef = queryRef.where('machineCategory', 'in', ['general', 'cooling_tower', 'kompresor_unit']);
            console.log("[Dashboard][fetchAndCalculateKPIs] Querying all_relevant categories for KPIs.");
        } else {
            queryRef = queryRef.where('machineCategory', '==', currentCategoryFilter);
            console.log(`[Dashboard][fetchAndCalculateKPIs] Querying category: ${currentCategoryFilter} for KPIs.`);
        }
        
        const reportsSnapshot = await queryRef.get();
        reports = reportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[Dashboard][fetchAndCalculateKPIs] Fetched ${reports.length} reports for KPI calculations.`);


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

        if (document.getElementById('mttr-value')) document.getElementById('mttr-value').innerText = mttr.toFixed(2);
        if (document.getElementById('mtbf-value')) document.getElementById('mtbf-value').innerText = overallMTBFHours.toFixed(2);
        if (document.getElementById('total-downtime-value')) document.getElementById('total-downtime-value').innerText = totalDowntimeHours.toFixed(2);
        if (document.getElementById('total-jobs-value')) document.getElementById('total-jobs-value').innerText = totalJobs;

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
        console.log("[Dashboard][fetchAndCalculateKPIs] Finished fetchAndCalculateKPIs successfully.");

    } catch (error) {
        console.error("[Dashboard][fetchAndCalculateKPIs] Error fetching or calculating KPIs:", error);
        const elementsToUpdate = ['mttr-value', 'mtbf-value', 'total-downtime-value', 'total-jobs-value'];
        elementsToUpdate.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = 'Error';
        });

        const monthlySummaryDiv = document.getElementById('monthly-summary-data');
        if (monthlySummaryDiv) monthlySummaryDiv.innerHTML = `<p class="has-text-danger">Gagal memuat data: ${error.message}</p>`;

        if (kpiChartInstance) kpiChartInstance.destroy();
        const ctx = document.getElementById('kpi-chart');
        if (ctx && ctx.parentNode) {
            ctx.parentNode.innerHTML = `<p class="has-text-danger">Gagal memuat grafik: ${error.message}</p>`;
        }
    }
}

function renderChart(preventiveCount, correctiveCount) {
    const ctx = document.getElementById('kpi-chart');
    if (!ctx) {
        console.warn("[Dashboard][renderChart] KPI Chart canvas element not found for rendering.");
        return;
    }
    
    if (kpiChartInstance) {
        kpiChartInstance.destroy();
    }
    if (ctx.getContext) {
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
    } else {
        console.error("[Dashboard][renderChart] Canvas element does not support getContext (likely not a canvas or corrupted).");
    }
}
// Fungsi fetchAndRenderMachineStatus() telah dihapus dari sini.
