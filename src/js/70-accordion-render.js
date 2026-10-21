// ==================== 아코디언 헤더 색상 ====================
const ACCORDION_HEADER_BASE_COLOR = [95, 114, 145];
const ACCORDION_HEADER_LIGHTEN_STEP = -0.2;
const ACCORDION_HEADER_MAX_LIGHTEN = 0.8;
const REFERENCE_HEADER_COLOR = [63, 124, 104];
const DESCRIPTION_HEADER_COLOR = [116, 99, 149];

function mixRgb(from, to, amount) {
  return from.map((value, idx) => Math.round(value + (to[idx] - value) * amount));
}

function rgbToCss(rgb) {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function applyHeaderDepthColor(header, depth) {
  const mixAmount = Math.min(Math.max(0, depth) * Math.abs(ACCORDION_HEADER_LIGHTEN_STEP), ACCORDION_HEADER_MAX_LIGHTEN);
  const targetColor = ACCORDION_HEADER_LIGHTEN_STEP < 0 ? [0, 0, 0] : [255, 255, 255];
  const bg = mixRgb(ACCORDION_HEADER_BASE_COLOR, targetColor, mixAmount);
  const hoverBg = mixRgb(bg, [0, 0, 0], 0.18);

  header.style.setProperty('--accordion-header-bg', rgbToCss(bg));
  header.style.setProperty('--accordion-header-hover-bg', rgbToCss(hoverBg));
}

function applySpecialHeaderTheme(header, path) {
  const rootItem = manualData.menu?.[path[0]];

  let themeColor = null;
  if (isReferenceSection(rootItem)) {
    themeColor = REFERENCE_HEADER_COLOR;
  } else if (isDictionarySection(rootItem)) {
    themeColor = [55, 104, 151];
  } else if (isDescriptionSection(rootItem)) {
    themeColor = DESCRIPTION_HEADER_COLOR;
  }

  if (!themeColor) return;

  const depthAmount = Math.min((path.length - 1) * 0.16, 0.46);
  const bg = mixRgb(themeColor, [255, 255, 255], depthAmount);
  header.style.setProperty('--accordion-header-bg', rgbToCss(bg));
  header.style.setProperty('--accordion-header-hover-bg', rgbToCss(mixRgb(bg, [0, 0, 0], 0.18)));
}

// ==================== 아코디언 아이템 생성 ====================
function appendDomButton(parent, { text, className = '', title = '', onClick }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  if (className) button.className = className;
  if (title) button.title = title;
  if (onClick) button.addEventListener('click', onClick);
  parent.appendChild(button);
  return button;
}

function createLevelAddButton(parentPath) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'level-add-btn';
  const parentTitle = parentPath.length ? getItemByPath(parentPath).title : '';
  button.textContent = parentPath.length ? '+ 하위 항목 추가' : '+ 최상위 항목 추가';
  const description = parentPath.length ? `‘${parentTitle}’ 아래에 하위 항목 추가` : '전체 메뉴얼에 최상위 항목 추가';
  button.title = description;
  button.setAttribute('aria-label', description);
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    addItemAtLevel(parentPath);
  });
  return button;
}

function appendLevelAddButton(parent, parentPath) {
  if (currentMode !== 'edit') return;

  const row = document.createElement('div');
  row.className = 'level-add-row';
  row.dataset.parentPath = parentPath.join('.');
  const context = document.createElement('span');
  context.className = 'level-add-context';
  context.textContent = parentPath.length ? `‘${getItemByPath(parentPath).title}’ 아래` : '전체 메뉴얼';
  context.title = context.textContent;
  row.appendChild(context);
  row.appendChild(createLevelAddButton(parentPath));
  parent.appendChild(row);
}

function appendItemLevel(parent, items = [], parentPath = []) {
  (Array.isArray(items) ? items : []).forEach((item, idx) => {
    parent.appendChild(createItem(item, [...parentPath, idx]));
  });
  appendLevelAddButton(parent, parentPath);
}

function createTableElement(table, path, tableIndex) {
  normalizeTable(table);

  const wrap = document.createElement('div');
  wrap.className = 'manual-table-wrap';
  wrap.addEventListener('click', (e) => e.stopPropagation());
  wrap.addEventListener('pointerdown', (e) => e.stopPropagation());

  if (currentMode === 'edit') {
    const toolbar = document.createElement('div');
    toolbar.className = 'table-toolbar';
    appendDomButton(toolbar, { text: '행 추가', onClick: () => addTableRow(path, tableIndex) });
    appendDomButton(toolbar, { text: '행 삭제', onClick: () => removeTableRow(path, tableIndex) });
    appendDomButton(toolbar, { text: '열 추가', onClick: () => addTableCol(path, tableIndex) });
    appendDomButton(toolbar, { text: '열 삭제', onClick: () => removeTableCol(path, tableIndex) });
    appendDomButton(toolbar, { text: '표 삭제', className: 'table-delete-btn', onClick: () => deleteTable(path, tableIndex) });
    wrap.appendChild(toolbar);
  }

  const tableEl = document.createElement('table');
  tableEl.className = 'manual-table';
  tableEl.dataset.tableIndex = tableIndex;
  const spannedCells = new Set();

  table.cells.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    row.forEach((cellText, colIndex) => {
      if (spannedCells.has(getTableCellKey(rowIndex, colIndex))) return;

      const span = getTableCellSpan(table, rowIndex, colIndex);
      const cell = document.createElement('td');
      cell.dataset.rowIndex = rowIndex;
      cell.dataset.colIndex = colIndex;
      if (span.rowspan > 1) cell.rowSpan = span.rowspan;
      if (span.colspan > 1) cell.colSpan = span.colspan;
      applyTableCellStyle(cell, table.cellColors[rowIndex][colIndex]);

      const coveredRows = Math.min(span.rowspan, table.rows - rowIndex);
      const coveredCols = Math.min(span.colspan, table.cols - colIndex);
      for (let rowOffset = 0; rowOffset < coveredRows; rowOffset++) {
        for (let colOffset = 0; colOffset < coveredCols; colOffset++) {
          if (rowOffset === 0 && colOffset === 0) continue;
          spannedCells.add(getTableCellKey(rowIndex + rowOffset, colIndex + colOffset));
        }
      }

      if (currentMode === 'edit') {
        const textEditor = document.createElement('div');
        textEditor.className = 'manual-table-cell-text';
        textEditor.dataset.imageEditor = 'true';
        textEditor.dataset.dictionaryEnabled = String(!isReferenceSection(manualData.menu[path[0]]) && !isDictionaryPath(path));
        textEditor.contentEditable = "true";
        renderContentWithImages(textEditor, cellText, table.cellImages[rowIndex][colIndex], true);
        const cellEditorContext = createTableCellImageEditorContext(path, tableIndex, rowIndex, colIndex);
        textEditor.addEventListener('input', event => {
          applyTableCellStyle(cell, table.cellColors[rowIndex][colIndex]);
          handleImageEditorChange(textEditor, cellEditorContext, event);
        });
        bindReferenceAutocomplete(textEditor, () => addTableCellImage(path, tableIndex, rowIndex, colIndex, textEditor));
        cell.appendChild(textEditor);
        cell.addEventListener('pointerdown', event => {
          if (event.button !== 2) return;
          clearTableSelection();
          tableSelection.active = true;
          tableSelection.path = [...path];
          tableSelection.tableIndex = tableIndex;
          tableSelection.start = { row: rowIndex, col: colIndex };
          updateTableSelection(cell);
        });
        cell.addEventListener('pointerenter', () => {
          if (tableSelection.active && tableSelection.path?.join('.') === path.join('.') && tableSelection.tableIndex === tableIndex) updateTableSelection(cell);
        });
        cell.addEventListener('contextmenu', event => {
          tableSelection.active = false;
          showTableCellContextMenu(event, cell, path, tableIndex, rowIndex, colIndex);
        });
      } else {
        renderContentWithImages(cell, cellText, table.cellImages[rowIndex][colIndex]);
        if (!isReferenceSection(manualData.menu[path[0]]) && !isDictionaryPath(path)) linkDictionaryTerms(cell);
      }
      tr.appendChild(cell);
    });
    tableEl.appendChild(tr);
  });

  wrap.appendChild(tableEl);
  return wrap;
}

function createItem(item, path) {
  const isReferenceRoot = isReferenceRootPath(path) || isDictionaryRootPath(path);
  const isLeafEntry = isReferenceEntryPath(path) || isDictionaryEntryPath(path);
  const itemDiv = document.createElement('div');
  itemDiv.className = 'accordion-item';
  itemDiv.dataset.path = path.join('.');
  itemDiv.dataset.itemId = item.id;

  const header = document.createElement('div');
  header.className = isReferenceRoot ? 'accordion-header reference-root-header' : 'accordion-header';
  applyHeaderDepthColor(header, path.length - 1);
  applySpecialHeaderTheme(header, path);

  const titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.className = 'accordion-toggle';
  titleButton.setAttribute('aria-expanded', 'false');
  titleButton.setAttribute('aria-controls', `accordion-panel-${path.join('-')}`);
  titleButton.textContent = item.title;
  header.appendChild(titleButton);
  header.appendChild(createAccordionTitleConveyor(item.title));

  // 두 모드에서 같은 헤더 치수를 유지하고, 열람 중에는 조작과 포커스를 차단합니다.
  if (!isReferenceRoot) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'edit-btn-container';
    buttonContainer.inert = currentMode !== 'edit';
    buttonContainer.setAttribute('aria-hidden', String(currentMode !== 'edit'));

    appendDomButton(buttonContainer, { text: '제목 수정', className: 'action-btn btn-edit', onClick: () => editItemTitle(path) });
    appendDomButton(buttonContainer, { text: '표 추가', className: 'action-btn btn-add', onClick: () => addTable(path) });
    appendDomButton(buttonContainer, { text: '삭제', className: 'action-btn btn-delete', onClick: () => deleteItem(path) });

    header.appendChild(buttonContainer);
  }

  const contentDiv = document.createElement('div');
  contentDiv.className = 'accordion-content';
  contentDiv.id = `accordion-panel-${path.join('-')}`;

  registerAccordionBody(contentDiv,item,path);

  if (!isLeafEntry && (currentMode === 'edit' || item.children?.length > 0)) {
    const subContainer = document.createElement('div');
    subContainer.className = 'accordion-level';
    appendItemLevel(subContainer, item.children, path);
    contentDiv.appendChild(subContainer);
  }

  // 클릭 이벤트 - 모든 계층에 동일하게 적용 (같은 레벨 하나만 열림)
  header.addEventListener('click', (e) => {
    if (dragState.suppressClick) {
      e.preventDefault();
      e.stopPropagation();
      dragState.suppressClick = false;
      return;
    }

    if (e.target.closest('.edit-btn-container')) return;

    const isCurrentlyOpen = contentDiv.classList.contains('open');

    if (isCurrentlyOpen) {
      // 열린 상태에서 클릭 → 닫기
      setAccordionExpanded(contentDiv, false);
      closeAllChildren(contentDiv);  // 하위 모두 닫기
      releaseAccordionHeaderAlignment(header);
    } else {
      // 닫힌 상태에서 클릭 → 열기
      closeSiblings(contentDiv);     // 같은 레벨 다른 항목 모두 닫기
      setAccordionExpanded(contentDiv, true);
      requestAccordionHeaderAlignment(header);
    }
  });

  // 수정 모드에서 헤더를 길게 누르면 같은 계층 내 이동 가능
  header.addEventListener('pointerdown', (e) => {
    if (currentMode !== 'edit') return;
    if (e.target.closest('.edit-btn-container')) return;
    if (isReferenceRoot) return;

    dragState.pending = true;
    dragState.active = false;
    dragState.path = [...path];
    dragState.header = header;
    dragState.element = itemDiv;
    dragState.parentEl = itemDiv.parentElement;
    dragState.pointerId = e.pointerId;
    dragState.startX = e.clientX;
    dragState.startY = e.clientY;
    dragState.suppressClick = false;

    if (dragState.longPressTimer) clearTimeout(dragState.longPressTimer);

    dragState.longPressTimer = setTimeout(() => {
      startDrag();
    }, LONG_PRESS_DELAY);
  });

  header.addEventListener('pointerup', () => {
    if (dragState.longPressTimer) {
      clearTimeout(dragState.longPressTimer);
      dragState.longPressTimer = null;
    }

    if (dragState.pending && !dragState.active) {
      cancelDragState();
    }
  });

  header.addEventListener('pointercancel', () => {
    if (dragState.longPressTimer) {
      clearTimeout(dragState.longPressTimer);
      dragState.longPressTimer = null;
    }
    clearDragStyles();
    cancelDragState();
  });

  itemDiv.appendChild(header);
  itemDiv.appendChild(contentDiv);
  return itemDiv;
}

// ==================== 렌더링 ====================
function renderAccordion({normalize = true} = {}) {
  resetAccordionHeaderAlignment();
  if (normalize) ensureSystemSections();
  const container = document.getElementById('main-accordion');
  const fragment = document.createDocumentFragment();

  appendItemLevel(fragment, manualData.menu);

  container.replaceChildren(fragment);
  refreshDictionaryPanel();
  accordionElementByPath.clear();
  container.querySelectorAll('.accordion-item').forEach(item => accordionElementByPath.set(item.dataset.path, item));
}
