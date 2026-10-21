// ==================== 백업 ====================
function exportBackup() {
  if (currentMode === 'edit') saveGlobalEditorContent();
  ensureSystemSections();
  const dataStr = JSON.stringify(manualData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `메뉴얼_백업_${getSafeManualName()}_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const backupData = JSON.parse(ev.target.result);
        if (!isManualDataShape(backupData)) throw new Error('Invalid manual data');
        openBackupImportModal(backupData, file.name);
        return;
      } catch (err) {
        alert('올바른 JSON 파일이 아닙니다.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function toggleButtonMenu(event) {
  event?.stopPropagation();
  setButtonMenuOpen(!document.getElementById('buttons-wrapper').classList.contains('open'));
}

function setButtonMenuOpen(open, restoreFocus = false) {
  if (open) refreshStorageKeyMenu();
  document.getElementById('buttons-wrapper').classList.toggle('open', open);
  const toggle = document.getElementById('menu-toggle');
  toggle.setAttribute('aria-expanded', String(open));
  if (restoreFocus) toggle.focus();
}

document.addEventListener('click', (event) => {
  const buttonContainer = document.getElementById('button-container');
  if (!buttonContainer.contains(event.target)) {
    setButtonMenuOpen(false);
  }
  if (!event.target.closest('#editor-context-menu')) {
    closeEditorContextMenu();
  }
  if (!event.target.closest('#editor-context-menu, .manual-table td')) {
    clearTableSelection();
  }
  if (!event.target.closest('#reference-autocomplete')) closeReferenceAutocomplete();
});
document.addEventListener('pointerdown', closeContextMenusOnOutsidePointer, true);
document.addEventListener('keydown', event => {
  if (event.target.closest?.('dialog[open]')) return;
  if (event.key === 'Escape') closeBackupImportModal();
  if (event.key === 'Escape') closeImageLightbox();
  if (event.key === 'Escape') {
    if (document.getElementById('buttons-wrapper').classList.contains('open')) {
      setButtonMenuOpen(false, true);
    }
    closeEditorContextMenu();
    closeReferenceAutocomplete();
  }
});
document.addEventListener('dblclick', event => {
  if (currentMode !== 'read') return;
  const image = event.target.closest?.('.embedded-image');
  if (!image?.src) return;
  event.preventDefault();
  event.stopPropagation();
  openImageLightbox(image.src);
});
document.addEventListener('error', event => {
  const image = event.target;
  if (!image?.classList?.contains('embedded-image')) return;
  const fallback = image.nextElementSibling;
  if (!fallback?.classList?.contains('embedded-image-fallback')) return;
  image.style.display = 'none';
  fallback.hidden = false;
}, true);
