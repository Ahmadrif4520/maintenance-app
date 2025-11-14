let confirmCallback = null;

export function showCustomConfirm(message, callback) {
    const modal = document.getElementById('custom-confirm-modal');
    if (!modal) {
        console.error("Custom confirm modal not found.");
        alert("Terjadi kesalahan: Modal konfirmasi tidak ditemukan.");
        return;
    }

    document.getElementById('custom-confirm-message').innerText = message;
    confirmCallback = callback;

    modal.classList.add('is-active');

    const okBtn = document.getElementById('custom-confirm-ok');
    const cancelBtn = document.getElementById('custom-confirm-cancel');
    const closeBtn = document.getElementById('custom-confirm-close');
    const modalBg = document.querySelector('#custom-confirm-modal .modal-background');

    // Penting: Hapus listener lama sebelum menambahkan yang baru untuk mencegah duplikasi
    // Ini adalah alternatif yang lebih robust daripada mengeset onclick = null
    const clonedOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(clonedOkBtn, okBtn);
    const clonedCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(clonedCancelBtn, cancelBtn);
    const clonedCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(clonedCloseBtn, closeBtn);
    const clonedModalBg = modalBg.cloneNode(true);
    modalBg.parentNode.replaceChild(clonedModalBg, modalBg);


    clonedOkBtn.addEventListener('click', handleConfirmOk);
    clonedCancelBtn.addEventListener('click', handleConfirmCancel);
    clonedCloseBtn.addEventListener('click', handleConfirmCancel);
    clonedModalBg.addEventListener('click', handleConfirmCancel);
}

function handleConfirmOk() {
    closeCustomConfirm();
    if (confirmCallback) {
        confirmCallback();
    }
}

function handleConfirmCancel() {
    closeCustomConfirm();
}

function closeCustomConfirm() {
    const modal = document.getElementById('custom-confirm-modal');
    if (modal) {
        modal.classList.remove('is-active');
    }
    confirmCallback = null;
}
