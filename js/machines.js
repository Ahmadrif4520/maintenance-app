// js/machines.js
// Placeholder untuk logika master mesin
console.log("Machines module loaded.");

export const renderMachinesPage = async (containerElement) => {
    containerElement.innerHTML = `<h1 class="title">Master Mesin</h1><p>Loading machine data...</p>`;
};
export const renderMachineDetailPage = async (containerElement, machineId) => {
    containerElement.innerHTML = `<h1 class="title">Detail Mesin: ${machineId}</h1><p>Loading machine details...</p>`;
};
