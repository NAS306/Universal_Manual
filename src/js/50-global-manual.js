// ==================== 공통 메뉴얼 ====================
function getGlobalPanes() { return [...document.querySelectorAll('[data-manual-pane="global"]')]; }
function getGlobalPaneTab(pane) {
  ensureGlobalTabs();
  const id = pane.dataset.paneCopy === '0' ? manualData.activeGlobalTabId : pane.dataset.selectedTabId;
  const tab = manualData.globalTabs.find(tab=>tab.id === id) || getActiveGlobalTab();
  pane.dataset.selectedTabId = tab.id;
  return tab;
}
function getGlobalEditorTab(editor) {
  return manualData.globalTabs.find(tab=>tab.id === editor?.dataset.tabId) || getActiveGlobalTab();
}
function renderGlobalTabs(pane = getGlobalPanes()[0]) {
  const tabBar = pane.querySelector('.global-tabs');
  if (!tabBar) return;

  ensureGlobalTabs();
  tabBar.replaceChildren();
  const selectedTab = getGlobalPaneTab(pane);
  manualData.globalTabs.forEach((tab, index) => {
    const tabEl = document.createElement('div');
    tabEl.className = `global-tab${tab.id === selectedTab.id ? ' active' : ''}`;
    tabEl.dataset.tabId = tab.id;
    tabEl.setAttribute('role', 'tab');
    tabEl.setAttribute('aria-selected', tab.id === selectedTab.id ? 'true' : 'false');
    tabEl.tabIndex = 0;
    tabEl.title = currentMode === 'edit' ? '더블 클릭으로 이름 변경' : tab.title;
    tabEl.addEventListener('click', () => switchGlobalTab(tab.id,pane));
    tabEl.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      switchGlobalTab(tab.id,pane);
    });
    tabEl.addEventListener('dblclick', event => {
      event.preventDefault();
      renameGlobalTab(tab.id);
    });

    const title = document.createElement('span');
    title.className = 'global-tab-title';
    title.textContent = tab.title || `${DEFAULT_GLOBAL_TAB_TITLE} ${index + 1}`;
    tabEl.appendChild(title);

    if (manualData.globalTabs.length > 1) {
      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'global-tab-close';
      closeButton.textContent = 'x';
      closeButton.title = '탭 삭제';
      closeButton.disabled = currentMode !== 'edit';
      closeButton.setAttribute('aria-hidden', String(currentMode !== 'edit'));
      closeButton.addEventListener('click', event => {
        event.stopPropagation();
        deleteGlobalTab(tab.id);
      });
      tabEl.appendChild(closeButton);
    }

    tabBar.appendChild(tabEl);
  });

  // 추가 버튼 자리도 유지하여 모드 전환 시 탭의 줄 높이가 바뀌지 않게 합니다.
  {
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'global-tab-add';
    addButton.textContent = '+';
    addButton.title = '전역 메뉴얼 탭 추가';
    addButton.disabled = currentMode !== 'edit';
    addButton.setAttribute('aria-hidden', String(currentMode !== 'edit'));
    addButton.addEventListener('click',()=>addGlobalTab(pane));
    tabBar.appendChild(addButton);
  }
}

function switchGlobalTab(tabId, pane = getGlobalPanes()[0]) {
  ensureGlobalTabs();
  if (!manualData.globalTabs.some(tab => tab.id === tabId) || tabId === getGlobalPaneTab(pane).id) return;
  if (currentMode === 'edit') saveGlobalEditorContent(pane.querySelector('[data-global-editor]'));
  pane.dataset.selectedTabId = tabId;
  if (pane.dataset.paneCopy === '0') {
    manualData.activeGlobalTabId = tabId;
    syncGlobalFieldsFromActiveTab();
    saveToLocalStorage(true);
  }
  renderGlobalPane(pane);
  applyManualSearch();
}

function addGlobalTab(pane = getGlobalPanes()[0]) {
  if (currentMode !== 'edit') return;

  saveGlobalEditors();
  const rawTitle = prompt('새 전역 메뉴얼 탭 이름을 입력하세요.', `전역 ${manualData.globalTabs.length + 1}`);
  if (rawTitle === null) return;

  const title = rawTitle.trim();
  if (!title) {
    alert('탭 이름을 입력해주세요.');
    return;
  }

  const tab = createGlobalTab(title, '', []);
  manualData.globalTabs.push(tab);
  pane.dataset.selectedTabId = tab.id;
  if (pane.dataset.paneCopy === '0') manualData.activeGlobalTabId = tab.id;
  syncGlobalFieldsFromActiveTab();
  saveToLocalStorage(true);
  renderGlobal();
  applyManualSearch();
}

function renameGlobalTab(tabId = manualData.activeGlobalTabId) {
  if (currentMode !== 'edit') return;

  ensureGlobalTabs();
  const tab = manualData.globalTabs.find(item => item.id === tabId);
  if (!tab) return;

  const rawTitle = prompt('전역 메뉴얼 탭 이름을 입력하세요.', tab.title);
  if (rawTitle === null) return;

  const title = rawTitle.trim();
  if (!title) {
    alert('탭 이름을 입력해주세요.');
    return;
  }

  tab.title = title;
  saveToLocalStorage(true);
  getGlobalPanes().forEach(pane=>renderGlobalTabs(pane));
}

function deleteGlobalTab(tabId) {
  if (currentMode !== 'edit') return;

  ensureGlobalTabs();
  if (manualData.globalTabs.length <= 1) {
    alert('전역 메뉴얼 탭은 최소 1개가 필요합니다.');
    return;
  }

  const index = manualData.globalTabs.findIndex(tab => tab.id === tabId);
  if (index === -1) return;
  if (!confirm(`'${manualData.globalTabs[index].title}' 탭을 삭제하시겠습니까?`)) return;

  saveGlobalEditors();
  manualData.globalTabs.splice(index, 1);
  if (tabId === manualData.activeGlobalTabId) {
    const nextTab = manualData.globalTabs[Math.max(0, index - 1)] || manualData.globalTabs[0];
    manualData.activeGlobalTabId = nextTab.id;
  }
  syncGlobalFieldsFromActiveTab();
  saveToLocalStorage(true);
  renderGlobal();
  applyManualSearch();
}

function renderGlobal() {
  getGlobalPanes().filter(pane=>pane.dataset.paneCopy === '0' || !pane.hidden).forEach(renderGlobalPane);
  syncGlobalFieldsFromActiveTab();
}
function renderGlobalPane(pane) {
  const manualName = pane.querySelector('h2');
  const container = pane.querySelector('[data-global-editor]');
  const activeTab = getGlobalPaneTab(pane);
  const scrollTop = container.scrollTop;
  container.dataset.tabId = activeTab.id;
  manualName.textContent = getManualName();
  manualName.contentEditable = currentMode === 'edit' ? 'true' : 'false';
  getGlobalPanes().forEach(pane=>renderGlobalTabs(pane));
  
  if (currentMode === 'read') {
    container.contentEditable = "false";
    delete container.dataset.imageEditor;
    container.ondragover = null;
    container.ondrop = null;
    activeTab.images = normalizeImageList(activeTab.images);
    container.replaceChildren();
    renderContentWithImages(container, activeTab.content, activeTab.images);
  } else {
    container.contentEditable = "true";
    container.dataset.imageEditor = 'true';
    container.ondragover = event => event.preventDefault();
    container.ondrop = event => event.preventDefault();
    activeTab.images = normalizeImageList(activeTab.images);
    container.replaceChildren();
    renderContentWithImages(container, activeTab.content, activeTab.images, true);
  }
  syncGlobalFieldsFromActiveTab();
}

function getItemByPath(path) {
  let target = manualData.menu;
  for (let i = 0; i < path.length - 1; i++) {
    target = target[path[i]].children;
  }
  return target[path[path.length - 1]];
}


function saveGlobalEditors() {
  getGlobalPanes().forEach(pane=>{
    const editor = pane.querySelector('[data-global-editor]');
    if (!pane.hidden && editor.contentEditable === 'true') saveGlobalEditorContent(editor);
  });
}
function initGlobalEditors() {
  getGlobalPanes().forEach(pane=>{
    const name = pane.querySelector('h2');
    const editor = pane.querySelector('[data-global-editor]');
    name.addEventListener('input',()=>{
      if (currentMode !== 'edit') return;
      manualData.manualName = normalizeManualName(name.textContent);
      getGlobalPanes().filter(other=>other !== pane).forEach(other=>{other.querySelector('h2').textContent = getManualName();});
      saveToLocalStorage();
    });
    name.addEventListener('blur',()=>{if(currentMode === 'edit') renameActiveStorageKeyForManualName();});
    editor.addEventListener('input',event=>{
      if (currentMode === 'edit') handleImageEditorChange(editor,createGlobalImageEditorContext(editor),event);
    });
    bindReferenceAutocomplete(editor,()=>addGlobalImage(editor));
    editor.addEventListener('blur',()=>{
      if (currentMode === 'edit') saveGlobalEditorContent(editor);
      saveToLocalStorage(true);
    });
  });
}
