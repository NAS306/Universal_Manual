// ==================== 데스크톱 레이아웃 비율 조절 ====================
const LAYOUT_RATIO_STORAGE_KEY = 'universalManual.sidebarRatio';
const LAYOUT_RATIO_MIN = 30;
const LAYOUT_RATIO_MAX = 70;
const LAYOUT_RATIO_DEFAULT = 40;
let currentLayoutRatio = LAYOUT_RATIO_DEFAULT;

function clampLayoutRatio(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return LAYOUT_RATIO_DEFAULT;
  return Math.max(LAYOUT_RATIO_MIN, Math.min(LAYOUT_RATIO_MAX, numeric));
}

function readStoredLayoutRatio() {
  try {
    const storedRatio = localStorage.getItem(LAYOUT_RATIO_STORAGE_KEY);
    return storedRatio === null || storedRatio === '' ? LAYOUT_RATIO_DEFAULT : clampLayoutRatio(storedRatio);
  } catch (error) {
    return LAYOUT_RATIO_DEFAULT;
  }
}

function writeStoredLayoutRatio(value) {
  try {
    localStorage.setItem(LAYOUT_RATIO_STORAGE_KEY, String(Math.round(clampLayoutRatio(value) * 10) / 10));
  } catch (error) {
    // 레이아웃 비율은 편의 설정이라 저장 실패를 무시합니다.
  }
}

function syncLayoutResizerPosition() {
  const layout = document.querySelector('.main-layout');
  if (!layout) return;

  const style = getComputedStyle(layout);
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(style.paddingRight) || 0;
  const contentWidth = Math.max(1, layout.clientWidth - paddingLeft - paddingRight);
  const left = paddingLeft + (contentWidth * currentLayoutRatio / 100);
  const position = (Math.round(left * 10) / 10)+'px';
  if (document.documentElement.style.getPropertyValue('--layout-resizer-left') !== position) document.documentElement.style.setProperty('--layout-resizer-left',position);
}

function applyLayoutRatio(value, persist = false) {
  currentLayoutRatio = clampLayoutRatio(value);
  document.documentElement.style.setProperty('--manual-sidebar-ratio', `${currentLayoutRatio}%`);
  syncLayoutResizerPosition();
  const resizer = document.getElementById('layout-resizer');
  if (resizer) resizer.setAttribute('aria-valuenow', String(Math.round(currentLayoutRatio)));
  if (persist) writeStoredLayoutRatio(currentLayoutRatio);
}

function getLayoutContentRect(layout) {
  const rect = layout.getBoundingClientRect();
  const style = getComputedStyle(layout);
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(style.paddingRight) || 0;
  const left = rect.left + paddingLeft;
  const width = Math.max(1, rect.width - paddingLeft - paddingRight);
  return { left, width };
}

function ratioFromPointer(layout, clientX) {
  const { left, width } = getLayoutContentRect(layout);
  return ((clientX - left) / width) * 100;
}

function updateLayoutResizerState({measure = true} = {}) {
  const isEditMode = currentMode === 'edit';
  document.body.classList.toggle('edit-mode', isEditMode);
  if (measure) syncLayoutResizerPosition();
  const resizer = document.getElementById('layout-resizer');
  if (!resizer) return;
  resizer.tabIndex = isEditMode ? 0 : -1;
  resizer.setAttribute('aria-disabled', isEditMode ? 'false' : 'true');
  resizer.setAttribute('aria-valuenow', String(Math.round(currentLayoutRatio)));
}

function initLayoutResizer() {
  const layout = document.querySelector('.main-layout');
  const resizer = document.getElementById('layout-resizer');
  applyLayoutRatio(readStoredLayoutRatio());
  if (!layout || !resizer) return;

  let activePointerId = null;

  const stopResize = () => {
    if (activePointerId === null) return;
    activePointerId = null;
    document.body.classList.remove('layout-resizing');
    applyLayoutRatio(currentLayoutRatio, true);
  };

  resizer.addEventListener('pointerdown', event => {
    if (currentMode !== 'edit') return;
    event.preventDefault();
    activePointerId = event.pointerId;
    resizer.setPointerCapture?.(event.pointerId);
    document.body.classList.add('layout-resizing');
    applyLayoutRatio(ratioFromPointer(layout, event.clientX));
  });

  resizer.addEventListener('pointermove', event => {
    if (activePointerId !== event.pointerId) return;
    applyLayoutRatio(ratioFromPointer(layout, event.clientX));
  });

  resizer.addEventListener('pointerup', stopResize);
  resizer.addEventListener('pointercancel', stopResize);
  resizer.addEventListener('lostpointercapture', stopResize);
  resizer.addEventListener('keydown', event => {
    if (currentMode !== 'edit') return;
    const step = event.shiftKey ? 5 : 2;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      applyLayoutRatio(currentLayoutRatio - step, true);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      applyLayoutRatio(currentLayoutRatio + step, true);
    } else if (event.key === 'Home') {
      event.preventDefault();
      applyLayoutRatio(LAYOUT_RATIO_MIN, true);
    } else if (event.key === 'End') {
      event.preventDefault();
      applyLayoutRatio(LAYOUT_RATIO_MAX, true);
    }
  });
  window.addEventListener('resize', syncLayoutResizerPosition);
  updateLayoutResizerState();
}
