// 배치와 탐색은 UI 상태입니다. 데이터/JSON 백업 구조는 바꾸지 않습니다.
const MANUAL_LAYOUT_KEY = 'universalManual.panelLayout';
const MANUAL_LAYOUTS = Object.freeze({
  global: ['global'], body: ['body'],
  'global-global': ['global','global'], 'global-body': ['global','body'],
  'body-body': ['body','body'], 'body-global': ['body','global']
});
let manualPanelLayout = 'global-body';
let activeAccordionRoot = null;
const accordionScrollStates = new WeakMap();

function normalizeManualPanelLayout(value) {
  return Object.hasOwn(MANUAL_LAYOUTS,value) ? value : 'global-body';
}
function getAccordionRoots() {
  return [...document.querySelectorAll('.accordion-container')];
}
function getActiveAccordionRoot() {
  return activeAccordionRoot || document.getElementById('main-accordion');
}
function activateAccordionRoot(root) {
  if (!root || root === getActiveAccordionRoot()) return;
  accordionScrollStates.set(getActiveAccordionRoot(),{target:accordionAlignmentTarget});
  ++accordionScrollRevision;
  accordionAlignmentTarget = accordionScrollStates.get(root)?.target || null;
  activeAccordionRoot = root;
}
function hasTwoManualPanes() { return MANUAL_LAYOUTS[manualPanelLayout].length === 2; }
function applyManualPanelLayout(value, persist = false) {
  manualPanelLayout = normalizeManualPanelLayout(value);
  const layout = document.querySelector('.main-layout');
  const counts = {global:0,body:0};
  layout.querySelectorAll('[data-manual-pane]').forEach(pane=>{pane.hidden = true; delete pane.dataset.paneSlot;});
  MANUAL_LAYOUTS[manualPanelLayout].forEach((kind,index)=>{
    const pane = layout.querySelector('[data-manual-pane="'+kind+'"][data-pane-copy="'+counts[kind]+++'"]');
    pane.hidden = false; pane.dataset.paneSlot = String(index);
  });
  layout.classList.toggle('single-manual-pane',!hasTwoManualPanes());
  const visibleRoot = getAccordionRoots().find(root=>!root.parentElement.hidden);
  if (visibleRoot && getActiveAccordionRoot().parentElement.hidden) activateAccordionRoot(visibleRoot);
  document.getElementById('settings-panel-layout').value = manualPanelLayout;
  syncMobileWorkspace();
  updateLayoutResizerState();
  syncDictionaryLayout();
  if (persist) {
    try { localStorage.setItem(MANUAL_LAYOUT_KEY,manualPanelLayout); } catch {}
    renderGlobal();
    renderAccordion({normalize:false});
    applyManualSearch();
    syncManualThemeEffect();
  }
}
function initManualPanelLayout() {
  const layout = document.querySelector('.main-layout');
  const globalPane = layout.querySelector('.sidebar');
  const bodyPane = layout.querySelector('.content-area');
  [[globalPane,'global'],[bodyPane,'body']].forEach(([pane,kind])=>{
    pane.id = 'manual-pane-'+kind;
    pane.dataset.manualPane = kind; pane.dataset.paneCopy = '0';
    const second = pane.cloneNode(true);
    second.id = pane.id+'-secondary';
    second.dataset.paneCopy = '1'; second.hidden = true;
    second.querySelectorAll('[id]').forEach(element=>{element.id += '-secondary';});
    second.setAttribute('aria-label',kind === 'global' ? '전역 매뉴얼 두 번째 보기' : '본문 항목 두 번째 보기');
    layout.append(second);
  });
  layout.addEventListener('focusout',event=>{
    const pane = event.target.closest('[data-manual-pane="body"]');
    if (!pane || !event.target.isContentEditable || event.target.contains(event.relatedTarget)) return;
    getAccordionRoots().filter(root=>root.parentElement !== pane && !root.parentElement.hidden).forEach(renderAccordionPane);
  });
  ['pointerdown','focusin'].forEach(type=>layout.addEventListener(type,event=>{
    const pane = event.target.closest('[data-manual-pane="body"]');
    if (pane) activateAccordionRoot(pane.querySelector('.accordion-container'));
  },true));
  let stored;
  try { stored = localStorage.getItem(MANUAL_LAYOUT_KEY); } catch {}
  applyManualPanelLayout(stored);
  document.getElementById('settings-panel-layout').addEventListener('change',event=>applyManualPanelLayout(event.target.value,true));
}
