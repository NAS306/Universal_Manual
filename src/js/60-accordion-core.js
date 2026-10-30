// 펼침 상태와 접근성 상태는 클릭·검색·복원·드래그에서 함께 갱신합니다.
function setAccordionExpanded(contentDiv, expanded, {animate = true} = {}) {
  if (!contentDiv) return;
  if (expanded) ensureAccordionBody(contentDiv);
  const changed = contentDiv.classList.contains('open') !== expanded;
  if (!changed) return;
  const previousHeight = animate && !expanded ? contentDiv.getBoundingClientRect().height : 0;
  contentDiv.classList.toggle('open', expanded);
  const header = contentDiv.previousElementSibling;
  header?.classList.toggle('active', expanded);
  header?.querySelector('.accordion-toggle')?.setAttribute('aria-expanded', String(expanded));
  updateAccordionTitleConveyor(header,expanded);
  if (changed && animate) animateAccordionExpansion(contentDiv, expanded, previousHeight);
}

// ==================== 같은 레벨 아코디언 하나만 열리게 하는 함수 ====================
function closeSiblings(contentDiv) {
  const parentContainer = contentDiv.parentElement.parentElement; // accordion-item의 부모 (상위 content 또는 main-accordion)
  
  // 같은 레벨의 모든 accordion-content 찾기
  const siblingContents = parentContainer.querySelectorAll(':scope > .accordion-item > .accordion-content');
  
  siblingContents.forEach(sibling => {
    if (sibling !== contentDiv) {
      setAccordionExpanded(sibling, false);
    }
  });
}

// ==================== 아코디언 하나를 닫을 때 하위 아코디언 모두 닫기 ====================
function closeAllChildren(contentDiv) {
  const childContents = contentDiv.querySelectorAll('.accordion-content');
  childContents.forEach(child => {
    setAccordionExpanded(child, false);
  });
}

// ==================== 드래그 관련 유틸 ====================
function getItemsArrayByPath(path = []) {
  let target = manualData.menu;
  for (const index of path) target = target[index].children;
  return target;
}

function getSiblingArrayByPath(path) {
  return getItemsArrayByPath(path.slice(0, -1));
}

function createEmptyItem(title) {
  return { title: title.trim(), content: "", tables: [], images: [], children: [] };
}

function getOpenItemRefs() {
  const openItems = [];
  getActiveAccordionRoot().querySelectorAll('.accordion-item').forEach(itemEl => {
    const content = itemEl.querySelector(':scope > .accordion-content');
    if (!content?.classList.contains('open')) return;

    const path = itemEl.dataset.path.split('.').map(Number);
    try {
      const item = getItemByPath(path);
      if (item && !openItems.includes(item)) openItems.push(item);
    } catch (error) {
      // The DOM may briefly be out of sync while a structural edit is being applied.
    }
  });
  return openItems;
}

const accordionElementsByRoot = new WeakMap();
function getAccordionElement(path) { return accordionElementsByRoot.get(getActiveAccordionRoot())?.get(path.join('.')); }

function findItemPath(targetItem, items = manualData.menu, basePath = []) {
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const path = [...basePath, index];
    if (item === targetItem) return path;

    const childPath = findItemPath(targetItem, item.children || [], path);
    if (childPath) return childPath;
  }
  return null;
}

function reopenItemRefs(openItems, animate = true) {
  openItems.forEach(item => {
    const path = findItemPath(item);
    if (path) reopenPath(path,animate);
  });
}

function saveAndRender(renderFn = renderAccordion, openItems = getOpenItemRefs()) {
  ensureSystemSections();
  saveToLocalStorage();
  renderFn();
  reopenItemRefs(openItems);
  applyManualSearch();
}

function reopenPath(path, animate = true) {
  for (let depth = 1; depth <= path.length; depth++) {
    const itemEl = getAccordionElement(path.slice(0, depth));
    if (!itemEl) continue;

    const content = itemEl.querySelector(':scope > .accordion-content');
    setAccordionExpanded(content, true,{animate});
  }
}

function saveRenderAndReopen(path) {
  ensureSystemSections();
  saveToLocalStorage();
  renderAccordion();
  reopenPath(path);
  applyManualSearch();
}

// 표 생성
function normalizeTable(table) {
  const rowCount = Math.max(Number(table?.rows) || 1, 1);
  const colCount = Math.max(Number(table?.cols) || 1, 1);
  const colors = Array.from({ length: rowCount }, (_, rowIndex) => {
    const sourceRow = Array.isArray(table?.cellColors?.[rowIndex]) ? table.cellColors[rowIndex] : [];
    return Array.from({ length: colCount }, (_, colIndex) => ['blue', 'red', 'green'].includes(sourceRow[colIndex]) ? sourceRow[colIndex] : '');
  });
  const merges = table?.cellMerges && typeof table.cellMerges === 'object' && !Array.isArray(table.cellMerges)
    ? { ...table.cellMerges }
    : {};
  const cells = Array.from({ length: rowCount }, (_, rowIndex) => {
    const sourceRow = Array.isArray(table?.cells?.[rowIndex]) ? table.cells[rowIndex] : [];
    return Array.from({ length: colCount }, (_, colIndex) => {
      const legacy = extractLegacyTableDecorators(sourceRow[colIndex]);
      if (legacy.color) colors[rowIndex][colIndex] ||= legacy.color;
      if (!merges[getTableCellKey(rowIndex, colIndex)] && (legacy.rows > 1 || legacy.cols > 1)) {
        merges[getTableCellKey(rowIndex, colIndex)] = { rows: legacy.rows, cols: legacy.cols };
      }
      return legacy.text;
    });
  });

  table.rows = rowCount;
  table.cols = colCount;
  table.cells = cells;
  table.cellColors = colors;
  table.cellMerges = merges;
  table.cellImages = Array.from({ length: rowCount }, (_, rowIndex) => {
    const sourceRow = Array.isArray(table?.cellImages?.[rowIndex]) ? table.cellImages[rowIndex] : [];
    return Array.from({ length: colCount }, (_, colIndex) => normalizeImageList(sourceRow[colIndex]));
  });
  return table;
}

function normalizeImageList(images) {
  return Array.isArray(images)
    ? images.filter(image => image && typeof image.url === 'string' && image.url.trim()).map(image => ({
        id: typeof image.id === 'string' && image.id ? image.id : `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        url: image.url.trim(),
        width: Math.max(10, Math.min(100, Number(image.width) || 65)),
        offset: Number.isFinite(Number(image.offset)) ? Math.max(0, Number(image.offset)) : Number.MAX_SAFE_INTEGER
      }))
    : [];
}

function ensureItemImages(item) {
  item.images = normalizeImageList(item.images);
  return item.images;
}

function normalizeAllImages(items = manualData.menu, includeGlobal = true) {
  if (!Array.isArray(items)) return;
  items.forEach(item => {
    ensureItemImages(item);
    normalizeAllImages(item.children, false);
  });
  if (includeGlobal) ensureGlobalTabs();
}

function closeImageLightbox() {
  document.getElementById('image-lightbox')?.remove();
}

function openImageLightbox(url) {
  closeImageLightbox();
  const layer = document.createElement('div');
  layer.id = 'image-lightbox';
  layer.className = 'image-lightbox';
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-label', '이미지 확대 보기');
  const image = document.createElement('img');
  image.src = url;
  image.alt = '';
  image.addEventListener('error', closeImageLightbox);
  layer.addEventListener('click', event => { if (event.target === layer) closeImageLightbox(); });
  image.addEventListener('dblclick', closeImageLightbox);
  layer.appendChild(image);
  document.body.appendChild(layer);
}

function createStoredImageElement(image) {
  const wrap = document.createElement('div');
  wrap.className = `embedded-image-wrap${currentMode === 'edit' ? ' editable' : ''}`;
  wrap.dataset.imageId = image.id;
  wrap.draggable = false;
  wrap.style.setProperty('--image-width', `${image.width}%`);
  wrap.contentEditable = 'false';
  const img = document.createElement('img');
  img.className = 'embedded-image';
  img.draggable = false;
  img.contentEditable = 'false';
  img.src = image.url;
  img.alt = '';
  img.addEventListener('dragstart', event => event.preventDefault());
  img.addEventListener('error', () => {
    const fallback = document.createElement('span');
    fallback.className = 'embedded-image-fallback';
    fallback.contentEditable = 'false';
    fallback.textContent = '[이미지 링크]';
    img.replaceWith(fallback);
  });
  if (currentMode === 'read') img.addEventListener('dblclick', () => openImageLightbox(image.url));
  wrap.appendChild(img);
  if (currentMode === 'edit') {
    wrap.addEventListener('contextmenu', event => {
      const editor = wrap.parentElement?.closest('[data-image-editor="true"]');
      if (editor) {
        const range = document.createRange();
        range.setStartAfter(wrap);
        range.collapse(true);
        referenceContextMenuState.editor = editor;
        referenceContextMenuState.range = range;
        referenceContextMenuState.offset = getLogicalOffsetForDomPosition(editor, range.startContainer, range.startOffset);
      }
      showUnifiedContextMenu(event, {
        editor,
        keepReferenceRange: true,
        onDeleteImage: () => {
          wrap.remove();
          editor?.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    });
    const handle = document.createElement('span');
    handle.className = 'image-resize-handle';
    handle.contentEditable = 'false';
    handle.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      const parentWidth = wrap.parentElement?.clientWidth || 0;
      if (!parentWidth) return;
      const startX = event.clientX;
      const startWidth = wrap.getBoundingClientRect().width;
      handle.setPointerCapture?.(event.pointerId);
      const move = moveEvent => {
        moveEvent.preventDefault();
        const nextWidth = Math.max(parentWidth * .1, Math.min(parentWidth, startWidth + moveEvent.clientX - startX));
        image.width = Math.round((nextWidth / parentWidth) * 1000) / 10;
        wrap.style.setProperty('--image-width', `${image.width}%`);
      };
      const end = endEvent => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', end);
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', end);
        document.removeEventListener('pointercancel', end);
        try { handle.releasePointerCapture?.(endEvent.pointerId); } catch (err) {}
        wrap.parentElement?.closest('[data-image-editor="true"]')?.dispatchEvent(new Event('input', { bubbles: true }));
        saveToLocalStorage(true);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
      document.addEventListener('pointermove', move, { passive: false });
      document.addEventListener('pointerup', end);
      document.addEventListener('pointercancel', end);
    });
    wrap.appendChild(handle);
  }
  return wrap;
}

function appendTextHtml(container, text) {
  if (!text) return;
  const fragment = document.createElement('span');
  fragment.innerHTML = markdownToHtml(text);
  container.append(...fragment.childNodes);
}

function createEditableReferenceToken(token, referenceName) {
  const name = referenceName.trim();
  const wrap = document.createElement('span');
  wrap.className = 'editable-reference-token';
  wrap.contentEditable = 'false';
  wrap.dataset.referenceToken = token;
  wrap.dataset.referenceName = name;
  wrap.textContent = token;
  wrap.title = `참조 원본: ${name} (참조 항목에서 수정)`;
  return wrap;
}

function findNextEditableReferenceToken(text, cursor) {
  for (let index = cursor; index < text.length; index++) {
    if (text.startsWith('{{', index)) {
      const end = text.indexOf('}}', index + 2);
      if (end !== -1) {
        const name = text.slice(index + 2, end);
        if (name.trim() && !/[{}]/.test(name)) {
          return { type: 'reference', start: index, end: end + 2, token: text.slice(index, end + 2), name };
        }
      }
    }
  }

  return null;
}

function findNextEditableSourceToken(text, cursor) {
  const referenceToken = findNextEditableReferenceToken(text, cursor);
  const markdownToken = findNextMarkdownToken(text, cursor);
  if (!referenceToken) return markdownToken;
  if (!markdownToken) return referenceToken;
  return referenceToken.start <= markdownToken.start ? referenceToken : markdownToken;
}

function createEditableMarkdownMarker(marker) {
  return document.createTextNode(marker);
}

function appendEditableSourceText(container, text) {
  if (!text) return;
  let cursor = 0;
  let token;

  while ((token = findNextEditableSourceToken(text, cursor)) !== null) {
    if (token.start > cursor) container.appendChild(document.createTextNode(text.slice(cursor, token.start)));
    if (token.type === 'reference') {
      container.appendChild(createEditableReferenceToken(token.token, token.name));
    } else {
      const formatted = document.createElement(token.type === 'strong' ? 'strong' : 'em');
      formatted.className = 'editable-md-preview';
      container.appendChild(createEditableMarkdownMarker(token.marker));
      appendEditableSourceText(formatted, text.slice(token.bodyStart, token.bodyEnd));
      container.appendChild(formatted);
      container.appendChild(createEditableMarkdownMarker(token.marker));
    }
    cursor = token.end;
  }

  if (cursor < text.length) container.appendChild(document.createTextNode(text.slice(cursor)));
}

function renderContentWithImages(container, text, images, editable = false) {
  const ordered = [...(Array.isArray(images) ? images : [])].sort((a, b) => a.offset - b.offset);
  let cursor = 0;
  ordered.forEach(image => {
    const offset = Math.min(String(text || '').length, Math.max(cursor, Number(image.offset) || 0));
    const segment = String(text || '').slice(cursor, offset);
    if (editable) appendEditableSourceText(container, segment);
    else appendTextHtml(container, segment);
    container.appendChild(createStoredImageElement(image));
    cursor = offset;
  });
  const tail = String(text || '').slice(cursor);
  if (editable) appendEditableSourceText(container, tail);
  else appendTextHtml(container, tail);
}

function refreshEditableContent(container, text, images, caretOffset = getCaretTextOffset(container)) {
  container.replaceChildren();
  renderContentWithImages(container, text, images, true);
  ensureTrailingEditorCaret(container);
  if (Number.isFinite(caretOffset)) {
    setCaretTextOffset(container, Math.min(caretOffset, String(text || '').length));
  }
}

function refreshEditablePreview(container) {
  if (!container?.isConnected || container.contentEditable !== 'true') return;
  const text = getEditorLogicalText(container);
  const images = collectEditorImagesForFormatting(container);
  refreshEditableContent(container, text, images, null);
}

function getRenderedImageWidth(node, fallbackWidth) {
  const rawWidth = node?.style?.getPropertyValue('--image-width') || '';
  const width = Number.parseFloat(rawWidth);
  return Number.isFinite(width)
    ? Math.max(10, Math.min(100, Math.round(width * 10) / 10))
    : Math.max(10, Math.min(100, Number(fallbackWidth) || 65));
}

function serializeContentWithImages(editor, images) {
  const byId = new Map((images || []).map(image => [image.id, image]));
  const used = [];
  let text = '';
  const walk = node => {
    if (node.nodeType === Node.TEXT_NODE) { text += node.nodeValue; return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (isEditableReferenceTokenNode(node)) {
      text += node.dataset.referenceToken || '';
      return;
    }
    if (node.classList.contains('editor-tail-caret')) return;
    const isBlock = ['DIV', 'P', 'LI'].includes(node.tagName);
    if (isBlock && text && !text.endsWith('\n')) text += '\n';
    if (node.classList.contains('embedded-image-wrap')) {
      const image = byId.get(node.dataset.imageId);
      if (image) {
        image.offset = text.length;
        image.width = getRenderedImageWidth(node, image.width);
        used.push(image);
      }
      return;
    }
    if (node.tagName === 'BR') { text += '\n'; return; }
    node.childNodes.forEach(walk);
    if (isBlock && node.nextSibling && !text.endsWith('\n')) text += '\n';
  };
  editor.childNodes.forEach(walk);
  return { text, images: used };
}

function insertPlainTextAtSelection(text) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  const editor = node.parentElement?.closest('[contenteditable="true"]');
  ensureTrailingEditorCaret(editor);
  range.setStart(node, node.nodeValue.length);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function handleEditablePlainEnter(event) {
  if (event.defaultPrevented
    || event.key !== 'Enter'
    || event.shiftKey
    || event.ctrlKey
    || event.altKey
    || event.metaKey
    || shouldDeferEditableRefresh(event.currentTarget, event)) return;
  if (referenceAutocompleteState.editor === event.currentTarget && !getOrCreateReferenceAutocomplete().hidden) return;
  event.preventDefault();
  insertPlainTextAtSelection('\n');
  const inputEvent = typeof InputEvent === 'function'
    ? new InputEvent('input', { bubbles: true, inputType: 'insertLineBreak', data: '\n' })
    : new Event('input', { bubbles: true });
  event.currentTarget.dispatchEvent(inputEvent);
}

function handleEditablePlainTextPaste(event) {
  const text = event.clipboardData?.getData('text/plain');
  if (typeof text !== 'string') return;
  event.preventDefault();
  insertPlainTextAtSelection(text.replace(/\r\n?/g, '\n'));
  const inputEvent = typeof InputEvent === 'function'
    ? new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: text })
    : new Event('input', { bubbles: true });
  event.currentTarget.dispatchEvent(inputEvent);
}

function requestImageUrl(onSubmit) {
  const url = prompt('이미지 링크(URL)를 입력하세요:');
  if (!url?.trim()) return;
  onSubmit(url.trim());
}

function insertImageAtCaret(editor, range, images, url, onChange) {
  if (!editor || !range || !editor.contains(range.startContainer)) return;
  const image = { id: `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, url, width: 65, offset: 0 };
  images.push(image);
  const node = createStoredImageElement(image);
  range.collapse(true);
  range.insertNode(node);
  placeCaretAfterInsertedNode(node, range);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  onChange();
}

function commitImageEditorContent(editor, context) {
  if (!editor || !context?.getImages || !context?.applySaved) return { text: '', images: [] };
  const saved = serializeContentWithImages(editor, context.getImages());
  context.applySaved(saved);
  return saved;
}

function editorContainsRawReferenceToken(editor) {
  const rawReferenceNames = [];
  const walk = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const pattern = /{{\s*([^{}]+?)\s*}}/g;
      let match;
      while ((match = pattern.exec(node.nodeValue)) !== null) rawReferenceNames.push(match[1].trim());
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE
      || isEditableReferenceTokenNode(node)
      || node.classList.contains('embedded-image-wrap')) return;
    node.childNodes.forEach(walk);
  };
  editor.childNodes.forEach(walk);
  if (!rawReferenceNames.length) return false;
  const referenceMap = getReferenceMap();
  return rawReferenceNames.some(name => referenceMap.has(name));
}

function handleImageEditorChange(editor, context, event = null, options = {}) {
  const saved = commitImageEditorContent(editor, context);
  saveToLocalStorage(Boolean(options.forceSave));
  const canRefresh = !shouldDeferEditableRefresh(editor, event);
  const shouldRefresh = options.refresh === true
    || (canRefresh && (
      editorContainsRawReferenceToken(editor)
      || !isEditableMarkdownPreviewCurrent(editor, saved.text)
    ));
  if (shouldRefresh && canRefresh) {
    refreshEditableContent(editor, saved.text, saved.images);
  }
  return saved;
}

function insertImageIntoEditor(editor, context, options = {}) {
  requestImageUrl(url => {
    const images = context.getImages();
    insertImageAtCaret(editor, resolveContextMenuInsertionRange(editor), images, url, () => {
      handleImageEditorChange(editor, context, null, { forceSave: true, refresh: Boolean(options.refreshAfterInsert) });
    });
  });
}

function createItemImageEditorContext(path) {
  return {
    getImages: () => ensureItemImages(getItemByPath(path)),
    applySaved: saved => {
      const item = getItemByPath(path);
      item.content = saved.text;
      item.images = saved.images;
    }
  };
}

function createGlobalImageEditorContext(editor) {
  const getTab = () => editor ? getGlobalEditorTab(editor) : getActiveGlobalTab();
  return {
    getImages: () => {
      const activeTab = getTab();
      activeTab.images = normalizeImageList(activeTab.images);
      return activeTab.images;
    },
    applySaved: saved => {
      const activeTab = getTab();
      activeTab.content = saved.text;
      activeTab.images = saved.images;
      syncGlobalFieldsFromActiveTab();
      if (editor) getGlobalPanes().forEach(pane=>{
        const other = pane.querySelector('[data-global-editor]');
        if (!pane.hidden && other !== editor && getGlobalPaneTab(pane).id === activeTab.id) renderGlobalPane(pane);
      });
    }
  };
}

function createTableCellImageEditorContext(path, tableIndex, rowIndex, colIndex) {
  return {
    getImages: () => {
      const table = normalizeTable(ensureItemTables(getItemByPath(path))[tableIndex]);
      return table.cellImages[rowIndex][colIndex];
    },
    applySaved: saved => {
      const table = normalizeTable(ensureItemTables(getItemByPath(path))[tableIndex]);
      table.cells[rowIndex][colIndex] = saved.text;
      table.cellImages[rowIndex][colIndex] = saved.images;
    }
  };
}

function addItemImage(path, editor) {
  insertImageIntoEditor(editor, createItemImageEditorContext(path), { refreshAfterInsert: true });
}

function addGlobalImage(editor) {
  insertImageIntoEditor(editor, createGlobalImageEditorContext(editor));
}

function addTableCellImage(path, tableIndex, rowIndex, colIndex, editor) {
  insertImageIntoEditor(editor, createTableCellImageEditorContext(path, tableIndex, rowIndex, colIndex));
}

// 이전 버전 백업의 태그만 메타데이터로 이관한다. 새 입력·렌더링에서는 태그를 사용하지 않는다.
function extractLegacyTableDecorators(cellText) {
  let text = String(cellText ?? '');
  const result = { text, rows: 1, cols: 1, color: '' };
  let match;
  while ((match = text.match(/^\s*<(?:([rc])(\d+)|(tint))>/i))) {
    if (match[3]) result.color ||= 'blue';
    else if (match[1].toLowerCase() === 'r') result.rows = Math.max(Number(match[2]) || 1, 1);
    else result.cols = Math.max(Number(match[2]) || 1, 1);
    text = text.slice(match[0].length);
  }
  result.text = text.replace(/^\s+/, '');
  return result;
}

function getTableCellSpan(table, rowIndex, colIndex) {
  const merge = table.cellMerges?.[getTableCellKey(rowIndex, colIndex)];
  return merge ? { rowspan: merge.rows, colspan: merge.cols } : { rowspan: 1, colspan: 1 };
}

function getTableCellKey(rowIndex, colIndex) {
  return `${rowIndex}:${colIndex}`;
}

function applyTableCellStyle(cell, color = '') {
  ['blue', 'red', 'green'].forEach(name => cell.classList.toggle(`cell-color-${name}`, color === name));
}

function setTableCellColor(path, tableIndex, rowIndex, colIndex, color) {
  const table = normalizeTable(ensureItemTables(getItemByPath(path))[tableIndex]);
  table.cellColors[rowIndex][colIndex] = color;
  saveToLocalStorage();
}

function showTableCellContextMenu(event, cell, path, tableIndex, rowIndex, colIndex) {
  if (currentMode !== 'edit') return;
  const editor = cell.querySelector('.manual-table-cell-text');
  showUnifiedContextMenu(event, {
    editor,
    onAddImage: () => addTableCellImage(path, tableIndex, rowIndex, colIndex, editor),
    tableContext: { cell, path, tableIndex, rowIndex, colIndex }
  });
}

function closeEditorContextMenu() {
  document.getElementById('editor-context-menu')?.remove();
}

function closeContextMenusOnOutsidePointer(event) {
  if (event.target.closest?.('#editor-context-menu, #reference-autocomplete, #markdown-selection-menu')) return;
  closeEditorContextMenu();
  closeReferenceAutocomplete();
  closeMarkdownSelectionMenu();
  if (!event.target.closest?.('.manual-table td')) clearTableSelection();
}

const tableSelection = { active: false, path: null, tableIndex: -1, start: null, end: null, cells: [] };
function clearTableSelection() { tableSelection.cells.forEach(cell => cell.classList.remove('cell-selected')); Object.assign(tableSelection, { active:false, path:null, tableIndex:-1, start:null, end:null, cells:[] }); }
function updateTableSelection(cell) {
  if (!tableSelection.start) return;
  const row = Number(cell.dataset.rowIndex), col = Number(cell.dataset.colIndex);
  tableSelection.end = { row, col };
  tableSelection.cells.forEach(item => item.classList.remove('cell-selected'));
  const minRow=Math.min(tableSelection.start.row,row), maxRow=Math.max(tableSelection.start.row,row), minCol=Math.min(tableSelection.start.col,col), maxCol=Math.max(tableSelection.start.col,col);
  const table = cell.closest('.manual-table');
  tableSelection.cells = Array.from(table.querySelectorAll('td')).filter(item => { const r=Number(item.dataset.rowIndex), c=Number(item.dataset.colIndex); const selected=r>=minRow&&r<=maxRow&&c>=minCol&&c<=maxCol; item.classList.toggle('cell-selected',selected); return selected; });
}
function getTableSelectionRange(path, tableIndex) {
  if (tableSelection.path?.join('.') !== path.join('.') || tableSelection.tableIndex !== tableIndex || !tableSelection.start || !tableSelection.end) return null;
  return { row:Math.min(tableSelection.start.row,tableSelection.end.row), col:Math.min(tableSelection.start.col,tableSelection.end.col), rows:Math.abs(tableSelection.start.row-tableSelection.end.row)+1, cols:Math.abs(tableSelection.start.col-tableSelection.end.col)+1 };
}
function mergeSelectedCells(path, tableIndex) {
  const range=getTableSelectionRange(path,tableIndex); if(!range || (range.rows===1&&range.cols===1)) return;
  const table=normalizeTable(ensureItemTables(getItemByPath(path))[tableIndex]);
  table.cellMerges[getTableCellKey(range.row, range.col)] = { rows: range.rows, cols: range.cols };
  clearTableSelection(); saveRenderAndReopen(path);
}

function unmergeTableCell(path, tableIndex, rowIndex, colIndex) {
  const table = normalizeTable(ensureItemTables(getItemByPath(path))[tableIndex]);
  delete table.cellMerges[getTableCellKey(rowIndex, colIndex)];
  saveRenderAndReopen(path);
}
function ensureItemTables(item) {
  if (!Array.isArray(item.tables)) item.tables = [];
  item.tables.forEach(normalizeTable);
  return item.tables;
}

function normalizeAllTables(items = manualData.menu) {
  if (!Array.isArray(items)) return;
  items.forEach(item => {
    ensureItemTables(item);
    normalizeAllTables(item.children);
  });
}

function createEmptyTable(rows, cols) {
  return normalizeTable({
    rows,
    cols,
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''))
  });
}

function addTable(path) {
  if (isReferenceRootPath(path) || isDictionaryRootPath(path)) return;
  const rows = Number(prompt("표의 행 개수를 입력하세요.", "3"));
  if (!Number.isInteger(rows) || rows < 1) return;

  const cols = Number(prompt("표의 열 개수를 입력하세요.", "3"));
  if (!Number.isInteger(cols) || cols < 1) return;

  const item = getItemByPath(path);
  ensureItemTables(item).push(createEmptyTable(rows, cols));
  saveRenderAndReopen(path);
}

function deleteTable(path, tableIndex) {
  if (!confirm("이 표를 삭제하시겠습니까?")) return;
  const item = getItemByPath(path);
  ensureItemTables(item).splice(tableIndex, 1);
  saveRenderAndReopen(path);
}

function addTableRow(path, tableIndex) {
  const table = normalizeTable(ensureItemTables(getItemByPath(path))[tableIndex]);
  table.cells.push(Array.from({ length: table.cols }, () => ''));
  table.rows += 1;
  saveRenderAndReopen(path);
}

function removeTableRow(path, tableIndex) {
  const table = normalizeTable(ensureItemTables(getItemByPath(path))[tableIndex]);
  if (table.rows <= 1) return;
  table.cells.pop();
  table.rows -= 1;
  saveRenderAndReopen(path);
}

function addTableCol(path, tableIndex) {
  const table = normalizeTable(ensureItemTables(getItemByPath(path))[tableIndex]);
  table.cells.forEach(row => row.push(''));
  table.cols += 1;
  saveRenderAndReopen(path);
}

function removeTableCol(path, tableIndex) {
  const table = normalizeTable(ensureItemTables(getItemByPath(path))[tableIndex]);
  if (table.cols <= 1) return;
  table.cells.forEach(row => row.pop());
  table.cols -= 1;
  saveRenderAndReopen(path);
}

function clearDragStyles() {
  if (dragState.element) {
    dragState.element.style.opacity = '';
    dragState.element.style.outline = '';
    dragState.element.style.background = '';
  }
  document.querySelectorAll('.drag-drop-before,.drag-drop-after,.drag-drop-inside').forEach(el => el.classList.remove('drag-drop-before','drag-drop-after','drag-drop-inside'));
}

function clearDragHoverTimer() { if (dragState.hoverTimer) clearTimeout(dragState.hoverTimer); dragState.hoverTimer = null; dragState.hoverTarget = null; }
function setDragDropTarget(element, zone) {
  const header = element.querySelector(':scope > .accordion-header'); if (!header) return;
  const mode = zone === 'middle' ? 'inside' : zone;
  if (dragState.dropTarget?.element === element && dragState.dropTarget.mode === mode) return;
  clearDragHoverTimer(); document.querySelectorAll('.drag-drop-before,.drag-drop-after,.drag-drop-inside').forEach(el => el.classList.remove('drag-drop-before','drag-drop-after','drag-drop-inside'));
  header.classList.add(`drag-drop-${mode}`); dragState.dropTarget = { element, mode };
  if (zone === 'middle') { dragState.hoverTarget = element; dragState.hoverTimer = setTimeout(() => { if (dragState.active && dragState.hoverTarget === element) { setAccordionExpanded(element.querySelector(':scope > .accordion-content'), true); } }, 700); }
}
function moveItemToDropTarget(fromPath, drop) {
  const moved = getItemByPath(fromPath); const targetPath = drop.element.dataset.path.split('.').map(Number); const target = getItemByPath(targetPath);
  if (!moved || !target || moved === target || dragState.element.contains(drop.element) || isReferenceRootPath(fromPath) || isDictionaryRootPath(fromPath) || isReferenceRootPath(targetPath) || isDictionaryRootPath(targetPath) && drop.mode !== 'inside') return;
  if (drop.mode === 'inside' && (isReferenceEntryPath(targetPath) || isDictionaryEntryPath(targetPath))) return;
  const dictionaryDestination = isDictionaryPath(targetPath) && (drop.mode === 'inside' || targetPath.length > 1);
  if (dictionaryDestination && !validateDictionaryTitle(moved.title, moved)) return;
  if (isDictionarySection(moved) || isReferenceSection(moved)) return;
  const openItems = getOpenItemRefs(); getItemsArrayByPath(fromPath.slice(0,-1)).splice(fromPath.at(-1),1);
  const path = findItemPath(target); if (!path) return;
  if (drop.mode === 'inside') { target.children ||= []; target.children.push(moved); }
  else { const siblings = getItemsArrayByPath(path.slice(0,-1)); siblings.splice(path.at(-1) + (drop.mode === 'after' ? 1 : 0), 0, moved); }
  saveAndRender(renderAccordion, openItems);
}

function startDrag() {
  if (!dragState.pending || !dragState.header || !dragState.element) return;

  dragState.active = true;
  dragState.suppressClick = true;

  dragState.element.style.opacity = '0.6';
  dragState.element.style.outline = '2px dashed #60a5fa';
  dragState.element.style.background = '#eff6ff';
}

function cancelDragState() {
  if (dragState.longPressTimer) {
    clearTimeout(dragState.longPressTimer);
    dragState.longPressTimer = null;
  }

  dragState.pending = false;
  dragState.active = false;
  dragState.path = null;
  dragState.header = null;
  dragState.element = null;
  dragState.parentEl = null;
  dragState.pointerId = null;
  dragState.startX = 0;
  dragState.startY = 0;
  dragState.dropTarget = null;
  clearDragHoverTimer();
}

function onGlobalPointerMove(e) {
  if (dragState.pending && !dragState.active) {
    const dx = Math.abs(e.clientX - dragState.startX);
    const dy = Math.abs(e.clientY - dragState.startY);

    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
      if (dragState.longPressTimer) {
        clearTimeout(dragState.longPressTimer);
        dragState.longPressTimer = null;
      }
      dragState.pending = false;
    }
    return;
  }

  if (!dragState.active) return;
  if (e.pointerId !== dragState.pointerId) return;

  e.preventDefault();

  const draggingEl = dragState.element;
  if (!draggingEl) return;
  const parentItem = dragState.parentEl?.closest('.accordion-item');
  if (parentItem && dragState.path?.length > 1) { const r=parentItem.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){setAccordionExpanded(parentItem.querySelector(':scope > .accordion-content'), false);} }
  const target = document.elementFromPoint(e.clientX,e.clientY)?.closest('.accordion-item');
  if (!target || target === draggingEl || draggingEl.contains(target) || target.closest('.accordion-container') !== draggingEl.closest('.accordion-container')) return;
  const path = target.dataset.path.split('.').map(Number); if (isReferenceRootPath(path) || isDictionaryRootPath(path)) return;
  const rect = target.querySelector(':scope > .accordion-header')?.getBoundingClientRect(); if (!rect) return;
  const position=(e.clientY-rect.top)/rect.height;
  const zone=position<1/3?'before':position>2/3?'after':'middle';
  setDragDropTarget(target,zone);
}

function endDrag(e) {
  if (dragState.pending && !dragState.active) {
    if (dragState.longPressTimer) {
      clearTimeout(dragState.longPressTimer);
      dragState.longPressTimer = null;
    }
    cancelDragState();
    return;
  }

  if (!dragState.active) return;
  if (e && e.pointerId !== dragState.pointerId) return;

  const originalPath = dragState.path ? [...dragState.path] : null;

  if (dragState.dropTarget && originalPath) {
    clearDragStyles();
    moveItemToDropTarget(originalPath, dragState.dropTarget);
  } else {
    clearDragStyles();
  }

  cancelDragState();
}

// 전역 포인터 이벤트는 한 번만 등록
document.addEventListener('pointermove', onGlobalPointerMove, { passive: false });
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

