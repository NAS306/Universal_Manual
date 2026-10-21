// ==================== 텍스트 서식: 강조·기울임·리스트 ====================
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderMarkdownLine(line) {
  const trimmed = line.trimStart();
  if (/^-\s/.test(trimmed)) {
    return line.replace(/^(\s*)-\s/, '$1• ');
  }
  return line;
}

function renderMarkdownFormatting(text) {
  const source = String(text || '');
  const parts = [];
  let cursor = 0;
  let token;

  while ((token = findNextMarkdownToken(source, cursor)) !== null) {
    parts.push(escapeHtml(source.slice(cursor, token.start)));
    const tagName = token.type === 'strong' ? 'strong' : 'em';
    const body = renderMarkdownFormatting(source.slice(token.bodyStart, token.bodyEnd));
    parts.push(`<${tagName}>${body}</${tagName}>`);
    cursor = token.end;
  }

  parts.push(escapeHtml(source.slice(cursor)));
  return parts.join('');
}

function markdownToHtml(text, seenReferences = new Set()) {
  if (!text) return '';
  let html = renderMarkdownFormatting(text);
  html = html.split('\n').map(renderMarkdownLine).join('<br>');
  return replaceReferenceTokens(html, seenReferences);
}

function isReferenceSection(item) {
  return Boolean(item?.isReferenceSection) || String(item?.title || '').trim() === getDefaultReferenceSectionTitle();
}

function isReferenceRootPath(path) {
  return path.length === 1 && isReferenceSection(manualData.menu?.[path[0]]);
}

function isReferenceEntryPath(path) {
  return path.length === 2 && isReferenceRootPath([path[0]]);
}

function isDescriptionSection(item) {
  return Boolean(item?.isDescriptionSection);
}

function ensureReferenceSection() {
  if (!manualData || typeof manualData !== 'object') manualData = {};
  if (!Array.isArray(manualData.menu)) manualData.menu = [];
  const defaultReferenceSection = getDefaultReferenceSection();

  let referenceIndex = manualData.menu.findIndex(isReferenceSection);
  if (referenceIndex === -1) {
    referenceIndex = manualData.menu.push(cloneDefaultReferenceSection()) - 1;
  }

  const referenceItem = manualData.menu[referenceIndex];
  referenceItem.title = defaultReferenceSection.title;
  referenceItem.isReferenceSection = true;
  if (!referenceItem.content) referenceItem.content = defaultReferenceSection.content || '';
  referenceItem.tables = Array.isArray(referenceItem.tables) ? referenceItem.tables : cloneDefaultDataValue(defaultReferenceSection.tables || []);
  referenceItem.images = normalizeImageList(referenceItem.images || defaultReferenceSection.images);
  if (!Array.isArray(referenceItem.children)) referenceItem.children = [];
  referenceItem.children.forEach(child => {
    if (!Array.isArray(child.tables)) child.tables = [];
    child.children = [];
  });

}

function ensureDescriptionSection() {
  if (!Array.isArray(manualData.menu)) return;
  if (manualData.menu.some(isDescriptionSection)) return;
  if (manualData.descriptionSectionMigrated) return;

  const firstContentItem = manualData.menu.find(item => !isReferenceSection(item) && !isDictionarySection(item));
  if (firstContentItem) firstContentItem.isDescriptionSection = true;
  manualData.descriptionSectionMigrated = true;
}

function removeRetiredRecommendationData() {
  if (!manualData || typeof manualData !== 'object') return;
  delete manualData.sttRecommendation;

  function cleanItems(items) {
    if (!Array.isArray(items)) return;
    items.forEach(item => {
      if (!item || typeof item !== 'object') return;
      delete item.sttKeywords;
      cleanItems(item.children);
    });
  }
  cleanItems(manualData.menu);

  const descriptionItem = Array.isArray(manualData.menu)
    ? manualData.menu.find(isDescriptionSection)
    : null;
  if (!descriptionItem) return;

  descriptionItem.content = String(descriptionItem.content || '')
    .replace(/\n\n\*\*6\. 키워드와 STT 추천\*\*[\s\S]*?(?=\n\n\*\*7\. 파일 백업\*\*|$)/, '')
    .replace('**7. 파일 백업**', '**6. 파일 백업**')
    .replace('**8. 다른 메뉴얼 열기와 복사**', '**7. 다른 메뉴얼 열기와 복사**')
    .replace('**9. 메뉴얼 이름과 초기화**', '**8. 메뉴얼 이름과 초기화**')
    .replace('**10. 전역 메뉴얼 탭**', '**9. 전역 메뉴얼 탭**');
}

function ensureSystemSections() {
  ensureReferenceSection();
  ensureDescriptionSection();
  removeRetiredRecommendationData();
  ensureDefaultDescriptionGuide();
  ensureDictionarySection();
  ensureSystemSectionOrder();
  normalizeAllImages();
}

// Keep ordinary entries in their existing order, followed by reference and dictionary roots.
// Reuse the menu array and item objects so open-item restoration and imported data remain intact.
function ensureSystemSectionOrder() {
  const menu = manualData.menu;
  const ordinary = [], references = [], dictionaries = [];
  for (const item of menu) {
    if (isReferenceSection(item)) references.push(item);
    else if (isDictionarySection(item)) dictionaries.push(item);
    else ordinary.push(item);
  }
  let index = 0;
  for (const group of [ordinary,references,dictionaries]) {
    for (const item of group) {
      if (menu[index] !== item) menu[index] = item;
      index++;
    }
  }
}

// 사전은 기존 menu 트리에 저장하여 기존 백업과 같은 형식을 사용합니다.
function isDictionarySection(item) { return item?.isDictionarySection === true; }
function isDictionaryRootPath(path) { return path.length === 1 && isDictionarySection(manualData.menu?.[path[0]]); }
function isDictionaryPath(path) { return path.length > 0 && isDictionarySection(manualData.menu?.[path[0]]); }
function isDictionaryEntryPath(path) { return path.length > 1 && isDictionaryPath(path); }
function ensureDictionarySection() {
  if (!manualData.menu.some(isDictionarySection)) manualData.menu.push({
    title: '사전', isDictionarySection: true,
    content: '하위 항목의 제목에 키워드를, 본문에 상세 설명을 작성하세요. 여러 키워드는 &로 구분합니다. 읽기 모드에서 일반 아코디언 본문의 같은 용어가 자동 연결됩니다.',
    children: [], tables: [], images: []
  });
  // 초기 v4.6 데이터나 가져온 트리는 내용을 버리지 않고 용어 목록으로 펼칩니다.
  manualData.menu.filter(isDictionarySection).forEach(root => {
    if (Array.isArray(root.children) && root.children.every(item => Array.isArray(item.children) && item.children.length === 0)) return;
    const entries = [];
    const collect = items => (Array.isArray(items) ? items : []).forEach(item => {
      entries.push(item);
      const children = item.children;
      item.children = [];
      collect(children);
    });
    collect(root.children);
    root.children = entries;
  });
}
function getDictionaryKeywords(title) {
  return [...new Set(String(title || '').split('&').map(keyword => keyword.trim()).filter(Boolean))];
}
function getDictionaryEntries(excludedItem = null) {
  const entries = new Map();
  (manualData.menu || []).filter(isDictionarySection).forEach(root => {
    (root.children || []).forEach(item => {
      if (item === excludedItem) return;
      getDictionaryKeywords(item.title).forEach(keyword => {
        // Imported collisions retain the existing first-entry precedence.
        if (!entries.has(keyword)) entries.set(keyword, item);
      });
    });
  });
  return entries;
}
function validateDictionaryTitle(title, excludedItem = null) {
  const keywords = getDictionaryKeywords(title);
  if (!keywords.length) {
    alert('사전 제목에 키워드를 하나 이상 입력하세요. 여러 키워드는 &로 구분합니다.');
    return false;
  }
  const entries = getDictionaryEntries(excludedItem);
  const duplicate = keywords.find(keyword => entries.has(keyword));
  if (duplicate) {
    alert('이미 다른 사전 항목에 등록된 키워드입니다: ' + duplicate);
    return false;
  }
  return true;
}
// 한 번에 하나의 용어 집합만 보관합니다. 제목/순서가 바뀌면 즉시 새로 컴파일합니다.
let dictionaryPatternCache = {names: [], pattern: null};
function createDictionaryMatchPattern(names) {
  const current = Array.from(names).filter(Boolean);
  const cached = dictionaryPatternCache;
  if (current.length === cached.names.length && current.every((name,index) => name === cached.names[index])) return cached.pattern;
  const sorted = [...current].sort((a,b) => b.length-a.length || a.localeCompare(b,'ko'));
  const pattern = sorted.length ? new RegExp(sorted.map(escapeRegExpText).join('|'),'gu') : null;
  dictionaryPatternCache = {names: current, pattern};
  return pattern;
}
function getDictionaryMatches(text, namesOrPattern) {
  const pattern = namesOrPattern instanceof RegExp ? namesOrPattern : createDictionaryMatchPattern(namesOrPattern);
  if (!pattern) return [];
  return Array.from(String(text).matchAll(pattern),match => ({name:match[0],start:match.index,end:match.index+match[0].length}));
}

function getReferenceMap() {
  // 조회할 때 전체 데이터를 재정규화하지 않고, 참조 루트가 없을 때만 보완합니다.
  if (!(manualData.menu || []).some(isReferenceSection)) ensureReferenceSection();
  const referenceItem = manualData.menu.find(isReferenceSection);
  const map = new Map();
  (referenceItem.children || []).forEach(child => {
    const key = String(child.title || '').trim();
    if (key) map.set(key,child);
  });
  return map;
}

function contentWithImagesToHtml(text, images, seenReferences = new Set()) {
  const source = String(text || '');
  const ordered = [...(Array.isArray(images) ? images : [])].sort((a, b) => Number(a.offset) - Number(b.offset));
  let cursor = 0;
  const parts = [];
  ordered.forEach(image => {
    const offset = Math.min(source.length, Math.max(cursor, Number(image.offset) || 0));
    parts.push(markdownToHtml(source.slice(cursor, offset), seenReferences));
    const url = escapeHtml(String(image.url || ''));
    const width = Math.max(10, Math.min(100, Number(image.width) || 65));
    parts.push(`<div class="embedded-image-wrap" style="--image-width:${width}%"><img class="embedded-image" src="${url}" alt="" draggable="false"><span class="embedded-image-fallback" hidden>[이미지 링크]</span></div>`);
    cursor = offset;
  });
  parts.push(markdownToHtml(source.slice(cursor), seenReferences));
  return parts.join('');
}

function tableToHtml(table, seenReferences = new Set()) {
  normalizeTable(table);
  const spannedCells = new Set();
  const rows = table.cells.map((row, rowIndex) => {
    const cells = row.map((cellText, colIndex) => {
      if (spannedCells.has(getTableCellKey(rowIndex, colIndex))) return '';

      const span = getTableCellSpan(table, rowIndex, colIndex);
      const color = table.cellColors[rowIndex][colIndex];
      const classes = color ? ` class="cell-color-${color}"` : '';
      const rowspan = span.rowspan > 1 ? ` rowspan="${span.rowspan}"` : '';
      const colspan = span.colspan > 1 ? ` colspan="${span.colspan}"` : '';
      const coveredRows = Math.min(span.rowspan, table.rows - rowIndex);
      const coveredCols = Math.min(span.colspan, table.cols - colIndex);

      for (let rowOffset = 0; rowOffset < coveredRows; rowOffset++) {
        for (let colOffset = 0; colOffset < coveredCols; colOffset++) {
          if (rowOffset === 0 && colOffset === 0) continue;
          spannedCells.add(getTableCellKey(rowIndex + rowOffset, colIndex + colOffset));
        }
      }

      return `<td${classes}${rowspan}${colspan}>${contentWithImagesToHtml(cellText, table.cellImages[rowIndex][colIndex], seenReferences)}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `<div class="manual-table-wrap"><table class="manual-table">${rows}</table></div>`;
}

function renderReferenceHtml(referenceName, seenReferences = new Set()) {
  const name = referenceName.trim();
  const reference = getReferenceMap().get(name);

  if (!reference) {
    return `<span class="reference-missing">{{${escapeHtml(name)}}}</span>`;
  }

  if (seenReferences.has(name)) {
    return `<span class="reference-missing">{{${escapeHtml(name)}} 순환 참조}}</span>`;
  }

  seenReferences.add(name);
  const parts = [];
  const content = String(reference.content || '');
  const referenceImages = ensureItemImages(reference);
  if (content.trim() || referenceImages.length) parts.push(contentWithImagesToHtml(content, referenceImages, seenReferences));
  ensureItemTables(reference).forEach(table => parts.push(tableToHtml(table, seenReferences)));
  seenReferences.delete(name);
  return trimTrailingRenderedBreaks(parts.join(''));
}

function replaceReferenceTokens(html, seenReferences = new Set()) {
  return html.replace(/{{\s*([^{}]+?)\s*}}/g, (match, referenceName) => {
    return renderReferenceHtml(referenceName, seenReferences);
  });
}

function escapeRegExpText(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function updateReferenceTokenNamesInManualData(oldName, newName) {
  const from = String(oldName || '').trim();
  const to = String(newName || '').trim();
  if (!from || !to || from === to) return 0;

  const tokenPattern = new RegExp(`{{\\s*${escapeRegExpText(from)}\\s*}}`, 'g');
  const replacement = `{{${to}}}`;
  let replacementCount = 0;

  const replaceText = value => {
    if (typeof value !== 'string') return value;
    return value.replace(tokenPattern, () => {
      replacementCount += 1;
      return replacement;
    });
  };

  const replaceField = (target, field) => {
    if (target && typeof target[field] === 'string') target[field] = replaceText(target[field]);
  };

  ensureGlobalTabs();
  replaceField(manualData, 'globalManual');
  manualData.globalTabs.forEach(tab => replaceField(tab, 'content'));

  const walkItems = items => {
    if (!Array.isArray(items)) return;
    items.forEach(item => {
      replaceField(item, 'content');
      ensureItemTables(item).forEach(table => {
        table.cells.forEach(row => {
          row.forEach((cell, colIndex) => {
            row[colIndex] = replaceText(cell);
          });
        });
      });
      walkItems(item.children);
    });
  };

  walkItems(manualData.menu);
  syncGlobalFieldsFromActiveTab();
  return replacementCount;
}

const referenceAutocompleteState = {
  editor: null,
  query: '',
  tokenStart: -1,
  caretOffset: 0,
  names: [],
  activeIndex: 0
};

function setEditorImeComposing(editor, composing) {
  if (!editor?.dataset) return;
  if (composing) editor.dataset.imeComposing = 'true';
  else delete editor.dataset.imeComposing;
}

function isEditorImeComposing(editor) {
  return editor?.dataset?.imeComposing === 'true';
}

function isImeCompositionInputEvent(event) {
  return Boolean(event?.isComposing)
    || event?.inputType === 'insertCompositionText'
    || event?.inputType === 'deleteCompositionText'
    || event?.inputType === 'insertFromComposition';
}

function shouldDeferEditableRefresh(editor, event = null) {
  return isEditorImeComposing(editor) || isImeCompositionInputEvent(event);
}

function getReferenceNames() {
  return Array.from(getReferenceMap().keys()).sort((a, b) => a.localeCompare(b, 'ko'));
}

function getOrCreateReferenceAutocomplete() {
  let popup = document.getElementById('reference-autocomplete');
  if (popup) return popup;

  popup = document.createElement('div');
  popup.id = 'reference-autocomplete';
  popup.className = 'reference-autocomplete';
  popup.hidden = true;
  popup.addEventListener('mousedown', event => {
    if (event.target.closest?.('select')) return;
    event.preventDefault();
  });
  document.body.appendChild(popup);
  return popup;
}

function getElementChildIndex(element) {
  return element.parentNode ? Array.prototype.indexOf.call(element.parentNode.childNodes, element) : 0;
}

function getEditableReferenceToken(element) {
  return element?.dataset?.referenceToken || '';
}

function isEditableReferenceTokenNode(node) {
  return node?.nodeType === Node.ELEMENT_NODE
    && node.classList.contains('editable-reference-token');
}

function getLogicalNodeLength(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue.length;
  if (node.nodeType !== Node.ELEMENT_NODE) return 0;
  if (node.classList.contains('embedded-image-wrap')) return 0;
  if (isEditableReferenceTokenNode(node)) return getEditableReferenceToken(node).length;
  if (node.classList.contains('editor-tail-caret')) return 0;
  if (node.tagName === 'BR') return 1;
  return Array.from(node.childNodes).reduce((sum, child) => sum + getLogicalNodeLength(child), 0);
}

function getEditorLogicalText(element) {
  let text = '';
  const walk = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.nodeValue;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.classList.contains('embedded-image-wrap')) return;
    if (isEditableReferenceTokenNode(node)) {
      text += getEditableReferenceToken(node);
      return;
    }
    if (node.classList.contains('editor-tail-caret')) return;
    if (node.tagName === 'BR') {
      text += '\n';
      return;
    }
    node.childNodes.forEach(walk);
  };
  element?.childNodes.forEach(walk);
  return text;
}

function getLogicalOffsetForDomPosition(root, targetNode, targetOffset) {
  let total = 0;
  let found = false;

  const visitChildrenUntil = (element, offset) => {
    for (let index = 0; index < offset; index++) total += getLogicalNodeLength(element.childNodes[index]);
  };

  const visit = node => {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      if (node === targetNode) {
        total += Math.min(targetOffset, node.nodeValue.length);
        found = true;
      } else {
        total += node.nodeValue.length;
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    if (node.classList.contains('embedded-image-wrap')) {
      if (node === targetNode || node.contains(targetNode)) found = true;
      return;
    }

    if (isEditableReferenceTokenNode(node)) {
      if (node === targetNode || node.contains(targetNode)) {
        total += (node === targetNode && targetOffset === 0) ? 0 : getEditableReferenceToken(node).length;
        found = true;
      } else {
        total += getEditableReferenceToken(node).length;
      }
      return;
    }

    if (node.classList.contains('editor-tail-caret')) {
      if (node === targetNode || node.contains(targetNode)) found = true;
      return;
    }

    if (node.tagName === 'BR') {
      if (node === targetNode) found = true;
      else total += 1;
      return;
    }

    if (node === targetNode) {
      visitChildrenUntil(node, targetOffset);
      found = true;
      return;
    }
    node.childNodes.forEach(visit);
  };

  visit(root);
  return total;
}

function getRangePositionBeforeElement(element) {
  return { node: element.parentNode, offset: getElementChildIndex(element) };
}

function getRangePositionAfterElement(element) {
  return { node: element.parentNode, offset: getElementChildIndex(element) + 1 };
}

function getLogicalTextPositionAtOffset(element, offset) {
  const targetOffset = Math.max(0, offset);
  let remaining = targetOffset;
  let fallback = { node: element, offset: element.childNodes.length };

  const visit = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (remaining <= node.nodeValue.length) return { node, offset: remaining };
      remaining -= node.nodeValue.length;
      fallback = { node, offset: node.nodeValue.length };
      return null;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    if (node.classList.contains('embedded-image-wrap')) {
      fallback = getRangePositionAfterElement(node);
      return null;
    }

    if (isEditableReferenceTokenNode(node)) {
      const tokenLength = getEditableReferenceToken(node).length;
      if (remaining <= tokenLength) return remaining <= tokenLength / 2 ? getRangePositionBeforeElement(node) : getRangePositionAfterElement(node);
      remaining -= tokenLength;
      fallback = getRangePositionAfterElement(node);
      return null;
    }

    if (node.classList.contains('editor-tail-caret')) {
      fallback = getRangePositionBeforeElement(node);
      return null;
    }

    if (node.tagName === 'BR') {
      if (remaining <= 1) return getRangePositionAfterElement(node);
      remaining -= 1;
      fallback = getRangePositionAfterElement(node);
      return null;
    }

    for (const child of node.childNodes) {
      const position = visit(child);
      if (position) return position;
    }
    fallback = { node, offset: node.childNodes.length };
    return null;
  };

  return visit(element) || fallback;
}

function getCaretTextOffset(element) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  if (!element.contains(range.endContainer)) return 0;

  return getLogicalOffsetForDomPosition(element, range.endContainer, range.endOffset);
}

function setCaretTextOffset(element, offset) {
  const position = getLogicalTextPositionAtOffset(element, offset);
  const range = document.createRange();
  range.setStart(position.node, position.offset);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function getEditableText(element) {
  return getEditorLogicalText(element);
}

function getTextNodePositionAtOffset(element, offset) {
  return getLogicalTextPositionAtOffset(element, offset);
}

function getTextRangeByOffsets(element, startOffset, endOffset) {
  const start = getTextNodePositionAtOffset(element, startOffset);
  const end = getTextNodePositionAtOffset(element, endOffset);
  if (!start || !end) return null;

  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

const markdownSelectionMenuState = { editor: null, start: 0, end: 0 };

function findClosingAsteriskDelimiter(text, start, type) {
  const markerLength = type === 'strong' ? 2 : 1;
  let nestedStrongOpen = false;
  let fallbackEnd = -1;
  let cursor = start + markerLength;

  while (cursor < text.length) {
    if (text[cursor] === '\n') return -1;
    if (text[cursor] !== '*') {
      cursor += 1;
      continue;
    }

    const runStart = cursor;
    while (cursor < text.length && text[cursor] === '*') cursor += 1;
    const runLength = cursor - runStart;

    if (type === 'strong') {
      if (runLength < 2) continue;
      const hasNestedEmphasis = text[start + 2] === '*';
      return hasNestedEmphasis && runLength >= 3 ? runStart + 1 : runStart;
    }

    if (!nestedStrongOpen) {
      if (runLength === 2) {
        nestedStrongOpen = true;
        continue;
      }
      return runStart;
    }

    if (runLength === 1) {
      fallbackEnd = runStart;
      continue;
    }

    if (runLength === 2) {
      nestedStrongOpen = false;
    } else if (runLength >= 3) {
      return runStart + 2;
    }
  }

  return fallbackEnd;
}

function findNextMarkdownToken(text, cursor = 0) {
  for (let index = cursor; index < text.length; index++) {
    if (text.startsWith('**', index)) {
      const end = findClosingAsteriskDelimiter(text, index, 'strong');
      if (end !== -1 && end > index + 2) {
        return { type: 'strong', marker: '**', start: index, bodyStart: index + 2, bodyEnd: end, end: end + 2 };
      }
    }

    if (text[index] === '*') {
      const end = findClosingAsteriskDelimiter(text, index, 'em');
      if (end !== -1 && end > index + 1) {
        return { type: 'em', marker: '*', start: index, bodyStart: index + 1, bodyEnd: end, end: end + 1 };
      }
    }
  }

  return null;
}

function getEditableMarkdownTokenRanges(text) {
  const tokens = [];
  let cursor = 0;
  let token;
  while ((token = findNextMarkdownToken(text, cursor)) !== null) {
    tokens.push(token);
    cursor = token.end;
  }
  return tokens;
}

function getExpectedMarkdownPreviewRanges(text, baseOffset = 0) {
  const source = String(text || '');
  const ranges = [];
  let cursor = 0;
  let token;

  while ((token = findNextMarkdownToken(source, cursor)) !== null) {
    ranges.push({
      type: token.type,
      start: baseOffset + token.bodyStart,
      end: baseOffset + token.bodyEnd
    });
    ranges.push(...getExpectedMarkdownPreviewRanges(
      source.slice(token.bodyStart, token.bodyEnd),
      baseOffset + token.bodyStart
    ));
    cursor = token.end;
  }

  return ranges;
}

function getRenderedMarkdownPreviewRanges(editor) {
  const ranges = [];
  let offset = 0;

  const walk = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      offset += node.nodeValue.length;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.classList.contains('embedded-image-wrap')) return;
    if (isEditableReferenceTokenNode(node)) {
      offset += getEditableReferenceToken(node).length;
      return;
    }
    if (node.classList.contains('editor-tail-caret')) return;
    if (node.tagName === 'BR') {
      offset += 1;
      return;
    }

    const previewRange = node.classList.contains('editable-md-preview')
      ? { type: node.tagName === 'STRONG' ? 'strong' : 'em', start: offset, end: offset }
      : null;
    if (previewRange) ranges.push(previewRange);
    node.childNodes.forEach(walk);
    if (previewRange) previewRange.end = offset;
  };

  editor.childNodes.forEach(walk);
  return ranges;
}

function isEditableMarkdownPreviewCurrent(editor, text) {
  const expected = getExpectedMarkdownPreviewRanges(text);
  const rendered = getRenderedMarkdownPreviewRanges(editor);
  return expected.length === rendered.length && expected.every((range, index) => {
    const current = rendered[index];
    return range.type === current.type && range.start === current.start && range.end === current.end;
  });
}

function rangesIntersect(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function selectionContainsReferenceToken(text, start, end) {
  return /{{\s*[^{}]+?\s*}}/.test(text.slice(start, end));
}

function getEditableSelectionRange(editor) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return null;

  const start = getLogicalOffsetForDomPosition(editor, range.startContainer, range.startOffset);
  const end = getLogicalOffsetForDomPosition(editor, range.endContainer, range.endOffset);
  const selectionStart = Math.min(start, end);
  const selectionEnd = Math.max(start, end);
  if (selectionStart === selectionEnd) return null;

  const text = getEditorLogicalText(editor);
  const selectedText = text.slice(selectionStart, selectionEnd);
  if (!selectedText.trim() || selectionContainsReferenceToken(text, selectionStart, selectionEnd)) return null;

  return { range, text, start: selectionStart, end: selectionEnd };
}

function getOrCreateMarkdownSelectionMenu() {
  let menu = document.getElementById('markdown-selection-menu');
  if (menu) return menu;

  menu = document.createElement('div');
  menu.id = 'markdown-selection-menu';
  menu.className = 'markdown-selection-menu';
  menu.hidden = true;
  menu.addEventListener('mousedown', event => {
    event.preventDefault();
    event.stopPropagation();
  });

  [
    ['strong', '강조'],
    ['em', '기울임'],
    ['remove', '해제']
  ].forEach(([command, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      applyMarkdownSelectionCommand(command);
    });
    menu.appendChild(button);
  });

  document.body.appendChild(menu);
  return menu;
}

function closeMarkdownSelectionMenu() {
  const menu = document.getElementById('markdown-selection-menu');
  if (menu) menu.hidden = true;
  markdownSelectionMenuState.editor = null;
  markdownSelectionMenuState.start = 0;
  markdownSelectionMenuState.end = 0;
}

function positionMarkdownSelectionMenu(menu, range) {
  const rects = Array.from(range.getClientRects()).filter(rect => rect.width || rect.height);
  const rect = rects[0] || range.getBoundingClientRect();
  if (!rect) return;

  menu.hidden = false;
  const menuRect = menu.getBoundingClientRect();
  const left = rect.left + rect.width / 2 - menuRect.width / 2;
  const top = rect.top - menuRect.height - 8;
  menu.style.left = `${Math.max(8, Math.min(left, window.innerWidth - menuRect.width - 8))}px`;
  menu.style.top = `${Math.max(8, top)}px`;
}

function collectEditorImagesForFormatting(editor) {
  const images = [];
  let offset = 0;

  const walk = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      offset += node.nodeValue.length;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.classList.contains('embedded-image-wrap')) {
      const image = node.querySelector('img.embedded-image');
      images.push({
        id: node.dataset.imageId || `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        url: image?.getAttribute('src') || image?.src || '',
        width: typeof getRenderedImageWidth === 'function' ? getRenderedImageWidth(node, 65) : 65,
        offset
      });
      return;
    }
    if (isEditableReferenceTokenNode(node)) {
      offset += getEditableReferenceToken(node).length;
      return;
    }
    if (node.classList.contains('editor-tail-caret')) return;
    if (node.tagName === 'BR') {
      offset += 1;
      return;
    }
    node.childNodes.forEach(walk);
  };

  editor.childNodes.forEach(walk);
  return images;
}

function transformOffsetAfterTextChanges(offset, changes) {
  let nextOffset = offset;
  for (const change of changes) {
    const removedLength = change.end - change.start;
    const addedLength = change.replacement.length;
    const delta = addedLength - removedLength;
    if (offset <= change.start) break;
    if (offset >= change.end) nextOffset += delta;
    else {
      nextOffset = change.start + addedLength;
      break;
    }
  }
  return Math.max(0, nextOffset);
}

function adjustImagesAfterTextChanges(images, changes) {
  return images.map(image => {
    let nextOffset = Number(image.offset) || 0;
    let previousDelta = 0;
    for (const change of changes) {
      const removedLength = change.end - change.start;
      const addedLength = change.replacement.length;
      const delta = addedLength - removedLength;
      if (image.offset <= change.start) break;
      if (image.offset >= change.end) {
        nextOffset += delta;
      } else {
        nextOffset = change.start + previousDelta + addedLength;
        break;
      }
      previousDelta += delta;
    }
    return { ...image, offset: Math.max(0, nextOffset) };
  });
}

function applyTextChangesToFormattingState(state, changes) {
  const normalized = changes
    .filter(change => change && change.start <= change.end && (change.start !== change.end || change.replacement))
    .sort((a, b) => a.start - b.start);
  if (!normalized.length) return state;

  let text = '';
  let cursor = 0;
  normalized.forEach(change => {
    text += state.text.slice(cursor, change.start) + change.replacement;
    cursor = change.end;
  });
  text += state.text.slice(cursor);

  return {
    text,
    images: adjustImagesAfterTextChanges(state.images, normalized),
    start: transformOffsetAfterTextChanges(state.start, normalized),
    end: transformOffsetAfterTextChanges(state.end, normalized)
  };
}

function getMarkdownMarkerForType(type) {
  return type === 'strong' ? '**' : '*';
}

function wrapMarkdownSegment(text, type) {
  if (!text) return '';
  const marker = getMarkdownMarkerForType(type);
  return `${marker}${text}${marker}`;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function subtractCoveredRanges(start, end, coveredRanges) {
  let ranges = [{ start, end }];
  coveredRanges
    .filter(range => rangesIntersect(start, end, range.start, range.end))
    .sort((a, b) => a.start - b.start)
    .forEach(covered => {
      ranges = ranges.flatMap(range => {
        if (!rangesIntersect(range.start, range.end, covered.start, covered.end)) return [range];
        const next = [];
        if (range.start < covered.start) next.push({ start: range.start, end: covered.start });
        if (covered.end < range.end) next.push({ start: covered.end, end: range.end });
        return next;
      });
    });
  return ranges.filter(range => range.start < range.end);
}

function buildMarkdownTokenReplacement(text, token, selectionStart, selectionEnd, selectedType = null) {
  const body = text.slice(token.bodyStart, token.bodyEnd);
  const innerStart = clampNumber(selectionStart, token.bodyStart, token.bodyEnd) - token.bodyStart;
  const innerEnd = clampNumber(selectionEnd, token.bodyStart, token.bodyEnd) - token.bodyStart;
  const before = body.slice(0, innerStart);
  const selected = body.slice(innerStart, innerEnd);
  const after = body.slice(innerEnd);

  if (!selected) return text.slice(token.start, token.end);
  if (selectedType && selectedType === token.type) return wrapMarkdownSegment(body, token.type);

  return [
    wrapMarkdownSegment(before, token.type),
    selectedType ? wrapMarkdownSegment(selected, selectedType) : selected,
    wrapMarkdownSegment(after, token.type)
  ].join('');
}

function getMarkdownFormattingChanges(text, start, end, command) {
  const changes = [];
  const coveredRanges = [];
  getEditableMarkdownTokenRanges(text).forEach(token => {
    if (!rangesIntersect(start, end, token.bodyStart, token.bodyEnd)) return;
    changes.push({
      start: token.start,
      end: token.end,
      replacement: buildMarkdownTokenReplacement(text, token, start, end, command)
    });
    coveredRanges.push({ start: token.start, end: token.end });
  });

  subtractCoveredRanges(start, end, coveredRanges).forEach(range => {
    const selected = text.slice(range.start, range.end);
    if (!selected.trim()) return;
    changes.push({ start: range.start, end: range.end, replacement: wrapMarkdownSegment(selected, command) });
  });

  return changes.sort((a, b) => a.start - b.start);
}

function getMarkdownRemoveChanges(text, start, end) {
  const changes = [];
  getEditableMarkdownTokenRanges(text).forEach(token => {
    if (!rangesIntersect(start, end, token.bodyStart, token.bodyEnd)) return;
    changes.push({
      start: token.start,
      end: token.end,
      replacement: buildMarkdownTokenReplacement(text, token, start, end, null)
    });
  });
  return changes;
}

function applyMarkdownCommandToState(state, command) {
  if (!state.text.slice(state.start, state.end).trim()
    || selectionContainsReferenceToken(state.text, state.start, state.end)) return null;

  const changes = command === 'remove'
    ? getMarkdownRemoveChanges(state.text, state.start, state.end)
    : getMarkdownFormattingChanges(state.text, state.start, state.end, command);
  if (!changes.length) return null;

  state = applyTextChangesToFormattingState(state, changes);
  state.caretOffset = state.end;
  return state;
}

function applyMarkdownCommandToText(text, start, end, command) {
  const state = applyMarkdownCommandToState({
    text: String(text || ''),
    images: [],
    start: Math.max(0, Number(start) || 0),
    end: Math.max(0, Number(end) || 0)
  }, command);
  if (!state) return null;
  return { text: state.text, start: state.start, end: state.end, caretOffset: state.caretOffset };
}

function buildMarkdownCommandState(command, editor, start, end) {
  return applyMarkdownCommandToState({
    text: getEditorLogicalText(editor),
    images: collectEditorImagesForFormatting(editor),
    start,
    end
  }, command);
}

function applyMarkdownFormattingState(editor, state, command) {
  if (!state || typeof refreshEditableContent !== 'function') {
    closeMarkdownSelectionMenu();
    return;
  }

  closeMarkdownSelectionMenu();
  closeReferenceAutocomplete();
  refreshEditableContent(editor, state.text, state.images, state.caretOffset);
  ensureTrailingEditorCaret(editor);

  const inputType = command === 'remove'
    ? 'formatRemove'
    : command === 'strong' ? 'formatBold' : 'formatItalic';
  const inputEvent = typeof InputEvent === 'function'
    ? new InputEvent('input', { bubbles: true, inputType })
    : new Event('input', { bubbles: true });
  editor.dispatchEvent(inputEvent);
}

function applyMarkdownSelectionCommand(command) {
  const { editor, start, end } = markdownSelectionMenuState;
  if (!editor || currentMode !== 'edit' || start === end) {
    closeMarkdownSelectionMenu();
    return;
  }

  const state = buildMarkdownCommandState(command, editor, start, end);
  applyMarkdownFormattingState(editor, state, command);
}

function refreshMarkdownSelectionMenu(editor) {
  if (currentMode !== 'edit') {
    closeMarkdownSelectionMenu();
    return;
  }

  const selectionRange = getEditableSelectionRange(editor);
  if (!selectionRange) {
    closeMarkdownSelectionMenu();
    return;
  }

  markdownSelectionMenuState.editor = editor;
  markdownSelectionMenuState.start = selectionRange.start;
  markdownSelectionMenuState.end = selectionRange.end;
  positionMarkdownSelectionMenu(getOrCreateMarkdownSelectionMenu(), selectionRange.range);
}

function queueMarkdownSelectionMenuUpdate(editor) {
  if (isEditorImeComposing(editor)) return;
  setTimeout(() => {
    if (!isEditorImeComposing(editor)) refreshMarkdownSelectionMenu(editor);
  }, 0);
}

function getReferenceAutocompleteMatch(editor) {
  const text = getEditableText(editor);
  const caretOffset = getCaretTextOffset(editor);
  const beforeCaret = text.slice(0, caretOffset);
  const match = beforeCaret.match(/{{([^{}\n]*)$/);
  if (!match) return null;

  return {
    query: match[1],
    tokenStart: caretOffset - match[0].length,
    caretOffset
  };
}

function getReferenceAutocompleteReplacementRange(editor) {
  const text = getEditableText(editor);
  const currentMatch = getReferenceAutocompleteMatch(editor);
  const tokenStart = currentMatch?.tokenStart ?? referenceAutocompleteState.tokenStart;
  if (tokenStart < 0 || text.slice(tokenStart, tokenStart + 2) !== '{{') return null;

  const query = currentMatch?.query ?? referenceAutocompleteState.query ?? '';
  let tokenEnd = Math.max(
    currentMatch?.caretOffset ?? 0,
    referenceAutocompleteState.caretOffset,
    tokenStart + 2 + query.length
  );

  const openTokenMatch = text.slice(tokenStart).match(/^{{[^{}\s]*/);
  if (openTokenMatch) {
    tokenEnd = Math.max(tokenEnd, tokenStart + openTokenMatch[0].length);
  }

  return { tokenStart, tokenEnd };
}

function positionReferenceAutocomplete(editor) {
  const popup = getOrCreateReferenceAutocomplete();
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
  const caretRect = range?.getBoundingClientRect();
  const editorRect = editor.getBoundingClientRect();
  const left = Math.min((caretRect?.left || editorRect.left), window.innerWidth - 340);
  const top = (caretRect?.bottom || editorRect.bottom) + 6;

  popup.style.left = `${Math.max(8, left)}px`;
  popup.style.top = `${Math.min(window.innerHeight - 240, Math.max(8, top))}px`;
}

function closeReferenceAutocomplete() {
  const popup = document.getElementById('reference-autocomplete');
  if (popup) popup.hidden = true;
  referenceAutocompleteState.editor = null;
  referenceAutocompleteState.query = '';
  referenceAutocompleteState.tokenStart = -1;
  referenceAutocompleteState.caretOffset = 0;
  referenceAutocompleteState.names = [];
  referenceAutocompleteState.activeIndex = 0;
}

function renderReferenceAutocomplete() {
  const popup = getOrCreateReferenceAutocomplete();
  popup.replaceChildren();

  referenceAutocompleteState.names.forEach((name, index) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.textContent = name;
    option.classList.toggle('active', index === referenceAutocompleteState.activeIndex);
    option.addEventListener('mousedown', (event) => {
      event.preventDefault();
      applyReferenceAutocomplete(name);
    });
    popup.appendChild(option);
  });

  popup.hidden = referenceAutocompleteState.names.length === 0;
  if (!popup.hidden) positionReferenceAutocomplete(referenceAutocompleteState.editor);
}

function updateReferenceAutocomplete(editor) {
  if (isEditorImeComposing(editor)) {
    closeReferenceAutocomplete();
    return;
  }

  if (currentMode !== 'edit') {
    closeReferenceAutocomplete();
    return;
  }

  const match = getReferenceAutocompleteMatch(editor);
  if (!match) {
    closeReferenceAutocomplete();
    return;
  }

  const query = match.query.trim().toLowerCase();
  const names = getReferenceNames().filter(name => name.toLowerCase().includes(query));
  if (names.length === 0) {
    closeReferenceAutocomplete();
    return;
  }

  const previousQuery = referenceAutocompleteState.query;
  referenceAutocompleteState.editor = editor;
  referenceAutocompleteState.query = match.query;
  referenceAutocompleteState.tokenStart = match.tokenStart;
  referenceAutocompleteState.caretOffset = match.caretOffset;
  referenceAutocompleteState.names = names;
  referenceAutocompleteState.activeIndex = previousQuery === match.query
    ? Math.min(referenceAutocompleteState.activeIndex, names.length - 1)
    : 0;
  renderReferenceAutocomplete();
}

function applyReferenceAutocomplete(name = referenceAutocompleteState.names[referenceAutocompleteState.activeIndex]) {
  const editor = referenceAutocompleteState.editor;
  if (!editor || !name) return;

  const replacementRange = getReferenceAutocompleteReplacementRange(editor);
  if (!replacementRange) return;

  const insertion = `{{${name}}}`;
  const domRange = getTextRangeByOffsets(editor, replacementRange.tokenStart, replacementRange.tokenEnd);
  if (!domRange) return;

  domRange.deleteContents();
  const node = createEditableReferenceToken(insertion, name);
  domRange.insertNode(node);
  placeCaretAfterInsertedNode(node, domRange);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(domRange);
  closeReferenceAutocomplete();
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}

function handleReferenceAutocompleteKeydown(event) {
  if (referenceAutocompleteState.editor !== event.currentTarget) return;
  if (getOrCreateReferenceAutocomplete().hidden) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    referenceAutocompleteState.activeIndex = (referenceAutocompleteState.activeIndex + 1) % referenceAutocompleteState.names.length;
    renderReferenceAutocomplete();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    referenceAutocompleteState.activeIndex = (referenceAutocompleteState.activeIndex - 1 + referenceAutocompleteState.names.length) % referenceAutocompleteState.names.length;
    renderReferenceAutocomplete();
  } else if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault();
    applyReferenceAutocomplete();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    closeReferenceAutocomplete();
  }
}

function bindReferenceAutocomplete(editor, onAddImage) {
  if (editor.dataset.dictionaryEnabled === 'true') bindDictionaryAutocomplete(editor);
  editor.addEventListener('dragover', event => event.preventDefault());
  editor.addEventListener('drop', event => event.preventDefault());
  editor.addEventListener('compositionstart', () => {
    setEditorImeComposing(editor, true);
    closeReferenceAutocomplete();
    closeMarkdownSelectionMenu();
  });
  editor.addEventListener('compositionend', () => {
    setEditorImeComposing(editor, false);
    setTimeout(() => updateReferenceAutocomplete(editor), 0);
  });
  editor.addEventListener('input', event => {
    closeMarkdownSelectionMenu();
    if (isImeCompositionInputEvent(event) || isEditorImeComposing(editor)) return;
    updateReferenceAutocomplete(editor);
  });
  editor.addEventListener('paste', handleEditablePlainTextPaste);
  editor.addEventListener('keyup', () => {
    updateReferenceAutocomplete(editor);
    queueMarkdownSelectionMenuUpdate(editor);
  });
  editor.addEventListener('mouseup', () => {
    updateReferenceAutocomplete(editor);
    queueMarkdownSelectionMenuUpdate(editor);
  });
  editor.addEventListener('focus', () => {
    ensureTrailingEditorCaret(editor);
    updateReferenceAutocomplete(editor);
  });
  editor.addEventListener('keydown', handleReferenceAutocompleteKeydown);
  editor.addEventListener('keydown', handleEditablePlainEnter);
  editor.addEventListener('contextmenu', event => {
    if (editor.classList.contains('manual-table-cell-text')) return;
    if (onAddImage) event.stopPropagation();
    showReferenceContextMenu(event, editor, onAddImage);
  });
  editor.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.activeElement === editor || editor.contains(document.activeElement)) return;
      if (document.activeElement?.closest?.('#reference-autocomplete')) return;
      if (document.activeElement?.closest?.('#markdown-selection-menu')) return;
      if (referenceContextMenuState.editor === editor && document.getElementById('editor-context-menu')) return;
      closeReferenceAutocomplete();
      closeMarkdownSelectionMenu();
      if (currentMode === 'edit' && typeof refreshEditablePreview === 'function') {
        refreshEditablePreview(editor);
      }
    }, 120);
  });
}

const referenceContextMenuState = { editor: null, range: null, offset: null };
function getCaretRangeAtPoint(x, y) {
  if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
  const position = document.caretPositionFromPoint?.(x, y);
  if (!position) return null;
  const range = document.createRange(); range.setStart(position.offsetNode, position.offset); range.collapse(true); return range;
}

function resolveContextMenuInsertionRange(editor) {
  if (!editor || referenceContextMenuState.editor !== editor) return null;
  const savedRange = referenceContextMenuState.range;
  if (savedRange && editor.contains(savedRange.startContainer)) return savedRange.cloneRange();
  if (!Number.isFinite(referenceContextMenuState.offset)) return null;
  return getTextRangeByOffsets(editor, referenceContextMenuState.offset, referenceContextMenuState.offset);
}

function insertReferenceToken(name) {
  const { editor } = referenceContextMenuState;
  const range = resolveContextMenuInsertionRange(editor);
  if (!editor || !range) return;
  const token = `{{${name}}}`;
  const node = createEditableReferenceToken(token, name);
  range.deleteContents(); range.insertNode(node); placeCaretAfterInsertedNode(node, range);
  const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  closeReferenceAutocomplete(); editor.dispatchEvent(new Event('input', { bubbles: true }));
}
function getOrCreateUnifiedContextMenu() {
  let menu = document.getElementById('editor-context-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'editor-context-menu';
    menu.className = 'editor-context-menu';
    document.body.appendChild(menu);
  }
  menu.replaceChildren();
  return menu;
}

function appendUnifiedMenuButton(menu, { text, className = '', disabled = false, onAction }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  if (className) button.className = className;
  button.disabled = disabled;
  button.addEventListener('mousedown', event => {
    event.preventDefault();
    event.stopPropagation();
    if (button.disabled || !onAction) return;
    onAction();
    closeEditorContextMenu();
  });
  menu.appendChild(button);
  return button;
}

function appendUnifiedReferenceSelect(menu, editor) {
  const referenceSelect = document.createElement('select');
  referenceSelect.setAttribute('aria-label', '참조 삽입');
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '참조 삽입…';
  referenceSelect.appendChild(placeholder);

  getReferenceNames().forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    referenceSelect.appendChild(option);
  });

  referenceSelect.disabled = !editor || referenceSelect.options.length <= 1;
  referenceSelect.addEventListener('change', event => {
    event.stopPropagation();
    if (!referenceSelect.value) return;
    insertReferenceToken(referenceSelect.value);
    closeEditorContextMenu();
  });
  menu.appendChild(referenceSelect);
}

function setContextMenuReferenceRange(editor, event) {
  if (!editor) return;
  const range = getCaretRangeAtPoint(event.clientX, event.clientY);
  const rangeElement = range?.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range?.startContainer.parentElement;
  const isImageRange = Boolean(rangeElement?.closest?.('.embedded-image-wrap'));

  if (range && editor.contains(range.startContainer) && !isImageRange) {
    referenceContextMenuState.editor = editor;
    referenceContextMenuState.range = range;
    referenceContextMenuState.offset = getLogicalOffsetForDomPosition(editor, range.startContainer, range.startOffset);
    return;
  }

  const endRange = document.createRange();
  endRange.selectNodeContents(editor);
  endRange.collapse(false);
  referenceContextMenuState.editor = editor;
  referenceContextMenuState.range = endRange;
  referenceContextMenuState.offset = getEditorLogicalText(editor).length;
}

function positionUnifiedContextMenu(menu, x, y) {
  menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - 320))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - 260))}px`;
}

function showUnifiedContextMenu(event, { editor = null, onAddImage = null, onDeleteImage = null, tableContext = null, keepReferenceRange = false } = {}) {
  if (currentMode !== 'edit') return;
  event.preventDefault();
  event.stopPropagation();
  closeReferenceAutocomplete();
  if (editor && !keepReferenceRange) setContextMenuReferenceRange(editor, event);

  const menu = getOrCreateUnifiedContextMenu();
  const title = document.createElement('div');
  title.className = 'editor-context-menu-title';
  title.textContent = '편집 메뉴';
  menu.appendChild(title);

  const hasTable = Boolean(tableContext);
  const selection = hasTable ? getTableSelectionRange(tableContext.path, tableContext.tableIndex) : null;
  appendUnifiedMenuButton(menu, {
    text: selection ? `${selection.rows} × ${selection.cols} 셀 병합` : '셀 병합',
    disabled: !selection || (selection.rows === 1 && selection.cols === 1),
    onAction: () => mergeSelectedCells(tableContext.path, tableContext.tableIndex)
  });

  let canUnmerge = false;
  if (hasTable) {
    const table = normalizeTable(ensureItemTables(getItemByPath(tableContext.path))[tableContext.tableIndex]);
    const span = getTableCellSpan(table, tableContext.rowIndex, tableContext.colIndex, table.cells[tableContext.rowIndex][tableContext.colIndex]);
    canUnmerge = span.rowspan > 1 || span.colspan > 1;
  }
  appendUnifiedMenuButton(menu, {
    text: '병합 해제',
    disabled: !canUnmerge,
    onAction: () => unmergeTableCell(tableContext.path, tableContext.tableIndex, tableContext.rowIndex, tableContext.colIndex)
  });

  [
    ['', '무색', 'color-none'],
    ['blue', '푸른색', 'color-blue'],
    ['red', '붉은색', 'color-red'],
    ['green', '초록색', 'color-green']
  ].forEach(([color, label, className]) => {
    appendUnifiedMenuButton(menu, {
      text: label,
      className,
      disabled: !hasTable,
      onAction: () => {
        setTableCellColor(tableContext.path, tableContext.tableIndex, tableContext.rowIndex, tableContext.colIndex, color);
        applyTableCellStyle(tableContext.cell, color);
      }
    });
  });

  appendUnifiedMenuButton(menu, {
    text: '이미지 추가',
    disabled: !onAddImage,
    onAction: () => onAddImage()
  });
  appendUnifiedMenuButton(menu, {
    text: '이미지 삭제',
    disabled: !onDeleteImage,
    onAction: () => onDeleteImage()
  });
  appendUnifiedReferenceSelect(menu, editor);
  positionUnifiedContextMenu(menu, event.clientX, event.clientY);
}

function showReferenceContextMenu(event, editor, onAddImage) {
  if (currentMode !== 'edit') return;
  showUnifiedContextMenu(event, { editor, onAddImage });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    applyMarkdownCommandToText,
    findNextMarkdownToken,
    getExpectedMarkdownPreviewRanges,
    isEditableMarkdownPreviewCurrent,
    markdownToHtml
  };
}
