// ==================== 공통 메뉴얼 ====================
function renderGlobalTabs() {
  const tabBar = document.getElementById('global-tab-bar');
  if (!tabBar) return;

  ensureGlobalTabs();
  tabBar.replaceChildren();
  manualData.globalTabs.forEach((tab, index) => {
    const tabEl = document.createElement('div');
    tabEl.className = `global-tab${tab.id === manualData.activeGlobalTabId ? ' active' : ''}`;
    tabEl.dataset.tabId = tab.id;
    tabEl.setAttribute('role', 'tab');
    tabEl.setAttribute('aria-selected', tab.id === manualData.activeGlobalTabId ? 'true' : 'false');
    tabEl.tabIndex = 0;
    tabEl.title = currentMode === 'edit' ? '더블 클릭으로 이름 변경' : tab.title;
    tabEl.addEventListener('click', () => switchGlobalTab(tab.id));
    tabEl.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      switchGlobalTab(tab.id);
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
    addButton.addEventListener('click', addGlobalTab);
    tabBar.appendChild(addButton);
  }
}

function switchGlobalTab(tabId) {
  ensureGlobalTabs();
  if (!manualData.globalTabs.some(tab => tab.id === tabId) || tabId === manualData.activeGlobalTabId) return;

  if (currentMode === 'edit') saveGlobalEditorContent();
  manualData.activeGlobalTabId = tabId;
  syncGlobalFieldsFromActiveTab();
  saveToLocalStorage(true);
  renderGlobal();
  applyManualSearch();
}

function addGlobalTab() {
  if (currentMode !== 'edit') return;

  saveGlobalEditorContent();
  const rawTitle = prompt('새 전역 메뉴얼 탭 이름을 입력하세요.', `전역 ${manualData.globalTabs.length + 1}`);
  if (rawTitle === null) return;

  const title = rawTitle.trim();
  if (!title) {
    alert('탭 이름을 입력해주세요.');
    return;
  }

  const tab = createGlobalTab(title, '', []);
  manualData.globalTabs.push(tab);
  manualData.activeGlobalTabId = tab.id;
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
  renderGlobalTabs();
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

  saveGlobalEditorContent();
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
  const manualName = document.getElementById('manual-name');
  const container = document.getElementById('global-content');
  const activeTab = getActiveGlobalTab();
  manualName.textContent = getManualName();
  manualName.contentEditable = currentMode === 'edit' ? 'true' : 'false';
  renderGlobalTabs();

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
