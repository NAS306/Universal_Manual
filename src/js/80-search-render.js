const manualSearchState = { query: '', results: [], currentIndex: -1 };
let manualSearchTimer = null;
const highlightedSearchRoots = new Set();
let currentSearchHeader = null;
function getItemDirectSearchParts(item) {
  return [item.title, item.content, ...(item.tables || []).flatMap(table => (table.cells || []).flat())].map(value => String(value || ''));
}
// Resolve displayed reference text for ordinary bodies/cells without changing stored data.
// Names, source titles, images and dictionary explanations are not search text.
function expandSearchReferences(text, references, seen = new Set()) {
  return text.replace(/{{\s*([^{}]+?)\s*}}/g, (_, referenceName) => {
    const name = referenceName.trim();
    const source = references.get(name);
    if (!source || seen.has(name)) return ' ';
    seen.add(name);
    const expanded = getItemDirectSearchParts(source).slice(1)
      .map(part => expandSearchReferences(part,references,seen)).join('\n');
    seen.delete(name);
    return expanded;
  });
}
function searchText(item, references) {
  const [title,...content] = getItemDirectSearchParts(item);
  return [title.replace(/{{\s*[^{}]+?\s*}}/g,' '),
    ...content.map(text => expandSearchReferences(text,references))]
    .join('\n').toLocaleLowerCase('ko');
}
function findSearchResults(query) {
  const results = [];
  const normalizedQuery = query.trim().toLocaleLowerCase('ko');
  if (!normalizedQuery) return results;
  // Existing lookup is read-only when a source root exists; do not create one for search.
  const references = (manualData.menu || []).some(isReferenceSection) ? getReferenceMap() : new Map();
  const walk = (items, path = []) => items.forEach((item,index) => {
    if (isReferenceSection(item) || isDictionarySection(item)) return;
    const next = [...path,index];
    if (searchText(item,references).includes(normalizedQuery)) results.push(next);
    walk(item.children || [],next);
  });
  walk(manualData.menu || []);
  return results;
}
function clearSearchHighlights() { highlightedSearchRoots.forEach(root=>root.querySelectorAll('mark.search-highlight').forEach(mark=>mark.replaceWith(document.createTextNode(mark.textContent)))); highlightedSearchRoots.clear(); currentSearchHeader?.classList.remove('search-current'); currentSearchHeader=null; }
function highlightSearchText(element, query) { if (!element) return; highlightedSearchRoots.add(element); const re=new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'gi'); const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT); const nodes=[]; while(walker.nextNode()) { const node=walker.currentNode; const owner=node.parentElement.closest('.accordion-item'); if(node.nodeValue.trim()&&!node.parentElement.closest('button:not(.accordion-toggle):not(.dictionary-term),.editable-reference-token,mark,[aria-hidden="true"]')&&(!owner||owner===element)) nodes.push(node); } nodes.forEach(node=>{const parts=node.nodeValue.split(re);if(parts.length===1)return;const f=document.createDocumentFragment();parts.forEach((part,i)=>{if(!part)return;if(i%2){const mark=document.createElement('mark');mark.className='search-highlight';mark.textContent=part;f.appendChild(mark);}else f.appendChild(document.createTextNode(part));});node.replaceWith(f);}); }
function updateSearchCount() { const count=document.getElementById('manual-search-count'); if(!count)return; count.textContent=!manualSearchState.query?'검색어를 입력하세요.':!manualSearchState.results.length?'검색 결과가 없습니다.':`${manualSearchState.currentIndex+1} / ${manualSearchState.results.length}개 항목`; }
function nearestSearchIndex() {
  const items = Array.from(document.querySelectorAll('.accordion-item'));
  const positions = new Map();
  const distances = Array(items.length).fill(Infinity);
  items.forEach((item,index) => {
    positions.set(item.dataset.path,index);
    if (item.querySelector(':scope > .accordion-content.open')) distances[index] = 0;
  });
  for (let i=1;i<distances.length;i++) distances[i] = Math.min(distances[i],distances[i-1]+1);
  for (let i=distances.length-2;i>=0;i--) distances[i] = Math.min(distances[i],distances[i+1]+1);
  let best = 0, distance = Infinity;
  manualSearchState.results.forEach((path,index) => {
    const current = distances[positions.get(path.join('.'))] ?? Infinity;
    if (current < distance) { best = index; distance = current; }
  });
  return best;
}
function highlightCurrentSearchResult() { clearSearchHighlights(); if(manualSearchState.query) highlightSearchText(document.getElementById('global-content'),manualSearchState.query); const path=manualSearchState.results[manualSearchState.currentIndex]; if(!path)return;const item=getAccordionElement(path); if(item){highlightSearchText(item,manualSearchState.query);currentSearchHeader=item.querySelector(':scope > .accordion-header');currentSearchHeader?.classList.add('search-current');} }
function openSearchResult() {
  const path = manualSearchState.results[manualSearchState.currentIndex];
  if (!path) return;
  document.querySelectorAll('.accordion-content.open').forEach(element => setAccordionExpanded(element,false));
  for (let depth=1;depth<=path.length;depth++) {
    const item = getAccordionElement(path.slice(0,depth));
    setAccordionExpanded(item?.querySelector(':scope > .accordion-content'),true);
  }
  highlightCurrentSearchResult();
  scrollToAccordionSearchResult(getAccordionElement(path)?.querySelector(':scope > .accordion-header'));
  updateSearchCount();
}
function applyManualSearch(openCurrent=false) { const input=document.getElementById('manual-search-input');manualSearchState.query=(input?.value||'').trim();manualSearchState.results=manualSearchState.query?findSearchResults(manualSearchState.query):[];manualSearchState.currentIndex=manualSearchState.results.length?(openCurrent?nearestSearchIndex():Math.min(Math.max(manualSearchState.currentIndex,0),manualSearchState.results.length-1)):-1;highlightCurrentSearchResult();updateSearchCount();if(openCurrent&&manualSearchState.currentIndex>=0)openSearchResult(); }
function moveSearchResult(step) { if(!manualSearchState.results.length)return;manualSearchState.currentIndex=(manualSearchState.currentIndex+step+manualSearchState.results.length)%manualSearchState.results.length;openSearchResult(); }

function renderAll() {
  ensureSystemSections();
  renderGlobal();
  renderAccordion({normalize:false});
  applyManualSearch();
  updateModeButton();
  updateLayoutResizerState();
  syncManualThemeEffect();
  refreshStorageKeyMenu();
}

function updateModeButton() {
  const btn = document.getElementById('mode-toggle');
  if (!btn) return;

  if (currentMode === 'edit') {
    btn.textContent = "편집 완료";
    btn.setAttribute("aria-pressed", "true");
  } else {
    btn.textContent = "수정 모드 켜기";
    btn.setAttribute("aria-pressed", "false");
  }
}
