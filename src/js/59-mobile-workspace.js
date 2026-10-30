// Presentation only: reuse the configured panes; never duplicate manual data.
let mobileWorkspaceMedia = null;
let mobileSectionIndex = 0;
let mobileWorkspaceReady = false;
const mobilePaneViewports = new WeakMap();
function isMobileManualWorkspace() { return Boolean(mobileWorkspaceMedia?.matches); }
function getConfiguredManualPanes() {
  return [...document.querySelectorAll('[data-manual-pane][data-pane-slot]')]
    .sort((a,b)=>Number(a.dataset.paneSlot)-Number(b.dataset.paneSlot));
}
function getManualPaneScroller(pane) {
  return pane.matches('.content-area') ? pane : pane.querySelector('[data-global-editor]');
}
function syncMobileWorkspace({refreshSearch = false} = {}) {
  if (!mobileWorkspaceReady) return;
  const panes = getConfiguredManualPanes();
  const mobile = isMobileManualWorkspace();
  mobileSectionIndex = Math.min(mobileSectionIndex,panes.length-1);
  document.querySelectorAll('[data-manual-pane]').forEach(pane=>{
    const scroller = getManualPaneScroller(pane);
    if (scroller?.getClientRects().length) mobilePaneViewports.set(scroller,{top:scroller.scrollTop,left:scroller.scrollLeft});
    if (mobile && !pane.hidden && pane !== panes[mobileSectionIndex]) pane.dataset.mobileInactive = 'true';
    else delete pane.dataset.mobileInactive;
  });
  panes.forEach((pane,index)=>{
    const button = document.getElementById('mobile-section-'+(index+1));
    const name = pane.dataset.manualPane === 'global' ? '전역 매뉴얼' : '본문 항목';
    button.hidden = false;
    button.setAttribute('aria-label','섹션 '+(index+1)+' · '+name);
    button.setAttribute('aria-controls',pane.id);
    button.setAttribute('aria-pressed',String(index === mobileSectionIndex));
    button.title = '섹션 '+(index+1)+' · '+name+' (두 손가락 좌우 스와이프로 전환)';
    if (index === mobileSectionIndex) document.getElementById('mobile-section-status').textContent = button.title;
    if (!mobile || index === mobileSectionIndex) {
      const scroller = getManualPaneScroller(pane);
      const saved = mobilePaneViewports.get(scroller);
      if (saved) { scroller.scrollTop = saved.top; scroller.scrollLeft = saved.left; }
    }
  });
  if (panes.length < 2) document.getElementById('mobile-section-2').hidden = true;
  const activePane = panes[mobileSectionIndex];
  if (mobile && activePane?.dataset.manualPane === 'body') activateAccordionRoot(activePane.querySelector('.accordion-container'));
  syncDictionaryLayout();
  if (refreshSearch) { applyManualSearch(); syncManualThemeEffect(); }
}
function selectMobileSection(index) {
  if (!isMobileManualWorkspace()) return;
  const panes = getConfiguredManualPanes();
  if (index < 0 || index >= panes.length || index === mobileSectionIndex) return;
  const focused = document.activeElement;
  if (panes[mobileSectionIndex]?.contains(focused)) focused.blur();
  mobileSectionIndex = index;
  syncMobileWorkspace({refreshSearch:true});
}
function revealMobileSearchPane() {
  if (!isMobileManualWorkspace()) return;
  const pane = getActiveAccordionRoot()?.parentElement;
  const index = getConfiguredManualPanes().indexOf(pane);
  if (index >= 0) selectMobileSection(index);
}

// Match fingers by identifier; reject pinches, rotation, opposite motion and vertical scroll.
function startMobileSwipe(touches) {
  return {points:[...touches].map(touch=>({id:touch.identifier,x:touch.clientX,y:touch.clientY})),locked:false,rejected:false,started:Date.now()};
}
function measureMobileSwipe(gesture,touches) {
  if (!gesture || gesture.rejected || touches.length !== 2 || Date.now()-gesture.started > 1800) return null;
  const points = gesture.points.map(point=>[...touches].find(touch=>touch.identifier === point.id));
  if (points.some(point=>!point)) return null;
  const delta = points.map((point,index)=>({x:point.clientX-gesture.points[index].x,y:point.clientY-gesture.points[index].y}));
  const initial = {x:gesture.points[1].x-gesture.points[0].x,y:gesture.points[1].y-gesture.points[0].y};
  const current = {x:points[1].clientX-points[0].clientX,y:points[1].clientY-points[0].clientY};
  const span = Math.hypot(initial.x,initial.y);
  const distanceChange = Math.abs(Math.hypot(current.x,current.y)-span);
  const rotation = Math.abs(Math.atan2(initial.x*current.y-initial.y*current.x,initial.x*current.x+initial.y*current.y));
  if (distanceChange > Math.max(16,span*.18) || rotation > .3 || delta.some(move=>Math.abs(move.y)>Math.max(24,Math.abs(move.x)))) {
    gesture.rejected = true;
    return null;
  }
  const sameDirection = delta[0].x*delta[1].x > 0;
  const horizontal = delta.every(move=>Math.abs(move.x)>Math.abs(move.y)*1.8);
  if (!sameDirection || !horizontal) return null;
  const distance = Math.min(...delta.map(move=>Math.abs(move.x)));
  if (distance >= 12) gesture.locked = true;
  return distance >= 56 ? (delta[0].x<0 ? 1 : -1) : null;
}
function initMobileWorkspace() {
  mobileWorkspaceMedia = window.matchMedia('(max-width:1024px)');
  mobileWorkspaceReady = true;
  [0,1].forEach(index=>document.getElementById('mobile-section-'+(index+1)).addEventListener('click',()=>selectMobileSection(index)));
  const header = document.querySelector('.app-header');
  const searchToggle = document.getElementById('mobile-search-toggle');
  const setSearchOpen = open=>{
    header.classList.toggle('mobile-search-open',open);
    searchToggle.setAttribute('aria-expanded',String(open));
    searchToggle.setAttribute('aria-label',open ? '검색창 닫기' : '검색창 열기');
    (open ? document.getElementById('manual-search-input') : searchToggle).focus({preventScroll:true});
  };
  searchToggle.addEventListener('click',()=>setSearchOpen(!header.classList.contains('mobile-search-open')));
  header.addEventListener('keydown',event=>{
    if (isMobileManualWorkspace() && event.key === 'Escape' && event.target.closest('.manual-search')) {
      event.preventDefault(); event.stopPropagation(); setSearchOpen(false);
    }
  });
  mobileWorkspaceMedia.addEventListener('change',()=>syncMobileWorkspace({refreshSearch:true}));
  const layout = document.querySelector('.main-layout');
  let gesture = null;
  const ignore = '[contenteditable="true"],input,textarea,select,.manual-table-wrap,.embedded-image-wrap,[role="separator"]';
  layout.addEventListener('touchstart',event=>{
    if (event.touches.length !== 2) { gesture = null; return; }
    if (!isMobileManualWorkspace() || !hasTwoManualPanes() || document.querySelector('dialog[open]') || dictionaryState.name || window.visualViewport?.scale > 1.05) return;
    const pane = getConfiguredManualPanes()[mobileSectionIndex];
    if ([...event.touches].some(touch=>!pane.contains(touch.target) || touch.target.closest(ignore))) return;
    clearDragStyles(); cancelDragState();
    gesture = startMobileSwipe(event.touches);
  },{passive:true});
  layout.addEventListener('touchmove',event=>{
    if (!gesture) return;
    measureMobileSwipe(gesture,event.touches);
    if (gesture.locked && !gesture.rejected && event.cancelable) event.preventDefault();
  },{passive:false});
  layout.addEventListener('touchend',event=>{
    if (!gesture) return;
    const direction = measureMobileSwipe(gesture,[...event.touches,...event.changedTouches]);
    if (gesture.locked && !gesture.rejected && event.cancelable) event.preventDefault();
    gesture = null;
    if (direction !== null) selectMobileSection(mobileSectionIndex+direction);
  },{passive:false});
  layout.addEventListener('touchcancel',()=>{gesture = null;},{passive:true});
  syncMobileWorkspace();
}
