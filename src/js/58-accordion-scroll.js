// 스크롤과 설정은 UI 상태이며 매뉴얼 데이터/백업에는 저장하지 않습니다.
const ACCORDION_ALIGN_KEY = 'universalManual.alignAccordionHeader';
let accordionHeaderAlignmentEnabled = false;
let accordionAlignmentTarget = null;
let accordionScrollRevision = 0;
function getAccordionScroller(root = getActiveAccordionRoot()) { return root?.parentElement; }
function getAccordionAlignmentTarget(root = getActiveAccordionRoot()) {
  return root === getActiveAccordionRoot() ? accordionAlignmentTarget : accordionScrollStates.get(root)?.target;
}
function getAccordionViewportTop(scroller) { return scroller.getBoundingClientRect().top+scroller.clientTop; }
function getAccordionScrollSpace(root = getActiveAccordionRoot()) {
  let space = getAccordionScroller(root)?.querySelector('.accordion-scroll-space');
  if (!space) {
    space = document.createElement('div'); space.className = 'accordion-scroll-space'; space.setAttribute('aria-hidden','true');
    getAccordionScroller(root).append(space);
  }
  return space;
}
function getAccordionAlignmentSpace(targetTop, viewportHeight, contentBottom) {
  return Math.max(0,Math.ceil(targetTop+viewportHeight-contentBottom));
}
function resetAccordionHeaderAlignment({all = false} = {}) {
  ++accordionScrollRevision; accordionAlignmentTarget = null;
  (all ? getAccordionRoots() : [getActiveAccordionRoot()]).forEach(root=>{
    const space = getAccordionScroller(root)?.querySelector('.accordion-scroll-space');
    if (space) space.style.height = '0px';
    accordionScrollStates.delete(root);
  });
}
function updateAccordionScrollSpace(root = getActiveAccordionRoot()) {
  const scroller = getAccordionScroller(root);
  if (!scroller) return;
  const space = getAccordionScrollSpace(root);
  const target = getAccordionAlignmentTarget(root);
  if (!accordionHeaderAlignmentEnabled || !target?.isConnected) { space.style.height = '0px'; return; }
  const top = getAccordionViewportTop(scroller);
  const targetTop = target.getBoundingClientRect().top-top+scroller.scrollTop;
  const content = root;
  const contentBottom = content.getBoundingClientRect().bottom-top+scroller.scrollTop;
  const height = getAccordionAlignmentSpace(targetTop,scroller.clientHeight,contentBottom)+'px';
  if (space.style.height !== height) space.style.height = height;
}
function waitForAccordionLayout(callback) {
  const revision = ++accordionScrollRevision;
  const content = getActiveAccordionRoot();
  // 문구 띠 같은 무한 애니메이션은 펼침 레이아웃 대기 대상이 아닙니다.
  const animations = (content.getAnimations?.({subtree:true}) || []).filter(animation=>animation.effect?.getComputedTiming?.().endTime !== Infinity);
  Promise.allSettled(animations.map(animation=>animation.finished)).then(()=>{
    requestAnimationFrame(()=>{if(revision===accordionScrollRevision)callback();});
  });
}
function requestAccordionHeaderAlignment(header) {
  if (!accordionHeaderAlignmentEnabled || !header?.isConnected || !header.nextElementSibling?.classList.contains('open')) return;
  ++accordionScrollRevision;
  accordionAlignmentTarget = header;
  // 형제 항목과 조상의 높이 변화가 끝난 상태를 바로 계산합니다.
  // 현재 항목 자체의 펼침은 유지하고, 같은 클릭 이벤트 안에서 즉시 정렬합니다.
  const content = getActiveAccordionRoot();
  (content.getAnimations?.({subtree:true}) || []).forEach(animation=>{
    const target = animation.effect?.target;
    if (target !== header.nextElementSibling && target?.classList?.contains('accordion-content')) animation.finish();
  });
  updateAccordionScrollSpace();
  const scroller = getAccordionScroller();
  const top = header.getBoundingClientRect().top-getAccordionViewportTop(scroller)+scroller.scrollTop;
  scroller.scrollTo({top,behavior:'instant'});
}
function releaseAccordionHeaderAlignment(header) {
  if (accordionAlignmentTarget === header || header.parentElement?.contains(accordionAlignmentTarget)) resetAccordionHeaderAlignment();
}
function scrollToAccordionSearchResult(header) {
  if (!header) return;
  if (accordionHeaderAlignmentEnabled) { requestAccordionHeaderAlignment(header); return; }
  waitForAccordionLayout(()=>{
    if (!header.isConnected) return;
    const scroller = getAccordionScroller();
    const top = header.getBoundingClientRect().top-getAccordionViewportTop(scroller)+scroller.scrollTop-(scroller.clientHeight-header.offsetHeight)/2;
    scroller.scrollTo({top,behavior:manualMotionEnabled()?'smooth':'instant'});
  });
}
function captureAccordionViewport() {
  ++accordionScrollRevision;
  const scroller = getAccordionScroller();
  if (!scroller) return null;
  const viewportTop = getAccordionViewportTop(scroller);
  let anchor = null;
  const blocks = scroller.querySelectorAll('.accordion-header, .accordion-content > pre, .accordion-content > .manual-table-wrap');
  for (const block of blocks) {
    const rect = block.getBoundingClientRect();
    if (!rect.height || rect.bottom<=viewportTop || rect.top>=viewportTop+scroller.clientHeight) continue;
    const owner = block.closest('.accordion-item');
    if (!owner) continue;
    const kind = block.classList.contains('accordion-header') ? 'header' : block.tagName === 'PRE' ? 'pre' : 'table';
    const tableIndex = kind === 'table' ? [...owner.querySelectorAll(':scope > .accordion-content > .manual-table-wrap')].indexOf(block) : -1;
    const offset = rect.top-viewportTop;
    anchor = {path:owner.dataset.path,kind,tableIndex,offset,progress:offset<0 ? Math.min(1,-offset/rect.height) : null};
    break;
  }
  return {top:scroller.scrollTop,left:scroller.scrollLeft,anchor,
    alignedPath:accordionAlignmentTarget?.closest('.accordion-item')?.dataset.path,
    otherViews: getAccordionRoots().filter(root=>root !== getActiveAccordionRoot()).map(root=>({root,top:root.parentElement.scrollTop,alignedPath:getAccordionAlignmentTarget(root)?.closest('.accordion-item')?.dataset.path,paths:[...root.querySelectorAll('.accordion-content.open')].map(panel=>panel.closest('.accordion-item').dataset.path)})),
    panels:['global-content','global-content-secondary','dictionary-body'].map(id=>{const element=document.getElementById(id);return {id,top:element?.scrollTop||0,left:element?.scrollLeft||0};})};
}
function getRestoredAccordionTop(blockTop, blockHeight, anchor) {
  return anchor.progress === null ? blockTop-anchor.offset : blockTop+anchor.progress*blockHeight;
}
function restoreAccordionViewport(snapshot) {
  if (!snapshot) return;
  const revision = ++accordionScrollRevision;
  const restore = () => {
    const scroller = getAccordionScroller();
    if (!scroller) return;
    if (snapshot.alignedPath && accordionHeaderAlignmentEnabled) {
      accordionAlignmentTarget = getAccordionElement(snapshot.alignedPath.split('.').map(Number))?.querySelector(':scope > .accordion-header') || null;
      updateAccordionScrollSpace();
    }
    let top = snapshot.top;
    const anchor = snapshot.anchor;
    if (anchor) {
      const item = getAccordionElement(anchor.path.split('.').map(Number));
      const block = anchor.kind === 'table' ? item?.querySelectorAll(':scope > .accordion-content > .manual-table-wrap')[anchor.tableIndex]
        : item?.querySelector(anchor.kind === 'header' ? ':scope > .accordion-header' : ':scope > .accordion-content > pre');
      const rect = block?.getBoundingClientRect();
      if (rect?.height) {
        const blockTop = rect.top-getAccordionViewportTop(scroller)+scroller.scrollTop;
        top = getRestoredAccordionTop(blockTop,rect.height,anchor);
      }
    }
    scroller.scrollTo({top,left:snapshot.left,behavior:'instant'});
    snapshot.otherViews?.forEach(view=>{
      view.paths.forEach(path=>{
        const item = accordionElementsByRoot.get(view.root)?.get(path);
        setAccordionExpanded(item?.querySelector(':scope > .accordion-content'),true,{animate:false});
      });
      if (view.alignedPath && accordionHeaderAlignmentEnabled) {
        const target = accordionElementsByRoot.get(view.root)?.get(view.alignedPath)?.querySelector(':scope > .accordion-header');
        accordionScrollStates.set(view.root,{target});
        updateAccordionScrollSpace(view.root);
      }
      view.root.parentElement.scrollTop = view.top;
    });
    snapshot.panels.forEach(saved=>{const panel=document.getElementById(saved.id);if(panel){panel.scrollTop=saved.top;panel.scrollLeft=saved.left;}});
  };
  restore();
  requestAnimationFrame(()=>{if(revision===accordionScrollRevision)restore();});
}
function initAccordionScroll() {
  const toggle = document.getElementById('accordion-align-toggle');
  try { accordionHeaderAlignmentEnabled = localStorage.getItem(ACCORDION_ALIGN_KEY) === 'true'; } catch {}
  toggle.checked = accordionHeaderAlignmentEnabled;
  toggle.addEventListener('change',()=>{
    accordionHeaderAlignmentEnabled = toggle.checked;
    if (!accordionHeaderAlignmentEnabled) resetAccordionHeaderAlignment({all:true});
    try { localStorage.setItem(ACCORDION_ALIGN_KEY,String(toggle.checked)); } catch {}
  });
  getAccordionRoots().forEach(root=>{
    const scroller = root.parentElement;
    ['wheel','touchstart','pointerdown','keydown'].forEach(type=>scroller.addEventListener(type,()=>{++accordionScrollRevision;},{passive:true}));
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(()=>updateAccordionScrollSpace(root));
      observer.observe(scroller); observer.observe(root);
    }
  });
  getAccordionScrollSpace();
}
