// ==================== 편집 관련 함수들 ====================
function getOpenItemPaths() {
  return Array.from(document.querySelectorAll('.accordion-item'))
    .filter(item => item.querySelector(':scope > .accordion-content')?.classList.contains('open'))
    .map(item => item.dataset.path.split('.').map(Number));
}

function reopenExistingPaths(paths, animate = true) {
  paths.forEach(path => {
    try {
      if (getItemByPath(path)) reopenPath(path, animate);
    } catch (error) {
      // 되돌린 상태에 더 이상 없는 경로는 열지 않습니다.
    }
  });
}

function undoLastEdit() {
  if (currentMode !== 'edit' || editHistoryState.undoStack.length === 0) return;

  const viewport = captureAccordionViewport();
  const openPaths = getOpenItemPaths();
  const previousSnapshot = editHistoryState.undoStack.pop();
  manualData = JSON.parse(previousSnapshot);
  ensureSystemSections();
  normalizeAllTables();
  editHistoryState.currentSnapshot = JSON.stringify(manualData);
  saveToLocalStorage(true);
  renderAll();
  reopenExistingPaths(openPaths, false);
  highlightCurrentSearchResult();
  restoreAccordionViewport(viewport);
}

function toggleMode() {
  const viewport = captureAccordionViewport();
  const openItems = getOpenItemRefs();

  if (currentMode === 'edit') {
    const manualName = document.getElementById('manual-name');
    const globalContent = document.getElementById('global-content');
    manualData.manualName = normalizeManualName(manualName.textContent);
    saveGlobalEditorContent(globalContent);
    renameActiveStorageKeyForManualName();
  }

  currentMode = currentMode === 'read' ? 'edit' : 'read';
  // A presentation change does not normalize data or rebuild the saved-manual list.
  updateLayoutResizerState({measure:false});
  renderGlobal();
  renderAccordion({normalize:false});
  reopenItemRefs(openItems,false);
  applyManualSearch();
  updateModeButton();
  restoreAccordionViewport(viewport);
  syncLayoutResizerPosition();
  syncManualThemeEffect();
}

function editItemTitle(path) {
  if (isReferenceRootPath(path) || isDictionaryRootPath(path)) return;
  const item = getItemByPath(path);
  const title = prompt("수정할 제목을 입력하세요.", item.title);
  if (!title || !title.trim()) return;

  const previousTitle = String(item.title || '').trim();
  const nextTitle = title.trim();
  if (nextTitle === previousTitle) return;

  if (isReferenceEntryPath(path)) {
    const siblingItems = getSiblingArrayByPath(path);
    const currentIndex = path[path.length - 1];
    const hasDuplicateReferenceName = siblingItems.some((sibling, index) => (
      index !== currentIndex && String(sibling.title || '').trim() === nextTitle
    ));
    if (hasDuplicateReferenceName) {
      alert("이미 같은 참조변수명이 있습니다.");
      return;
    }
    updateReferenceTokenNamesInManualData(previousTitle, nextTitle);
  }

  if (isDictionaryEntryPath(path) && !validateDictionaryTitle(nextTitle, item)) return;
  item.title = nextTitle;
  saveAndRender();
}

function addItemAtLevel(parentPath = []) {
  if (isReferenceEntryPath(parentPath) || isDictionaryEntryPath(parentPath)) {
    alert("참조와 사전의 개별 항목 안에는 하위 항목을 만들 수 없습니다.");
    return;
  }

  const title = prompt("이 계층 마지막에 추가할 메뉴 제목을 입력하세요:");
  if (!title || !title.trim()) return;

  if (parentPath.length > 0) {
    const parentItem = getItemByPath(parentPath);
    if (!Array.isArray(parentItem.children)) parentItem.children = [];
  }

  if (isDictionaryPath(parentPath) && !validateDictionaryTitle(title)) return;
  const openItems = getOpenItemRefs();
  getItemsArrayByPath(parentPath).push(createEmptyItem(title));
  saveAndRender(renderAccordion, openItems);
}

function deleteItem(path) {
  if (isReferenceRootPath(path) || isDictionaryRootPath(path)) {
    alert("참조와 사전의 최상위 항목은 삭제할 수 없습니다.");
    return;
  }

  if (!confirm("이 항목과 모든 하위 내용을 삭제하시겠습니까?")) return;

  const openItems = getOpenItemRefs();
  // 구형 백업에서도 삭제 후 다음 항목이 설명 항목으로 지정되지 않게 합니다.
  if (path.length === 1 && isDescriptionSection(getItemByPath(path))) {
    manualData.descriptionSectionMigrated = true;
  }
  getSiblingArrayByPath(path).splice(path[path.length - 1], 1);
  saveAndRender(renderAccordion, openItems);
}
