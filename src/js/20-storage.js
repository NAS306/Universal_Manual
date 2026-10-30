// ==================== LocalStorage ====================
function getStorageKeyFromHash() {
  const rawHash = window.location.hash.slice(1);
  if (!rawHash) return '';

  try {
    return decodeURIComponent(rawHash);
  } catch (err) {
    return rawHash;
  }
}

function setStorageKeyHash(key) {
  if (!key) return;
  const encodedKey = encodeURIComponent(key);
  if (window.location.hash.slice(1) !== encodedKey) {
    history.replaceState(null, '', `#${encodedKey}`);
  }
}

function getLocalStorageKeys() {
  return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter(Boolean)
    .filter(isValidManualStorageKey)
    .sort((a, b) => a.localeCompare(b, 'ko'));
}

function isManualDataShape(data) {
  const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
  if (!isObject(data) || !Array.isArray(data.menu)) return false;
  const pending = [...data.menu];
  while (pending.length) {
    const item = pending.pop();
    if (!isObject(item)) return false;
    if (item.title != null && typeof item.title !== 'string') return false;
    if (item.content != null && typeof item.content !== 'string') return false;
    if (item.children != null) {
      if (!Array.isArray(item.children)) return false;
      pending.push(...item.children);
    }
    if (item.tables != null) {
      if (!Array.isArray(item.tables)) return false;
      for (const table of item.tables) {
        if (!isObject(table)) return false;
        if (table.cells != null && (!Array.isArray(table.cells)
          || !table.cells.every(row => Array.isArray(row) && row.every(cell => typeof cell === 'string')))) return false;
      }
    }
  }
  return true;
}

function normalizeManualName(name) {
  return String(name ?? '').trim() || DEFAULT_MANUAL_NAME;
}

function createDefaultManualData() {
  const data = cloneDefaultManualData();
  data.manualName = DEFAULT_MANUAL_NAME;
  return data;
}

function migrateLegacyDefaultManualName() {
  if (activeStorageKey === DEFAULT_STORAGE_KEY && normalizeManualName(manualData.manualName) === LEGACY_DEFAULT_MANUAL_NAME) {
    manualData.manualName = DEFAULT_MANUAL_NAME;
  }
}

const DEFAULT_GLOBAL_TAB_TITLE = '전역 메뉴얼';
const LEGACY_GLOBAL_TAB_HELP_TEXT = '이곳은 전역 메뉴얼 자리입니다.\n텍스트만 입력 가능하며, 이미지/표/참조는 불가능합니다.\n\n\n';
const PREVIOUS_GLOBAL_TAB_HELP_TEXT = '이곳은 전역 메뉴얼 자리입니다.\n텍스트, 이미지, 참조를 입력할 수 있습니다.\n표는 표가 포함된 참조를 삽입하면 함께 표시됩니다.\n\n';

function normalizeGlobalTabContent(content) {
  const text = String(content ?? '');
  if (![LEGACY_GLOBAL_TAB_HELP_TEXT,PREVIOUS_GLOBAL_TAB_HELP_TEXT,"**공통 확인 · 전역 매뉴얼 예제**\n어떤 항목을 보더라도 항상 참고해야 할 필수 안내를 이곳에 둡니다. 이 예제에서는 아래 공통 원칙을 계속 보여 줍니다.\n\n{{예제_공통확인}}\n\n**이용 순서**\n- 오른쪽 [매뉴얼 사용 안내 → 0. 직접 체험하기]에서 읽기·수정 화면을 비교해 보세요.\n- 단계별 행동은 본문에서, 긴 이유와 배경은 연결된 사전에서 확인합니다.\n\n이 내용은 프로그램 연습용 예시이며 실제 업무 절차가 아닙니다. 실무에 맞는 필수 안내로 바꿔 사용하세요.",'이곳은 전역 메뉴얼 자리입니다.'].includes(text)) return text;
  const example = String(DEFAULT_DATA.globalManual || text);
  const references = (manualData.menu || []).find(item => item.isReferenceSection);
  const names = new Set((references?.children || []).map(item => String(item.title || '').trim()));
  // Do not introduce broken example variables into a customized manual without the examples.
  return Array.from(example.matchAll(/\{\{([^{}]+)\}\}/g),match => match[1].trim()).every(name => names.has(name))
    ? example : (text === LEGACY_GLOBAL_TAB_HELP_TEXT ? PREVIOUS_GLOBAL_TAB_HELP_TEXT : text);
}

function createGlobalTab(title = DEFAULT_GLOBAL_TAB_TITLE, content = '', images = []) {
  return {
    id: `global_tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: String(title || DEFAULT_GLOBAL_TAB_TITLE).trim() || DEFAULT_GLOBAL_TAB_TITLE,
    content: normalizeGlobalTabContent(content),
    images: normalizeImageList(images)
  };
}

function normalizeGlobalTab(tab, index = 0) {
  const fallbackTitle = index === 0 ? DEFAULT_GLOBAL_TAB_TITLE : `전역 ${index + 1}`;
  return {
    id: typeof tab?.id === 'string' && tab.id ? tab.id : `global_tab_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
    title: String(tab?.title || fallbackTitle).trim() || fallbackTitle,
    content: normalizeGlobalTabContent(tab?.content),
    images: normalizeImageList(tab?.images)
  };
}

function syncGlobalFieldsFromActiveTab() {
  const tabs = Array.isArray(manualData.globalTabs) ? manualData.globalTabs : [];
  const activeTab = tabs.find(tab => tab.id === manualData.activeGlobalTabId) || tabs[0];
  if (!activeTab) {
    manualData.globalManual = '';
    manualData.globalImages = [];
    return;
  }

  manualData.activeGlobalTabId = activeTab.id;
  activeTab.images = normalizeImageList(activeTab.images);
  manualData.globalManual = String(activeTab.content || '');
  manualData.globalImages = activeTab.images;
}

function ensureGlobalTabs() {
  if (!manualData || typeof manualData !== 'object') manualData = {};
  const legacyContent = String(manualData.globalManual || '');
  const legacyImages = normalizeImageList(manualData.globalImages);
  let tabs = Array.isArray(manualData.globalTabs)
    ? manualData.globalTabs.map((tab, index) => normalizeGlobalTab(tab, index))
    : [];

  if (!tabs.length) tabs = [createGlobalTab(DEFAULT_GLOBAL_TAB_TITLE, legacyContent, legacyImages)];

  const usedIds = new Set();
  tabs.forEach((tab, index) => {
    if (!tab.id || usedIds.has(tab.id)) {
      tab.id = `global_tab_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`;
    }
    usedIds.add(tab.id);
  });

  manualData.globalTabs = tabs;
  if (!tabs.some(tab => tab.id === manualData.activeGlobalTabId)) {
    manualData.activeGlobalTabId = tabs[0].id;
  }
  syncGlobalFieldsFromActiveTab();
  return tabs;
}

function getActiveGlobalTab() {
  ensureGlobalTabs();
  return manualData.globalTabs.find(tab => tab.id === manualData.activeGlobalTabId) || manualData.globalTabs[0];
}

function saveGlobalEditorContent(editor = document.getElementById('global-content')) {
  return commitImageEditorContent(editor, createGlobalImageEditorContext(editor));
}

function getManualName() { return normalizeManualName(manualData.manualName); }
function getSafeManualName() { return getManualName().replace(/[\\/:*?"<>|]/g, '_').trim() || '메뉴얼'; }
function getStorageKeyForManualName(name = getManualName()) { return `manualData(${normalizeManualName(name)})`; }
function getManualNameFromStorageKey(key) {
  const match = String(key || '').match(/^manualData\((.*)\)$/);
  return match ? normalizeManualName(match[1]) : '';
}
function syncManualNameElement() {
  const manualName = document.getElementById('manual-name');
  if (manualName) manualName.textContent = getManualName();
  document.querySelectorAll('[data-manual-pane="global"] h2').forEach(element=>{element.textContent = getManualName();});
}
function showManualSaveError() {
  let status = document.getElementById('manual-save-status');
  if (!status) {
    status = document.createElement('div');
    status.id = 'manual-save-status';
    status.setAttribute('role', 'alert');
    document.body.appendChild(status);
  }
  status.hidden = false;
  status.textContent = '자동 저장에 실패했습니다. 현재 내용은 이 화면에 남아 있습니다. 페이지를 닫기 전에 메뉴에서 파일로 내보내기를 해 주세요.';
}

function writeManualStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    const status = document.getElementById('manual-save-status');
    if (status) status.hidden = true;
    return true;
  } catch (error) {
    showManualSaveError();
    return false;
  }
}

function renameActiveStorageKeyForManualName() {
  // 예약 저장은 이름 입력란의 blur가 취소하지 않습니다.
  manualData.manualName = getManualName();
  const nextKey = getStorageKeyForManualName();
  if (nextKey === activeStorageKey) return true;
  if (localStorage.getItem(nextKey) !== null) {
    manualData.manualName = getManualNameFromStorageKey(activeStorageKey) || DEFAULT_MANUAL_NAME;
    syncManualNameElement();
    alert('같은 이름의 매뉴얼이 있어 이름을 변경하지 않았습니다. 편집 내용은 기존 매뉴얼에 저장합니다.');
    return true;
  }
  if (!writeManualStorage(nextKey, manualData)) {
    manualData.manualName = getManualNameFromStorageKey(activeStorageKey) || DEFAULT_MANUAL_NAME;
    syncManualNameElement();
    return false;
  }
  localStorage.removeItem(activeStorageKey);
  activeStorageKey = nextKey;
  setStorageKeyHash(activeStorageKey);
  refreshStorageKeyMenu();
  return true;
}

function isValidManualStorageKey(key) {
  try {
    const saved = localStorage.getItem(key);
    return Boolean(saved) && isManualDataShape(JSON.parse(saved));
  } catch (err) {
    return false;
  }
}

function updateActiveStorageKeyLabel() {
  const label = document.getElementById('active-storage-key');
  if (!label) return;
  label.textContent = `현재 작업 메뉴얼: ${getManualName()}`;
}

function getStorageKeyDisplayName(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    const name = String(data?.manualName || '').trim();
    if (name) return name;
  } catch (err) {
    // 목록에는 유효한 메뉴얼 데이터만 포함되므로 표시 이름만 기본값으로 처리합니다.
  }
  return getManualNameFromStorageKey(key) || '이름 없는 메뉴얼';
}

function refreshStorageKeyMenu() {
  const select = document.getElementById('storage-key-select');
  if (!select) return;

  const keys = getLocalStorageKeys();
  if (isValidManualStorageKey(activeStorageKey) && !keys.includes(activeStorageKey)) {
    keys.unshift(activeStorageKey);
  }

  select.replaceChildren();
  keys.forEach(key => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = getStorageKeyDisplayName(key);
    option.title = `저장 ID: ${key}`;
    option.selected = key === activeStorageKey;
    select.appendChild(option);
  });

  updateActiveStorageKeyLabel();
}

function selectStorageKey(key) {
  if (!key || key === activeStorageKey) return;

  if (!saveToLocalStorage(true)) return;
  const previousData = manualData;
  const previousKey = activeStorageKey;
  activeStorageKey = key;
  setStorageKeyHash(activeStorageKey);

  try {
    loadFromLocalStorage();
    saveToLocalStorage(true);
    resetEditHistory();
    renderAll();
  } catch (err) {
    manualData = previousData;
    activeStorageKey = previousKey;
    setStorageKeyHash(activeStorageKey);
    refreshStorageKeyMenu();
    alert('선택한 key의 데이터가 메뉴얼 형식이 아닙니다.');
  }
}

function createStorageKey() {
  const rawName = prompt(
    '새 메뉴얼의 이름을 입력하세요.\n현재 메뉴얼 내용이 복사되어 별도 작업본으로 저장됩니다.',
    getManualName()
  );
  if (rawName === null) return;

  const newName = rawName.trim();
  if (!newName) {
    alert('메뉴얼 이름을 입력해야 합니다.');
    return;
  }
  const newKey = getStorageKeyForManualName(newName);

  if (localStorage.getItem(newKey) !== null) {
    alert('같은 이름의 메뉴얼이 이미 있습니다. 다른 이름을 입력하세요.');
    return;
  }

  if (!saveToLocalStorage(true)) return;
  const copiedData = JSON.parse(JSON.stringify(manualData));
  copiedData.manualName = newName;
  if (!writeManualStorage(newKey, copiedData)) return;
  activeStorageKey = newKey;
  manualData = copiedData;
  setStorageKeyHash(activeStorageKey);
  saveToLocalStorage(true);
  resetEditHistory();
  renderAll();
  alert(`'${newName}' 메뉴얼 복사본을 만들었습니다.`);
}

const SAVE_DEBOUNCE_DELAY = 400;
let saveTimer = null;
const EDIT_HISTORY_LIMIT = 50;
const editHistoryState = { undoStack: [], currentSnapshot: null };

function resetEditHistory() {
  editHistoryState.undoStack = [];
  editHistoryState.currentSnapshot = JSON.stringify(manualData);
}

function recordEditHistory() {
  const snapshot = JSON.stringify(manualData);
  if (editHistoryState.currentSnapshot === null) {
    editHistoryState.currentSnapshot = snapshot;
    return;
  }
  if (snapshot === editHistoryState.currentSnapshot) return;

  editHistoryState.undoStack.push(editHistoryState.currentSnapshot);
  if (editHistoryState.undoStack.length > EDIT_HISTORY_LIMIT) editHistoryState.undoStack.shift();
  editHistoryState.currentSnapshot = snapshot;
}

function saveToLocalStorage(immediately = false) {
  ensureGlobalTabs();
  manualData.manualName = getManualName();
  // 화면 변경 이력은 즉시 기록하고 디스크 저장만 지연합니다.
  recordEditHistory();
  const save = () => {
    saveTimer = null;
    try {
      ensureGlobalTabs();
      manualData.manualName = getManualName();
      if (!renameActiveStorageKeyForManualName()) return false;
      const saved = writeManualStorage(activeStorageKey, manualData);
      updateActiveStorageKeyLabel();
      return saved;
    } catch (error) {
      showManualSaveError();
      return false;
    }
  };
  if (saveTimer) clearTimeout(saveTimer);
  if (immediately) return save();
  saveTimer = setTimeout(save, SAVE_DEBOUNCE_DELAY);
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem(activeStorageKey);
  if (!saved) {
    throw new Error('Storage key not found');
  }

  const parsedData = JSON.parse(saved);
  if (!isManualDataShape(parsedData)) {
    throw new Error('Invalid manual data');
  }
  manualData = parsedData;
  migrateLegacyDefaultManualName();
}

