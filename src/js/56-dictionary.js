// 사전 연결은 표시 DOM에만 적용합니다. 원문과 이미지 offset은 변경하지 않습니다.
const dictionaryState = { name: null, storageKey: null, opener: null, mode: 'push', transitionId: 0 };
const DICTIONARY_MODE_OPTIONS = Object.freeze([['push','밀기'],['compress','3분할'],['overlay-right','겹치기 (오른쪽)'],['overlay-left','겹치기 (왼쪽)']]);
const DICTIONARY_MODES = Object.freeze(DICTIONARY_MODE_OPTIONS.map(([value])=>value));
function normalizeDictionaryMode(mode) { return DICTIONARY_MODES.includes(mode) ? mode : 'push'; }
function isDictionaryOverlay(mode = dictionaryState.mode) { return mode === 'overlay-right' || mode === 'overlay-left'; }
const dictionaryAutocomplete = { editor: null, candidates: [], index: 0, start: 0, end: 0 };

function linkDictionaryTerms(container) {
  const pattern = createDictionaryMatchPattern(getDictionaryEntries().keys());
  if (!pattern) return;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement.closest('a,button,script,style,[contenteditable="true"]')) nodes.push(node);
  }
  nodes.forEach(node => {
    const matches = getDictionaryMatches(node.nodeValue, pattern);
    if (!matches.length) return;
    const fragment = document.createDocumentFragment(); let cursor = 0;
    matches.forEach(match => {
      fragment.append(document.createTextNode(node.nodeValue.slice(cursor, match.start)));
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'dictionary-term'; button.textContent = match.name;
      button.setAttribute('aria-label', match.name + ' 사전 열기');
      button.addEventListener('click', event => { event.stopPropagation(); openDictionary(match.name, button); });
      fragment.append(button); cursor = match.end;
    });
    fragment.append(document.createTextNode(node.nodeValue.slice(cursor))); node.replaceWith(fragment);
  });
}
// 사전 패널과 설정 모달이 같은 배치 값을 사용합니다.
function populateDictionaryModeSelect(select) {
  select.replaceChildren();
  DICTIONARY_MODE_OPTIONS.forEach(([value,text])=>{
    const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
  });
  select.value = dictionaryState.mode;
}
function setDictionaryMode(value) {
  const mode = normalizeDictionaryMode(value);
  const changed = dictionaryState.mode !== mode;
  dictionaryState.mode = mode;
  try {localStorage.setItem('universalManual.dictionaryMode',mode);} catch {}
  document.querySelectorAll('[data-dictionary-mode-select]').forEach(select=>{select.value = mode;});
  if (dictionaryState.name && changed) {
    animateManualLayout(()=>syncDictionaryLayout());
    animateDictionaryPanel(true);
  }
}
function initDictionaryModePreference() {
  try {dictionaryState.mode = normalizeDictionaryMode(localStorage.getItem('universalManual.dictionaryMode'));} catch {}
  const select = document.getElementById('settings-dictionary-mode');
  populateDictionaryModeSelect(select);
  select.addEventListener('change',()=>setDictionaryMode(select.value));
}
function ensureDictionaryPanel() {
  let panel = document.getElementById('dictionary-panel');
  if (panel) return panel;
  panel = document.createElement('aside'); panel.id = 'dictionary-panel'; panel.hidden = true;
  panel.setAttribute('aria-label', '용어 사전');
  const header = document.createElement('div'); header.className = 'dictionary-toolbar';
  const label = document.createElement('label'); label.textContent = '사전 배치 ';
  const select = document.createElement('select'); select.setAttribute('aria-label','사전 배치 방식');
  select.dataset.dictionaryModeSelect = 'true';
  populateDictionaryModeSelect(select);
  select.addEventListener('change',()=>setDictionaryMode(select.value));
  label.append(select); header.append(label);
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '×';
  close.setAttribute('aria-label','사전 닫기'); close.addEventListener('click', closeDictionary); header.append(close);
  const title = document.createElement('h2'); title.id = 'dictionary-title';
  const body = document.createElement('div'); body.id = 'dictionary-body';
  panel.append(header,title,body); document.querySelector('.main-layout').append(panel);
  initDictionaryResizer(panel);
  document.addEventListener('keydown', event => {
    if (event.target.closest?.('dialog[open]')) return;
    if (event.key === 'Escape' && !panel.hidden && !event.defaultPrevented && !event.target.closest('[contenteditable="true"],input,textarea')) closeDictionary();
  });
  document.addEventListener('click', event => {
    if (event.target.closest?.('dialog[open]')) return;
    if (!dictionaryState.name || !isDictionaryOverlay() || panel.contains(event.target)) return;
    if (event.target.closest?.('.dictionary-term, #image-lightbox')) return;
    closeDictionary({restoreFocus:false});
  }, true);
  return panel;
}
function animateDictionaryPanel(opening) {
  const panel = document.getElementById('dictionary-panel');
  const direction = dictionaryState.mode === 'overlay-left' ? -1 : 1;
  const offset = direction * (isDictionaryOverlay() ? 70 : 32);
  return animateManualElement(panel, opening
    ? [{opacity:0, transform:'translateX('+offset+'px)'},{opacity:1, transform:'translateX(0)'}]
    : [{opacity:1, transform:'translateX(0)'},{opacity:0, transform:'translateX('+offset+'px)'}]);
}
function syncDictionaryLayout() {
  const open = Boolean(dictionaryState.name);
  const layout = document.querySelector('.main-layout');
  layout.classList.toggle('dictionary-open',open);
  layout.classList.toggle('dictionary-push',open && dictionaryState.mode === 'push');
  layout.classList.toggle('dictionary-compress',open && dictionaryState.mode === 'compress');
  layout.classList.toggle('dictionary-overlay-right',open && dictionaryState.mode === 'overlay-right');
  layout.classList.toggle('dictionary-overlay-left',open && dictionaryState.mode === 'overlay-left');
  const sidebar = layout.querySelector('.sidebar');
  sidebar.inert = open && dictionaryState.mode === 'push' && window.innerWidth > 1024;
  sidebar.setAttribute('aria-hidden',String(sidebar.inert));
  syncDictionaryResizer();
}
function openDictionary(name, opener) {
  if (!getDictionaryEntries().has(name)) return;
  const opening = !dictionaryState.name;
  ++dictionaryState.transitionId;
  dictionaryState.name = name; dictionaryState.opener = opener; dictionaryState.storageKey = activeStorageKey;
  animateManualLayout(() => refreshDictionaryPanel());
  if (opening) animateDictionaryPanel(true);
}
function closeDictionary({restoreFocus = true} = {}) {
  if (!dictionaryState.name) return;
  const transitionId = ++dictionaryState.transitionId;
  dictionaryState.name = null;
  const panel = document.getElementById('dictionary-panel');
  if (panel) panel.inert = true;
  const finish = () => {
    if (transitionId !== dictionaryState.transitionId) return;
    animateManualLayout(() => {
      if (panel) { panel.hidden = true; panel.inert = false; }
      syncDictionaryLayout();
    });
    if (restoreFocus && dictionaryState.opener?.isConnected) dictionaryState.opener.focus({preventScroll:true});
  };
  const animation = animateDictionaryPanel(false);
  if (animation) animation.finished.then(finish,finish); else finish();
}
function refreshDictionaryPanel() {
  if (!dictionaryState.name) return;
  const entry = getDictionaryEntries().get(dictionaryState.name);
  if (!entry || dictionaryState.storageKey !== activeStorageKey) { closeDictionary(); return; }
  const panel = ensureDictionaryPanel(); panel.hidden = false; panel.inert = false;
  document.getElementById('dictionary-title').textContent = dictionaryState.name;
  const body = document.getElementById('dictionary-body'); body.replaceChildren();
  const render = item => {
    const text = document.createElement('div'); text.className = 'dictionary-description';
    renderContentWithImages(text,item.content || '',item.images || []); body.append(text);
    (item.tables || []).forEach(table => {
      const wrap = document.createElement('div'); wrap.className = 'manual-table-wrap'; wrap.innerHTML = tableToHtml(table); body.append(wrap);
    });
  };
  render(entry); syncDictionaryLayout();
}
window.addEventListener('resize', () => { if (dictionaryState.name) syncDictionaryLayout(); });

function getDictionaryCompletion(text, caret, names) {
  const match = text.slice(0,caret).match(/[\p{L}\p{N}_-]+$/u);
  if (!match) return null;
  const query = match[0];
  const candidates = [...names].filter(name => name.startsWith(query) && name !== query).sort((a,b)=>a.localeCompare(b,'ko'));
  return candidates.length ? { candidates, start: caret-query.length, end: caret } : null;
}
function closeDictionaryAutocomplete() {
  const popup = document.getElementById('dictionary-autocomplete'); if (popup) popup.hidden = true;
  dictionaryAutocomplete.editor = null;
}
function renderDictionaryAutocomplete() {
  let popup = document.getElementById('dictionary-autocomplete');
  if (!popup) { popup = document.createElement('div'); popup.id = 'dictionary-autocomplete'; popup.className = 'reference-autocomplete'; document.body.append(popup); }
  popup.replaceChildren();
  dictionaryAutocomplete.candidates.forEach((name,index) => {
    const option = document.createElement('button'); option.type = 'button'; option.textContent = name + ' · Tab';
    option.classList.toggle('active',index === dictionaryAutocomplete.index);
    option.addEventListener('mousedown',event=>{event.preventDefault();requestDictionaryAutocomplete(name);}); popup.append(option);
  });
  const range = window.getSelection()?.rangeCount ? window.getSelection().getRangeAt(0) : null;
  const rect = range?.getBoundingClientRect() || dictionaryAutocomplete.editor.getBoundingClientRect();
  popup.style.left = Math.max(8,Math.min(rect.left,window.innerWidth-330))+'px';
  popup.style.top = Math.max(8,Math.min(rect.bottom+6,window.innerHeight-240))+'px'; popup.hidden = false;
}
function updateDictionaryAutocomplete(editor) {
  const selection = window.getSelection();
  if (currentMode !== 'edit' || !selection?.rangeCount || !editor.contains(selection.getRangeAt(0).endContainer) || (!selection.isCollapsed && !isEditorImeComposing(editor)) || getReferenceAutocompleteMatch(editor)) { closeDictionaryAutocomplete(); return; }
  const match = getDictionaryCompletion(getEditableText(editor),getCaretTextOffset(editor),getDictionaryEntries().keys());
  if (!match) { closeDictionaryAutocomplete(); return; }
  const same = dictionaryAutocomplete.editor === editor && dictionaryAutocomplete.start === match.start;
  Object.assign(dictionaryAutocomplete, match, {editor,index:same ? Math.min(dictionaryAutocomplete.index,match.candidates.length-1) : 0});
  renderDictionaryAutocomplete();
}
function applyDictionaryAutocomplete(name = dictionaryAutocomplete.candidates[dictionaryAutocomplete.index]) {
  const { editor,start,end } = dictionaryAutocomplete;
  if (!editor || !name) return;
  const range = getTextRangeByOffsets(editor,start,end); if (!range) return;
  range.deleteContents(); const node = document.createTextNode(name); range.insertNode(node);
  range.setStartAfter(node); range.collapse(true); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  closeDictionaryAutocomplete(); editor.dispatchEvent(new Event('input',{bubbles:true}));
}
// 조합 중인 글자는 브라우저에서 먼저 확정한 뒤 해당 용어만 바꿉니다.
function requestDictionaryAutocomplete(name = dictionaryAutocomplete.candidates[dictionaryAutocomplete.index]) {
  const editor = dictionaryAutocomplete.editor;
  if (!editor || !name) return;
  if (!isEditorImeComposing(editor)) { applyDictionaryAutocomplete(name); return; }
  const end = dictionaryAutocomplete.end;
  // blur로 브라우저의 한글 조합을 확정하며, 조합 중 DOM은 직접 수정하지 않습니다.
  editor.blur();
  editor.focus({preventScroll:true});
  setTimeout(() => {
    if (isEditorImeComposing(editor) || document.activeElement !== editor) return;
    setCaretTextOffset(editor,end);
    updateDictionaryAutocomplete(editor);
    if (dictionaryAutocomplete.editor === editor && dictionaryAutocomplete.candidates.includes(name)) applyDictionaryAutocomplete(name);
  },0);
}
function bindDictionaryAutocomplete(editor) {
  editor.addEventListener('compositionstart',closeDictionaryAutocomplete);
  editor.addEventListener('compositionend',()=>setTimeout(()=>updateDictionaryAutocomplete(editor),0));
  editor.addEventListener('input',()=>updateDictionaryAutocomplete(editor));
  editor.addEventListener('keyup',event=>{ if (!['Escape','ArrowDown','ArrowUp','Tab'].includes(event.key)) updateDictionaryAutocomplete(editor); });
  editor.addEventListener('blur',closeDictionaryAutocomplete);
  editor.addEventListener('keydown',event=>{
    if (dictionaryAutocomplete.editor !== editor) return;
    if (event.key === 'Tab' && !event.shiftKey) { event.preventDefault(); requestDictionaryAutocomplete(); return; }
    if (event.isComposing || isEditorImeComposing(editor)) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); dictionaryAutocomplete.index = (dictionaryAutocomplete.index+(event.key==='ArrowDown'?1:-1)+dictionaryAutocomplete.candidates.length)%dictionaryAutocomplete.candidates.length; renderDictionaryAutocomplete();
    } else if (event.key === 'Escape') { event.preventDefault(); closeDictionaryAutocomplete(); }
  });
}
