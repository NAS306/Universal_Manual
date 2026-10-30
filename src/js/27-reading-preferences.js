const MANUAL_TEXT_SIZE_KEY = 'universalManual.bodyTextSize';
const MANUAL_TEXT_SIZES = Object.freeze({atomic:0.7,tiny:0.8,small:0.9,normal:1,large:1.1,larger:1.2});
let manualTextSize = 'normal';
function normalizeManualTextSize(value) { return Object.prototype.hasOwnProperty.call(MANUAL_TEXT_SIZES,value) ? value : 'normal'; }
function applyManualTextSize(value, persist = false) {
  const viewport = persist ? captureAccordionViewport() : null;
  manualTextSize = normalizeManualTextSize(value);
  document.documentElement.style.setProperty('--manual-font-scale',String(MANUAL_TEXT_SIZES[manualTextSize]));
  const select = document.getElementById('settings-text-size'); if (select) select.value = manualTextSize;
  if (persist) { try {localStorage.setItem(MANUAL_TEXT_SIZE_KEY,manualTextSize);} catch {} }
  if (viewport) restoreAccordionViewport(viewport);
}
function initReadingPreferences() {
  let textSize = 'normal', motion = 'system';
  try { textSize = localStorage.getItem(MANUAL_TEXT_SIZE_KEY); motion = localStorage.getItem(MANUAL_MOTION_KEY); } catch {}
  applyManualTextSize(textSize); applyManualMotionPreference(motion);
  document.getElementById('settings-text-size').addEventListener('change',event=>applyManualTextSize(event.target.value,true));
  document.getElementById('settings-motion').addEventListener('change',event=>applyManualMotionPreference(event.target.value,true));
  window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener('change',()=>applyManualMotionPreference(manualMotionPreference));
}
