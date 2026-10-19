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

function closeBackupImportModal() {
  document.getElementById('backup-import-modal')?.remove();
}

const BACKUP_GLOBAL_MANUAL_PATH = '__globalManual';

function cloneManualItemForImport(item, path, selectedPaths) {
  if (!selectedPaths.has(path.join('.'))) return null;
  const {children, ...fields} = item;
  const cloned = JSON.parse(JSON.stringify(fields));
  cloned.children = Array.isArray(children)
    ? children.map((child,index) => cloneManualItemForImport(child,[...path,index],selectedPaths)).filter(Boolean)
    : [];
  return cloned;
}

function findItemIndexByTitle(items, title) {
  return items.findIndex(item => String(item?.title || '') === String(title || ''));
}

function mergeImportedItem(targetItems, sourceItem, duplicateMode) {
  const targetIndex = findItemIndexByTitle(targetItems,sourceItem.title);
  if (targetIndex === -1 || duplicateMode === 'importAll') {
    const incoming = JSON.parse(JSON.stringify(sourceItem));
    if (!Array.isArray(incoming.children)) incoming.children = [];
    targetItems.push(incoming);
    return;
  }
  const targetItem = targetItems[targetIndex];
  if (duplicateMode === 'overwrite') {
    const {children, ...fields} = sourceItem;
    Object.assign(targetItem,JSON.parse(JSON.stringify(fields)));
  }
  if (!Array.isArray(targetItem.children)) targetItem.children = [];
  const children = Array.isArray(sourceItem.children) ? sourceItem.children : [];
  children.forEach(child => mergeImportedItem(targetItem.children,child,duplicateMode));
}

function importSelectedBackupItems(backupData, selectedPaths, duplicateMode) {
  const shouldImportGlobalManual = selectedPaths.has(BACKUP_GLOBAL_MANUAL_PATH);
  const selectedRoots = (backupData.menu || [])
    .map((item, index) => cloneManualItemForImport(item, [index], selectedPaths))
    .filter(Boolean);

  if (!shouldImportGlobalManual && !selectedRoots.length) {
    alert('불러올 항목을 선택해주세요.');
    return false;
  }

  if (shouldImportGlobalManual) {
    if (Array.isArray(backupData.globalTabs) && backupData.globalTabs.length) {
      manualData.globalTabs = backupData.globalTabs.map((tab, index) => normalizeGlobalTab(tab, index));
      manualData.activeGlobalTabId = backupData.activeGlobalTabId;
    } else {
      const tab = createGlobalTab(DEFAULT_GLOBAL_TAB_TITLE, backupData.globalManual, backupData.globalImages);
      manualData.globalTabs = [tab];
      manualData.activeGlobalTabId = tab.id;
    }
    syncGlobalFieldsFromActiveTab();
  }

  if (!Array.isArray(manualData.menu)) manualData.menu = [];
  selectedRoots.forEach(item => mergeImportedItem(manualData.menu, item, duplicateMode));
  ensureSystemSections();
  normalizeAllTables();
  saveToLocalStorage(true);
  resetEditHistory();
  renderAll();
  return true;
}

function backupDataHasGlobalManual(backupData) {
  return Object.prototype.hasOwnProperty.call(backupData, 'globalManual')
    || Object.prototype.hasOwnProperty.call(backupData, 'globalImages')
    || Object.prototype.hasOwnProperty.call(backupData, 'globalTabs');
}

function createBackupGlobalManualTreeItem() {
  const ul = document.createElement('ul');
  const li = document.createElement('li');
  const label = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = true;
  checkbox.dataset.path = BACKUP_GLOBAL_MANUAL_PATH;

  const title = document.createElement('span');
  title.textContent = '전역 메뉴얼 탭';
  label.append(checkbox, title);
  li.appendChild(label);
  ul.appendChild(li);
  return ul;
}

function setBackupTreeChecked(checkbox, checked) {
  checkbox.checked = checked;
  checkbox.indeterminate = false;
  const li = checkbox.closest('li');
  li?.querySelectorAll('input[type="checkbox"][data-path]').forEach(child => {
    child.checked = checked;
    child.indeterminate = false;
  });
}

function updateBackupTreeAncestors(checkbox) {
  let parentLi = checkbox.closest('ul')?.closest('li');
  while (parentLi) {
    const parentCheckbox = parentLi.querySelector(':scope > label input[type="checkbox"][data-path]');
    const childCheckboxes = Array.from(parentLi.querySelectorAll(':scope > ul input[type="checkbox"][data-path]'));
    const checkedCount = childCheckboxes.filter(child => child.checked || child.indeterminate).length;
    parentCheckbox.checked = checkedCount > 0;
    parentCheckbox.indeterminate = checkedCount > 0 && checkedCount < childCheckboxes.length;
    parentLi = parentLi.closest('ul')?.closest('li');
  }
}

function createBackupTreeList(items, path = []) {
  const ul = document.createElement('ul');
  items.forEach((item, index) => {
    const itemPath = [...path, index];
    const li = document.createElement('li');
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.path = itemPath.join('.');
    checkbox.addEventListener('change', () => {
      setBackupTreeChecked(checkbox, checkbox.checked);
      updateBackupTreeAncestors(checkbox);
    });

    const title = document.createElement('span');
    title.textContent = String(item?.title || '(이름 없는 항목)');
    label.append(checkbox, title);
    li.appendChild(label);

    if (Array.isArray(item.children) && item.children.length) {
      li.appendChild(createBackupTreeList(item.children, itemPath));
    }
    ul.appendChild(li);
  });
  return ul;
}

function openBackupImportModal(backupData) {
  closeBackupImportModal();

  const layer = document.createElement('div');
  layer.id = 'backup-import-modal';
  layer.className = 'backup-import-modal';
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');

  const dialog = document.createElement('div');
  dialog.className = 'backup-import-dialog';
  dialog.addEventListener('click', event => event.stopPropagation());

  const header = document.createElement('div');
  header.className = 'backup-import-header';
  const title = document.createElement('h3');
  title.textContent = '백업 항목 선택';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'backup-import-close';
  closeButton.textContent = '닫기';
  closeButton.addEventListener('click', closeBackupImportModal);
  header.append(title, closeButton);

  const controls = document.createElement('div');
  controls.className = 'backup-import-controls';
  const allLabel = document.createElement('label');
  const allCheckbox = document.createElement('input');
  allCheckbox.type = 'checkbox';
  allCheckbox.checked = true;
  allLabel.append(allCheckbox, document.createTextNode('전체 선택'));

  const duplicateOptions = document.createElement('div');
  duplicateOptions.className = 'backup-import-duplicate-options';
  const duplicateTitle = document.createElement('span');
  duplicateTitle.className = 'backup-import-duplicate-title';
  duplicateTitle.textContent = '중복 항목 처리';
  duplicateOptions.appendChild(duplicateTitle);
  [
    ['overwrite', '덮어씌우기 우선', true],
    ['importAll', '중복 무시하고 전부 불러오기', false],
    ['newOnly', '새로운 것만 불러오기', false]
  ].forEach(([value, text, checked]) => {
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'backup-import-duplicate-mode';
    radio.value = value;
    radio.checked = checked;
    label.append(radio, document.createTextNode(text));
    duplicateOptions.appendChild(label);
  });
  controls.append(allLabel, duplicateOptions);

  const tree = document.createElement('div');
  tree.className = 'backup-import-tree';
  if (backupDataHasGlobalManual(backupData)) {
    tree.appendChild(createBackupGlobalManualTreeItem());
  }
  if (Array.isArray(backupData.menu) && backupData.menu.length) {
    tree.appendChild(createBackupTreeList(backupData.menu));
  }
  if (!tree.children.length) {
    const empty = document.createElement('div');
    empty.className = 'backup-import-empty';
    empty.textContent = '백업 파일에 불러올 항목이 없습니다.';
    tree.appendChild(empty);
  }

  allCheckbox.addEventListener('change', () => {
    tree.querySelectorAll('input[type="checkbox"][data-path]').forEach(checkbox => {
      checkbox.checked = allCheckbox.checked;
      checkbox.indeterminate = false;
    });
  });

  tree.addEventListener('change', () => {
    const checkboxes = Array.from(tree.querySelectorAll('input[type="checkbox"][data-path]'));
    const checkedCount = checkboxes.filter(checkbox => checkbox.checked).length;
    allCheckbox.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
    allCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
  });

  const footer = document.createElement('div');
  footer.className = 'backup-import-footer';
  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'backup-import-cancel';
  cancelButton.textContent = '취소';
  cancelButton.addEventListener('click', closeBackupImportModal);
  const applyButton = document.createElement('button');
  applyButton.type = 'button';
  applyButton.className = 'backup-import-apply';
  applyButton.textContent = '선택 항목 불러오기';
  applyButton.addEventListener('click', () => {
    const selectedPaths = new Set(
      Array.from(tree.querySelectorAll('input[type="checkbox"][data-path]:checked'))
        .map(checkbox => checkbox.dataset.path)
    );
    const duplicateMode = dialog.querySelector('input[name="backup-import-duplicate-mode"]:checked')?.value || 'overwrite';
    if (importSelectedBackupItems(backupData, selectedPaths, duplicateMode)) {
      closeBackupImportModal();
      alert(`선택한 항목을 '${getManualName()}' 메뉴얼에 불러왔습니다.`);
    }
  });
  footer.append(cancelButton, applyButton);

  dialog.append(header, controls, tree, footer);
  layer.appendChild(dialog);
  layer.addEventListener('click', closeBackupImportModal);
  document.body.appendChild(layer);
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
        openBackupImportModal(backupData);
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
