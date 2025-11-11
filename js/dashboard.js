// js/dashboard.js
import { db, firebase_firestore_FieldValue } from './firebase.js';

// Variabel global untuk instance Chart.js
let kpiChartInstance;

export const renderDashboardPage = async (containerElement) => {
    containerElement.innerHTML = `
        <h1 class="title">Dashboard KPI</h1>
        <div class="columns is-multiline">
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

        <div class="columns is-multiline">
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

    // Ambil dan hitung data KPI
    await fetchAndCalculateKPIs();
};

async function fetchAndCalculateKPIs() {
    try {
        const reportsSnapshot = await db.collection('log_laporan').get();
        const reports = reportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        let totalCorrectiveDowntime = 0; // dalam menit
        let correctiveCount = 0;
        let preventiveCount = 0;
        const machineFailureTimestamps = {}; // { machineId: [timestamp1, timestamp2, ...] }
        const monthlySummary = {};

        reports.forEach(report => {
            // --- Validasi dan Konversi Data ---
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

            // Untuk Monthly Summary
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

        // --- Perhitungan KPI (sama seperti sebelumnya) ---
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

        // Update UI dengan nilai KPI
        document.getElementById('mttr-value').innerText = mttr.toFixed(2);
        document.getElementById('mtbf-value').innerText = overallMTBFHours.toFixed(2);
        document.getElementById('total-downtime-value').innerText = totalDowntimeHours.toFixed(2);
        document.getElementById('total-jobs-value').innerText = totalJobs;

        // Render Chart.js untuk rasio Preventive vs Corrective
        renderChart(preventiveCount, correctiveCount);

        // Render Monthly Summary
        const monthlySummaryDiv = document.getElementById('monthly-summary-data');
        if (monthlySummaryDiv) { // Pastikan elemen ada
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
        } else {
            console.warn("[Dashboard] monthly-summary-data element not found.");
        }


    } catch (error) {
        console.error("Error fetching or calculating KPIs:", error);
        // Tampilkan pesan error di UI
        const appContent = document.getElementById('app-content');
        if (appContent) { // Pastikan appContent ada
            appContent.innerHTML = `<div class="notification is-danger">
                                        <h2 class="subtitle">Gagal memuat data KPI.</h2>
                                        <p>Detail error: ${error.message}</p>
                                        <p>Mohon pastikan Anda memiliki koneksi internet dan izin akses yang sesuai.</p>
                                    </div>`;
        } else {
            alert(`Gagal memuat data KPI: ${error.message}`);
        }
    }
}

// Fungsi untuk merender grafik menggunakan Chart.js
function renderChart(preventiveCount, correctiveCount) {
    const ctx = document.getElementById('kpi-chart');
    if (!ctx) { // Pastikan elemen canvas ada
        console.warn("[Dashboard] KPI Chart canvas element not found.");
        return;
    }

    // Hancurkan instance chart sebelumnya jika ada, untuk menghindari duplikasi
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
                    'rgba(75, 192, 192, 0.8)', // Hijau-kebiruan untuk Preventive
                    'rgba(255, 99, 132, 0.8)'  // Merah-muda untuk Corrective
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
