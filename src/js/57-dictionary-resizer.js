// 겹치기 패널 너비는 데이터/백업이 아닌 브라우저 UI 설정입니다.
const DICTIONARY_WIDTH_KEY = 'universalManual.dictionaryOverlayRatio';
let dictionaryOverlayRatio = 50;
function clampDictionaryOverlayRatio(value) {
  const number = Number(value);
  return value === null || value === '' || !Number.isFinite(number) ? 50 : Math.max(20,Math.min(80,number));
}
function syncDictionaryResizer() {
  const handle = document.getElementById('dictionary-resizer');
  if (!handle) return;
  handle.hidden = !isDictionaryOverlay();
  handle.setAttribute('aria-valuenow',String(Math.round(dictionaryOverlayRatio)));
  handle.setAttribute('aria-valuetext',Math.round(dictionaryOverlayRatio)+'%');
  handle.title = '사전 너비 '+Math.round(dictionaryOverlayRatio)+'% · 드래그 또는 방향키로 조절 (20~80%)';
  document.documentElement.style.setProperty('--dictionary-overlay-width',dictionaryOverlayRatio+'vw');
}
function applyDictionaryOverlayRatio(value, persist = false) {
  dictionaryOverlayRatio = clampDictionaryOverlayRatio(value);
  syncDictionaryResizer();
  if (persist) { try { localStorage.setItem(DICTIONARY_WIDTH_KEY,String(dictionaryOverlayRatio)); } catch {} }
}
function initDictionaryResizer(panel) {
  try { dictionaryOverlayRatio = clampDictionaryOverlayRatio(localStorage.getItem(DICTIONARY_WIDTH_KEY)); } catch {}
  const handle = document.createElement('div'); handle.id = 'dictionary-resizer'; handle.tabIndex = 0;
  handle.setAttribute('role','separator'); handle.setAttribute('aria-label','사전 너비 조절');
  handle.setAttribute('aria-orientation','vertical'); handle.setAttribute('aria-valuemin','20'); handle.setAttribute('aria-valuemax','80');
  panel.append(handle);
  let pointer = null;
  const stop = () => {
    if (pointer === null) return;
    pointer = null; document.body.classList.remove('dictionary-resizing');
    applyDictionaryOverlayRatio(dictionaryOverlayRatio,true);
  };
  handle.addEventListener('pointerdown',event=>{
    if (event.button !== 0 || !isDictionaryOverlay()) return;
    event.preventDefault(); event.stopPropagation(); pointer = event.pointerId;
    handle.setPointerCapture(event.pointerId); document.body.classList.add('dictionary-resizing');
  });
  handle.addEventListener('pointermove',event=>{
    if (event.pointerId !== pointer || !isDictionaryOverlay()) return;
    const rect = panel.getBoundingClientRect();
    const width = dictionaryState.mode === 'overlay-left' ? event.clientX-rect.left : rect.right-event.clientX;
    applyDictionaryOverlayRatio(width/window.innerWidth*100);
  });
  handle.addEventListener('pointerup',stop); handle.addEventListener('pointercancel',stop); handle.addEventListener('lostpointercapture',stop);
  handle.addEventListener('keydown',event=>{
    if (!isDictionaryOverlay()) return;
    let value = dictionaryOverlayRatio;
    if (event.key === 'Home') value = 20;
    else if (event.key === 'End') value = 80;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const direction = (event.key === 'ArrowRight' ? 1 : -1)*(dictionaryState.mode === 'overlay-left' ? 1 : -1);
      value += direction*(event.shiftKey ? 5 : 2);
    } else return;
    event.preventDefault(); event.stopPropagation(); applyDictionaryOverlayRatio(value,true);
  });
  syncDictionaryResizer();
}
