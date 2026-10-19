// ==================== LocalStorage 삭제 ====================
function resetLocalStorage() {
  const firstConfirm = confirm(
    "⚠️ LocalStorage를 초기화하면 현재 메뉴얼의 모든 항목과 데이터가 삭제됩니다.\n계속하시겠습니까?"
  );
  if (!firstConfirm) return;

  const secondConfirm = confirm(
    "🚨 마지막 확인입니다.\n정말로 모든 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다."
  );
  if (!secondConfirm) return;

  const currentManualName = getManualNameFromStorageKey(activeStorageKey) || getManualName();
  manualData = createDefaultManualData();
  manualData.manualName = currentManualName;
  ensureSystemSections();
  normalizeAllTables();
  saveToLocalStorage(true);
  resetEditHistory();

  setStorageKeyHash(activeStorageKey);
  renderAll();

  alert("LocalStorage가 초기화되었습니다.");
}

// ==================== 초기화 ====================
window.onload = () => {
  const hashKey = getStorageKeyFromHash();
  const validKeys = getLocalStorageKeys();
  const shouldCreateDefaultManual = validKeys.length === 0;

  if (hashKey && isValidManualStorageKey(hashKey)) {
    activeStorageKey = hashKey;
  } else if (!shouldCreateDefaultManual) {
    activeStorageKey = validKeys[0];
  } else {
    activeStorageKey = DEFAULT_STORAGE_KEY;
    manualData = createDefaultManualData();
    saveToLocalStorage(true);
  }

  setStorageKeyHash(activeStorageKey);
  if (!shouldCreateDefaultManual) loadFromLocalStorage();

  if (!manualData.menu || manualData.menu.length === 0) {
    manualData.menu = cloneDefaultMenu();
  }
  ensureSystemSections();
  normalizeAllTables();
  saveToLocalStorage(true);
  resetEditHistory();

  initLayoutResizer();
  initAccordionScroll();
  initAppSettings();
  renderAll();

  const globalContent = document.getElementById('global-content');
  const searchInput = document.getElementById('manual-search-input');
  searchInput.addEventListener('input', () => { if(manualSearchTimer)clearTimeout(manualSearchTimer); document.getElementById('manual-search-count').textContent='검색 중…'; manualSearchTimer=setTimeout(()=>{manualSearchState.currentIndex=0;applyManualSearch(searchInput.value.trim().length>0);manualSearchTimer=null;},700); });
  document.addEventListener('keydown', event => { if(event.target.closest?.('dialog[open]'))return; if(!manualSearchState.results.length||event.ctrlKey||event.altKey||event.metaKey)return; if(event.defaultPrevented||event.target.closest('input,textarea,[contenteditable="true"],#layout-resizer')&&event.target!==searchInput)return; if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();moveSearchResult(event.key==='ArrowLeft'?-1:1);} });
  document.addEventListener('keydown', event => {
    if (event.target.closest?.('dialog[open]')) return;
    if (currentMode !== 'edit' || event.isComposing || event.shiftKey || event.altKey
      || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
    // 검색창 등 일반 입력란의 기본 되돌리기는 가로채지 않습니다.
    if (event.target.closest?.('input, textarea, select')) return;
    event.preventDefault();
    undoLastEdit();
  });
  const manualName = document.getElementById('manual-name');
  manualName.addEventListener('input', () => {
    if (currentMode === 'edit') { manualData.manualName = normalizeManualName(manualName.textContent); saveToLocalStorage(); }
  });
  manualName.addEventListener('blur', () => {
    if (currentMode === 'edit') { manualData.manualName = normalizeManualName(manualName.textContent); renameActiveStorageKeyForManualName(); }
  });
  const globalEditorContext = createGlobalImageEditorContext();
  globalContent.addEventListener('input', event => {
    if (currentMode === 'edit') {
      handleImageEditorChange(globalContent, globalEditorContext, event);
    }
  });
  bindReferenceAutocomplete(globalContent, () => addGlobalImage(globalContent));
  globalContent.addEventListener('blur', () => {
    if (currentMode === 'edit') saveGlobalEditorContent(globalContent);
    saveToLocalStorage(true);
  });
  window.addEventListener('pagehide', () => {
    if (currentMode === 'edit') saveGlobalEditorContent(globalContent);
    saveToLocalStorage(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (currentMode === 'edit') saveGlobalEditorContent(globalContent);
      saveToLocalStorage(true);
    }
  });
};

window.addEventListener('hashchange', () => {
  const hashKey = getStorageKeyFromHash();
  if (!hashKey || hashKey === activeStorageKey) return;
  selectStorageKey(hashKey);
});
